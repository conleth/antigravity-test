/**
 * GitHub Ticketing Adapter
 * 
 * Implements the TicketingAdapter interface for GitHub Issues.
 * Supports both Personal Access Tokens and OAuth (placeholder).
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

interface GitHubConfig {
    token: string;
    owner: string;
    repo: string;
    apiUrl: string;
}

function getGitHubConfig(): GitHubConfig {
    return {
        token: process.env.GITHUB_TOKEN ?? '',
        owner: process.env.GITHUB_OWNER ?? '',
        repo: process.env.GITHUB_REPO ?? '',
        apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
    };
}

// =============================================================================
// GitHub Adapter Implementation
// =============================================================================

class GitHubAdapter implements TicketingAdapter {
    readonly name = 'github';
    readonly displayName = 'GitHub Issues';

    private config: GitHubConfig;

    constructor() {
        this.config = getGitHubConfig();
    }

    async isAuthenticated(): Promise<boolean> {
        // Simple check: do we have a token?
        // In a real app, we might check token validity via a /user call
        return !!this.config.token;
    }

    async createTicket(
        requirement: ShortlistedRequirement,
        options?: TicketCreateOptions
    ): Promise<TicketReference> {
        if (!this.config.token) {
            throw new Error('GitHub token not configured');
        }

        const owner = options?.project?.split('/')[0] || this.config.owner;
        const repo = options?.project?.split('/')[1] || this.config.repo;

        if (!owner || !repo) {
            throw new Error('GitHub owner and repo must be specified (format: owner/repo)');
        }

        const body = {
            title: `[${requirement.standard}] ${requirement.requirementId}: ${requirement.title}`,
            body: this.formatBody(requirement),
            labels: this.formatLabels(requirement, options?.labels),
        };

        const response = await fetch(`${this.config.apiUrl}/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${this.config.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json() as any;
            throw new Error(`GitHub issue creation failed: ${error.message || response.statusText}`);
        }

        const data = await response.json() as {
            number: number;
            html_url: string;
            created_at: string;
        };

        return {
            ticketId: data.number.toString(),
            ticketUrl: data.html_url,
            system: 'github',
            createdAt: new Date(data.created_at),
        };
    }

    async createBulkTickets(
        requirements: ShortlistedRequirement[],
        options?: TicketCreateOptions
    ): Promise<TicketReference[]> {
        const results: TicketReference[] = [];
        for (const req of requirements) {
            results.push(await this.createTicket(req, options));
            // Basic rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return results;
    }

    async linkTicket(
        requirement: ShortlistedRequirement,
        ticketId: string
    ): Promise<TicketReference> {
        // For GitHub, "linking" means adding a comment or label to an existing issue
        const owner = this.config.owner;
        const repo = this.config.repo;

        const response = await fetch(`${this.config.apiUrl}/repos/${owner}/${repo}/issues/${ticketId}/comments`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${this.config.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                body: `### Linked Security Requirement\nThis issue has been linked to **${requirement.standard} ${requirement.requirementId}**\n\n**Rationale:** ${requirement.rationale}`,
            }),
        });

        if (!response.ok) {
            throw new Error(`GitHub link failed: ${response.statusText}`);
        }

        return {
            ticketId,
            ticketUrl: `https://github.com/${owner}/${repo}/issues/${ticketId}`,
            system: 'github',
            createdAt: new Date(),
        };
    }

    async getTicketStatus(ticketId: string): Promise<TicketStatus> {
        const owner = this.config.owner;
        const repo = this.config.repo;

        const response = await fetch(`${this.config.apiUrl}/repos/${owner}/${repo}/issues/${ticketId}`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${this.config.token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub status check failed: ${response.statusText}`);
        }

        const data = await response.json() as {
            state: string;
            updated_at: string;
            assignee?: { login: string };
        };

        const statusMap: Record<string, TicketStatus['status']> = {
            open: 'open',
            closed: 'closed',
        };

        return {
            ticketId,
            status: statusMap[data.state] || 'unknown',
            assignee: data.assignee?.login,
            lastUpdated: new Date(data.updated_at),
        };
    }

    private formatBody(requirement: ShortlistedRequirement): string {
        return `
## Security Requirement: ${requirement.requirementId}
**Standard:** ${requirement.standard} ${requirement.standardVersion}
**Level:** L${requirement.level}
**Category:** ${requirement.category}
${requirement.section ? `**Section:** ${requirement.section}` : ''}

### Description
${requirement.description}

### Rationale
${requirement.rationale}

---
*Generated by Modern RAT*
        `.trim();
    }

    private formatLabels(requirement: ShortlistedRequirement, customLabels?: string[]): string[] {
        const labels = [
            'security',
            requirement.standard.toLowerCase(),
            `level-${requirement.level}`,
            ...(customLabels || []),
        ];
        return [...new Set(labels)];
    }
}

// Register the adapter
registerTicketingAdapter('github', () => new GitHubAdapter());
