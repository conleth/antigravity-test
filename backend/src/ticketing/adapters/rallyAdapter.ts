/**
 * Rally Ticketing Adapter
 * 
 * Implements the TicketingAdapter interface for Broadcom Rally.
 * Uses OAuth 2.0 for authentication.
 */

import type { ShortlistedRequirement } from '../../lib/rules/types.js';
import {
    type TicketingAdapter,
    type TicketReference,
    type TicketStatus,
    type AuthUrl,
    type TicketCreateOptions,
    registerTicketingAdapter,
} from '../types.js';

// =============================================================================
// Configuration
// =============================================================================

interface RallyConfig {
    clientId: string;
    clientSecret: string;
    apiUrl: string;
    authUrl: string;
    workspace?: string;
    project?: string;
}

function getRallyConfig(): RallyConfig {
    return {
        clientId: process.env.RALLY_CLIENT_ID ?? '',
        clientSecret: process.env.RALLY_CLIENT_SECRET ?? '',
        apiUrl: process.env.RALLY_API_URL ?? 'https://rally1.rallydev.com/slm/webservice/v2.0',
        authUrl: process.env.RALLY_AUTH_URL ?? 'https://rally1.rallydev.com/login/oauth2/auth',
        workspace: process.env.RALLY_WORKSPACE,
        project: process.env.RALLY_PROJECT,
    };
}

// =============================================================================
// Rally Adapter Implementation
// =============================================================================

class RallyAdapter implements TicketingAdapter {
    readonly name = 'rally';
    readonly displayName = 'Broadcom Rally';

    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;
    private config: RallyConfig;

    constructor() {
        this.config = getRallyConfig();
    }

    async isAuthenticated(): Promise<boolean> {
        if (!this.accessToken) return false;
        if (this.tokenExpiry && this.tokenExpiry < new Date()) return false;
        return true;
    }

