/**
 * Ticketing Adapter Types
 * 
 * Defines the interface for ticketing system integrations.
 * Adapters must implement this interface to support ticket creation.
 */

import type { ShortlistedRequirement } from '../lib/rules/types.js';

// =============================================================================
// Core Types
// =============================================================================

export interface TicketReference {
    /** External ticket ID */
    ticketId: string;
    /** URL to view the ticket */
    ticketUrl: string;
    /** Ticketing system name */
    system: string;
    /** Creation timestamp */
    createdAt: Date;
}

export interface TicketStatus {
    ticketId: string;
    status: 'open' | 'in-progress' | 'resolved' | 'closed' | 'unknown';
    assignee?: string;
    lastUpdated?: Date;
}

export interface AuthUrl {
    url: string;
    state: string;
}

export interface TicketCreateOptions {
    /** Project or workspace to create ticket in */
    project?: string;
    /** Parent ticket/epic to link to */
    parentId?: string;
    /** Additional labels/tags */
    labels?: string[];
    /** Priority level */
    priority?: 'low' | 'medium' | 'high' | 'critical';
    /** Custom fields */
    customFields?: Record<string, unknown>;
}

// =============================================================================
// Adapter Interface
// =============================================================================

export interface TicketingAdapter {
    /** Unique name of this adapter */
    readonly name: string;

    /** Display name for UI */
    readonly displayName: string;

    /**
     * Check if the adapter is currently authenticated.
     */
    isAuthenticated(): Promise<boolean>;

    /**
     * Initiate OAuth flow (if applicable).
     * Returns URL to redirect user to.
     */
    authenticate?(redirectUri: string): Promise<AuthUrl>;

    /**
     * Handle OAuth callback (if applicable).
     */
    handleCallback?(code: string, state: string): Promise<void>;

    /**
     * Create a single ticket for a requirement.
     */
    createTicket(
        requirement: ShortlistedRequirement,
        options?: TicketCreateOptions
    ): Promise<TicketReference>;

    /**
     * Create multiple tickets in bulk.
     * Default implementation calls createTicket for each.
     */
    createBulkTickets?(
        requirements: ShortlistedRequirement[],
        options?: TicketCreateOptions
    ): Promise<TicketReference[]>;

    /**
     * Link an existing ticket to a requirement.
     */
    linkTicket(
        requirement: ShortlistedRequirement,
        ticketId: string
    ): Promise<TicketReference>;

    /**
     * Get the status of a ticket (optional).
     */
    getTicketStatus?(ticketId: string): Promise<TicketStatus>;

    /**
     * Update the status of a ticket (optional).
     */
    updateTicketStatus?(ticketId: string, status: string): Promise<void>;
}

// =============================================================================
// Adapter Registry
// =============================================================================

export type AdapterFactory = () => TicketingAdapter;

const adapterRegistry = new Map<string, AdapterFactory>();

/**
 * Register a ticketing adapter factory.
 */
export function registerTicketingAdapter(
    name: string,
    factory: AdapterFactory
): void {
    adapterRegistry.set(name, factory);
}

/**
 * Get a ticketing adapter instance by name.
 */
export function getTicketingAdapter(name: string): TicketingAdapter | undefined {
    const factory = adapterRegistry.get(name);
    return factory?.();
}

/**
 * List all registered adapter names.
 */
export function listTicketingAdapters(): string[] {
    return Array.from(adapterRegistry.keys());
}

// =============================================================================
// Mock Adapter (for development/testing)
// =============================================================================

class MockTicketingAdapter implements TicketingAdapter {
    readonly name = 'mock';
    readonly displayName = 'Mock Ticketing (Development)';

    private tickets = new Map<string, TicketReference>();
    private ticketCounter = 1000;

    async isAuthenticated(): Promise<boolean> {
        return true;
    }

    async createTicket(
        requirement: ShortlistedRequirement,
        _options?: TicketCreateOptions
    ): Promise<TicketReference> {
        const ticketId = `MOCK-${this.ticketCounter++}`;
        const ticket: TicketReference = {
            ticketId,
            ticketUrl: `https://mock-tickets.local/browse/${ticketId}`,
            system: 'mock',
            createdAt: new Date(),
        };
        this.tickets.set(ticketId, ticket);

        console.log(`[Mock] Created ticket ${ticketId} for ${requirement.requirementId}`);
        return ticket;
    }

    async createBulkTickets(
        requirements: ShortlistedRequirement[],
        options?: TicketCreateOptions
    ): Promise<TicketReference[]> {
        const results: TicketReference[] = [];
        for (const req of requirements) {
            results.push(await this.createTicket(req, options));
        }
        return results;
    }

    async linkTicket(
        requirement: ShortlistedRequirement,
        ticketId: string
    ): Promise<TicketReference> {
        const ticket: TicketReference = {
            ticketId,
            ticketUrl: `https://mock-tickets.local/browse/${ticketId}`,
            system: 'mock',
            createdAt: new Date(),
        };
        this.tickets.set(ticketId, ticket);

        console.log(`[Mock] Linked ticket ${ticketId} to ${requirement.requirementId}`);
        return ticket;
    }

    async getTicketStatus(ticketId: string): Promise<TicketStatus> {
        return {
            ticketId,
            status: 'open',
            lastUpdated: new Date(),
        };
    }
}

// Register the mock adapter
registerTicketingAdapter('mock', () => new MockTicketingAdapter());
