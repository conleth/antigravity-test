/**
 * Jira Ticketing Adapter
 * 
 * Implements the TicketingAdapter interface for Atlassian Jira Cloud.
 * Uses Basic Auth (Email + API Token) for simplicity in demo.
 */

import type { ShortlistedRequirement } from '../../lib/rules/types.js';
import {
    type TicketingAdapter,
    type TicketReference,
    type TicketStatus,
    type TicketCreateOptions,
    registerTicketingAdapter,
} from '../types.js';

// =============================================================================
// Configuration
// =============================================================================

interface JiraConfig {
    host: string;
    email: string;
    apiToken: string;
    projectKey: string;
}

function getJiraConfig(): JiraConfig {
    return {
        host: process.env.JIRA_HOST ?? '',
        email: process.env.JIRA_EMAIL ?? '',
        apiToken: process.env.JIRA_API_TOKEN ?? '',
        projectKey: process.env.JIRA_PROJECT ?? '',
    };
}

// =============================================================================
// Jira Adapter Implementation
// =============================================================================

class JiraAdapter implements TicketingAdapter {
    readonly name = 'jira';
    readonly displayName = 'Atlassian Jira';

    private config: JiraConfig;

    constructor() {
        this.config = getJiraConfig();
    }

    async isAuthenticated(): Promise<boolean> {
        return !!(this.config.email && this.config.apiToken && this.config.host);
    }

    private getAuthHeader(): string {
        const credentials = `${this.config.email}:${this.config.apiToken}`;
        return `Basic ${Buffer.from(credentials).toString('base64')}`;
    }

    async createTicket(
        requirement: ShortlistedRequirement,
        options?: TicketCreateOptions
    ): Promise<TicketReference> {
        if (!await this.isAuthenticated()) {
            throw new Error('Jira adapter not authenticated');
        }

        const projectKey = options?.project || this.config.projectKey;
        if (!projectKey) {
            throw new Error('Jira project key must be specified');
        }

        const body = {
            fields: {
                project: { key: projectKey },
                summary: `[${requirement.standard}] ${requirement.requirementId}: ${requirement.title}`,
                description: this.formatDescription(requirement),
                issuetype: { name: 'Task' }, // Default to Task
                priority: this.mapPriority(options?.priority),
                labels: this.formatLabels(requirement, options?.labels),
            },
        };

        const response = await fetch(`${this.config.host}/rest/api/3/issue`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Jira ticket creation failed: ${JSON.stringify(error)}`);
        }

        const data = await response.json() as {
            id: string;
            key: string;
            self: string;
        };

        return {
            ticketId: data.key,
            ticketUrl: `${this.config.host}/browse/${data.key}`,
            system: 'jira',
            createdAt: new Date(),
        };
    }

    async createBulkTickets(
        requirements: ShortlistedRequirement[],
        options?: TicketCreateOptions
    ): Promise<TicketReference[]> {
        // Jira has a bulk create API: /rest/api/3/issue/bulk
        const projectKey = options?.project || this.config.projectKey;

        const issues = requirements.map(req => ({
            fields: {
                project: { key: projectKey },
                summary: `[${req.standard}] ${req.requirementId}: ${req.title}`,
                description: this.formatDescription(req),
                issuetype: { name: 'Task' },
                labels: this.formatLabels(req, options?.labels),
            }
        }));

        const response = await fetch(`${this.config.host}/rest/api/3/issue/bulk`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ issueUpdates: issues }),
        });

        if (!response.ok) {
            throw new Error(`Jira bulk creation failed: ${response.statusText}`);
        }

        const data = await response.json() as {
            issues: Array<{ id: string; key: string }>;
        };

        return data.issues.map(issue => ({
            ticketId: issue.key,
            ticketUrl: `${this.config.host}/browse/${issue.key}`,
            system: 'jira',
            createdAt: new Date(),
        }));
    }

    async linkTicket(
        requirement: ShortlistedRequirement,
        ticketId: string
    ): Promise<TicketReference> {
        // For Jira, update existing issue with labels and description
        const response = await fetch(`${this.config.host}/rest/api/3/issue/${ticketId}`, {
            method: 'PUT',
            headers: {
                'Accept': 'application/json',
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                update: {
                    labels: [
                        { add: 'linked-rat' },
                        { add: requirement.standard.toLowerCase() }
                    ]
                }
            }),
        });

        if (!response.ok) {
            throw new Error(`Jira link failed: ${response.statusText}`);
        }

        return {
            ticketId,
            ticketUrl: `${this.config.host}/browse/${ticketId}`,
            system: 'jira',
            createdAt: new Date(),
        };
    }

    async getTicketStatus(ticketId: string): Promise<TicketStatus> {
        const response = await fetch(`${this.config.host}/rest/api/3/issue/${ticketId}?fields=status,assignee,updated`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': this.getAuthHeader(),
            },
        });

        if (!response.ok) {
            throw new Error(`Jira status check failed: ${response.statusText}`);
        }

        const data = await response.json() as {
            fields: {
                status: { name: string; statusCategory: { key: string } };
                assignee?: { displayName: string };
                updated: string;
            };
        };

        const categoryMap: Record<string, TicketStatus['status']> = {
            'new': 'open',
            'indeterminate': 'in-progress',
            'done': 'closed',
        };

        return {
            ticketId,
            status: categoryMap[data.fields.status.statusCategory.key] || 'unknown',
            assignee: data.fields.assignee?.displayName,
            lastUpdated: new Date(data.fields.updated),
        };
    }

    private formatDescription(requirement: ShortlistedRequirement): any {
        // Jira uses Document Format (ADF) for descriptions in API v3
        return {
            version: 1,
            type: "doc",
            content: [
                {
                    type: "heading",
                    attrs: { level: 2 },
                    content: [{ type: "text", text: `Security Requirement: ${requirement.requirementId}` }]
                },
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "Standard: ", marks: [{ type: "strong" }] },
                        { type: "text", text: `${requirement.standard} ${requirement.standardVersion}` }
                    ]
                },
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "Level: ", marks: [{ type: "strong" }] },
                        { type: "text", text: `L${requirement.level}` }
                    ]
                },
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "Category: ", marks: [{ type: "strong" }] },
                        { type: "text", text: requirement.category }
                    ]
                },
                {
                    type: "heading",
                    attrs: { level: 3 },
                    content: [{ type: "text", text: "Description" }]
                },
                {
                    type: "paragraph",
                    content: [{ type: "text", text: requirement.description }]
                },
                {
                    type: "heading",
                    attrs: { level: 3 },
                    content: [{ type: "text", text: "Rationale" }]
                },
                {
                    type: "paragraph",
                    content: [{ type: "text", text: requirement.rationale }]
                }
            ]
        };
    }

    private formatLabels(requirement: ShortlistedRequirement, customLabels?: string[]): string[] {
        const labels = [
            'security',
            requirement.standard.toLowerCase(),
            `level-${requirement.level}`,
            ...(customLabels || []),
        ];
        return [...new Set(labels)].map(l => l.replace(/\s+/g, '-'));
    }

    private mapPriority(priority?: string): { name: string } | undefined {
        if (!priority) return undefined;
        const mapped: Record<string, string> = {
            low: 'Low',
            medium: 'Medium',
            high: 'High',
            critical: 'Highest',
        };
        return { name: mapped[priority] || 'Medium' };
    }
}

// Register the adapter
registerTicketingAdapter('jira', () => new JiraAdapter());