    async authenticate(redirectUri: string): Promise<AuthUrl> {
        const state = crypto.randomUUID();

        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'alm',
            state,
        });

        return {
            url: `${this.config.authUrl}?${params.toString()}`,
            state,
        };
    }

    async handleCallback(code: string, _state: string): Promise<void> {
        // Exchange code for tokens
        const tokenUrl = this.config.authUrl.replace('/auth', '/token');

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(
                    `${this.config.clientId}:${this.config.clientSecret}`
                ).toString('base64')}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
            }),
        });

        if (!response.ok) {
            throw new Error(`Rally auth failed: ${response.statusText}`);
        }

        const data = (await response.json()) as {
            access_token: string;
            expires_in: number;
        };

        this.accessToken = data.access_token;
        this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
    }

    async createTicket(
        requirement: ShortlistedRequirement,
        options?: TicketCreateOptions
    ): Promise<TicketReference> {
        if (!this.accessToken) {
            throw new Error('Rally adapter not authenticated');
        }

        const userStory = {
            Name: `[${requirement.standard}] ${requirement.requirementId}: ${requirement.title}`,
            Description: this.formatDescription(requirement),
            Project: options?.project ?? this.config.project,
            Tags: this.formatTags(requirement, options?.labels),
            // Custom fields for traceability
            c_SecurityStandard: requirement.standard,
            c_SecurityRequirementId: requirement.requirementId,
            c_SecurityLevel: `L${requirement.level}`,
        };

        const response = await fetch(
            `${this.config.apiUrl}/hierarchicalrequirement/create`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.accessToken}`,
                },
                body: JSON.stringify({
                    HierarchicalRequirement: userStory,
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Rally create failed: ${response.statusText}`);
        }

        const result = (await response.json()) as {
            CreateResult: {
                Object: {
                    ObjectID: string;
                    FormattedID: string;
                    _ref: string;
                };
            };
        };

        const obj = result.CreateResult.Object;

        return {
            ticketId: obj.FormattedID,
            ticketUrl: `https://rally1.rallydev.com/#/detail/userstory/${obj.ObjectID}`,
            system: 'rally',
            createdAt: new Date(),
        };
    }

    async createBulkTickets(
        requirements: ShortlistedRequirement[],
        options?: TicketCreateOptions
    ): Promise<TicketReference[]> {
        // Rally doesn't have a bulk create API, so we create sequentially
        // with rate limiting
        const results: TicketReference[] = [];

        for (const req of requirements) {
            results.push(await this.createTicket(req, options));
            // Small delay to avoid rate limits
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        return results;
    }

    async linkTicket(
        requirement: ShortlistedRequirement,
        ticketId: string
    ): Promise<TicketReference> {
        if (!this.accessToken) {
            throw new Error('Rally adapter not authenticated');
        }

        // First, find the ticket by FormattedID
        const searchResponse = await fetch(
            `${this.config.apiUrl}/hierarchicalrequirement?query=(FormattedID = "${ticketId}")`,
            {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            }
        );

        if (!searchResponse.ok) {
            throw new Error(`Rally search failed: ${searchResponse.statusText}`);
        }

        const searchResult = (await searchResponse.json()) as {
            QueryResult: {
                Results: Array<{
                    ObjectID: string;
                    _ref: string;
                }>;
            };
        };

        if (searchResult.QueryResult.Results.length === 0) {
            throw new Error(`Rally ticket ${ticketId} not found`);
        }

        const ticket = searchResult.QueryResult.Results[0]!;

        // Update the ticket with security metadata
        await fetch(ticket._ref, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.accessToken}`,
            },
            body: JSON.stringify({
                HierarchicalRequirement: {
                    c_SecurityStandard: requirement.standard,
                    c_SecurityRequirementId: requirement.requirementId,
                    c_SecurityLevel: `L${requirement.level}`,
                },
            }),
        });

        return {
            ticketId,
            ticketUrl: `https://rally1.rallydev.com/#/detail/userstory/${ticket.ObjectID}`,
            system: 'rally',
            createdAt: new Date(),
        };
    }

    async getTicketStatus(ticketId: string): Promise<TicketStatus> {
        if (!this.accessToken) {
            throw new Error('Rally adapter not authenticated');
        }

        const response = await fetch(
            `${this.config.apiUrl}/hierarchicalrequirement?query=(FormattedID = "${ticketId}")&fetch=ScheduleState,Owner,LastUpdateDate`,
            {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Rally query failed: ${response.statusText}`);
        }

        const result = (await response.json()) as {
            QueryResult: {
                Results: Array<{
                    ScheduleState: string;
                    Owner?: { _refObjectName: string };
                    LastUpdateDate: string;
                }>;
            };
        };

        if (result.QueryResult.Results.length === 0) {
            return { ticketId, status: 'unknown' };
        }

        const ticket = result.QueryResult.Results[0]!;
        const stateMap: Record<string, TicketStatus['status']> = {
            Defined: 'open',
            'In-Progress': 'in-progress',
            Completed: 'resolved',
            Accepted: 'closed',
        };

        return {
            ticketId,
            status: stateMap[ticket.ScheduleState] ?? 'unknown',
            assignee: ticket.Owner?._refObjectName,
            lastUpdated: new Date(ticket.LastUpdateDate),
        };
    }

    // ==========================================================================
    // Private Helpers
    // ==========================================================================

    private formatDescription(requirement: ShortlistedRequirement): string {
        return `
<h2>Security Requirement</h2>
<p><strong>Standard:</strong> ${requirement.standard} ${requirement.standardVersion}</p>
<p><strong>Requirement ID:</strong> ${requirement.requirementId}</p>
<p><strong>Level:</strong> L${requirement.level}</p>
<p><strong>Category:</strong> ${requirement.category}</p>
${requirement.section ? `<p><strong>Section:</strong> ${requirement.section}</p>` : ''}

<h3>Description</h3>
<p>${requirement.description}</p>

<h3>Rationale</h3>
<p>${requirement.rationale}</p>

<p><em>Generated by Modern RAT</em></p>
    `.trim();
    }

    private formatTags(
        requirement: ShortlistedRequirement,
        additionalLabels?: string[]
    ): string[] {
        const tags = [
            `security`,
            requirement.standard.toLowerCase(),
            `level-${requirement.level}`,
            ...requirement.tags,
            ...(additionalLabels ?? []),
        ];
        return [...new Set(tags)]; // Remove duplicates
    }
}

// Register the Rally adapter
registerTicketingAdapter('rally', () => new RallyAdapter());
