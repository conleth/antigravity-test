/**
 * Ticketing API Routes
 * 
 * Handles ticket creation and linking for requirements.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { getQuestionnaire } from '../lib/questionnaire/questionnaireEngine.js';
import { loadASVSData } from '../lib/asvsData.js';
import { loadSPVSData } from '../lib/spvsData.js';
import { evaluateRules } from '../lib/rules/rulesEngine.js';
import type { RuleSet } from '../lib/rules/types.js';
import {
    getTicketingAdapter,
    listTicketingAdapters,
    type TicketCreateOptions,
} from '../ticketing/index.js';

import rulesData from '../data/rules.json' assert { type: 'json' };

// =============================================================================
// Schemas
// =============================================================================

const CreateTicketSchema = z.object({
    sessionId: z.string(),
    requirementIds: z.array(z.string()),
    adapterName: z.string(),
    options: z
        .object({
            project: z.string().optional(),
            parentId: z.string().optional(),
            labels: z.array(z.string()).optional(),
            priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        })
        .optional(),
});

const LinkTicketSchema = z.object({
    sessionId: z.string(),
    requirementId: z.string(),
    ticketId: z.string(),
    adapterName: z.string(),
});

// =============================================================================
// Route Registration
// =============================================================================

export async function ticketingRoutes(fastify: FastifyInstance): Promise<void> {
    // ---------------------------------------------------------------------------
    // GET /api/ticketing/adapters - List available ticketing adapters
    // ---------------------------------------------------------------------------
    fastify.get('/api/ticketing/adapters', async (_request, reply) => {
        const adapters = listTicketingAdapters();
        const adapterInfo = adapters.map((name) => {
            const adapter = getTicketingAdapter(name);
            return {
                name,
                displayName: adapter?.displayName ?? name,
            };
        });

        return reply.send({ adapters: adapterInfo });
    });

    // ---------------------------------------------------------------------------
    // GET /api/ticketing/:adapter/auth/status - Check auth status
    // ---------------------------------------------------------------------------
    fastify.get(
        '/api/ticketing/:adapter/auth/status',
        async (
            request: FastifyRequest<{ Params: { adapter: string } }>,
            reply: FastifyReply
        ) => {
            const { adapter: adapterName } = request.params;
            const adapter = getTicketingAdapter(adapterName);

            if (!adapter) {
                return reply.status(404).send({ error: `Adapter ${adapterName} not found` });
            }

            const isAuthenticated = await adapter.isAuthenticated();
            return reply.send({ authenticated: isAuthenticated });
        }
    );

    // ---------------------------------------------------------------------------
    // GET /api/ticketing/:adapter/auth/url - Get OAuth URL
    // ---------------------------------------------------------------------------
    fastify.get(
        '/api/ticketing/:adapter/auth/url',
        async (
            request: FastifyRequest<{
                Params: { adapter: string };
                Querystring: { redirectUri?: string };
            }>,
            reply: FastifyReply
        ) => {
            const { adapter: adapterName } = request.params;
            const { redirectUri } = request.query;

            const adapter = getTicketingAdapter(adapterName);
            if (!adapter) {
                return reply.status(404).send({ error: `Adapter ${adapterName} not found` });
            }

            if (!adapter.authenticate) {
                return reply.status(400).send({ error: 'Adapter does not support OAuth' });
            }

            const baseUri = redirectUri ?? `${request.protocol}://${request.hostname}/api/ticketing/${adapterName}/auth/callback`;
            const authUrl = await adapter.authenticate(baseUri);

            return reply.send(authUrl);
        }
    );

    // ---------------------------------------------------------------------------
    // GET /api/ticketing/:adapter/auth/callback - OAuth callback
    // ---------------------------------------------------------------------------
    fastify.get(
        '/api/ticketing/:adapter/auth/callback',
        async (
            request: FastifyRequest<{
                Params: { adapter: string };
                Querystring: { code?: string; state?: string; error?: string };
            }>,
            reply: FastifyReply
        ) => {
            const { adapter: adapterName } = request.params;
            const { code, state, error } = request.query;

            if (error) {
                return reply.status(400).send({ error: `OAuth error: ${error}` });
            }

            if (!code || !state) {
                return reply.status(400).send({ error: 'Missing code or state' });
            }

            const adapter = getTicketingAdapter(adapterName);
            if (!adapter) {
                return reply.status(404).send({ error: `Adapter ${adapterName} not found` });
            }

            if (!adapter.handleCallback) {
                return reply.status(400).send({ error: 'Adapter does not support OAuth' });
            }

            try {
                await adapter.handleCallback(code, state);
                return reply.send({ success: true, message: 'Authentication successful' });
            } catch (err) {
                return reply.status(500).send({ error: `Authentication failed: ${err}` });
            }
        }
    );

    // ---------------------------------------------------------------------------
    // POST /api/ticketing/create - Create tickets for requirements
    // ---------------------------------------------------------------------------
    fastify.post(
        '/api/ticketing/create',
        async (
            request: FastifyRequest<{ Body: z.infer<typeof CreateTicketSchema> }>,
            reply: FastifyReply
        ) => {
            const parsed = CreateTicketSchema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ error: 'Invalid request', details: parsed.error });
            }

            const { sessionId, requirementIds, adapterName, options } = parsed.data;

            // Get adapter
            const adapter = getTicketingAdapter(adapterName);
            if (!adapter) {
                return reply.status(404).send({ error: `Adapter ${adapterName} not found` });
            }

            // Check auth
            const isAuth = await adapter.isAuthenticated();
            if (!isAuth) {
                return reply.status(401).send({ error: 'Adapter not authenticated' });
            }

            // Get requirements from session
            const stored = getQuestionnaire(sessionId);
            if (!stored) {
                return reply.status(404).send({ error: 'Session not found' });
            }

            const asvsData = loadASVSData();
            const spvsData = loadSPVSData();
            const result = evaluateRules({
                attributes: stored.attributes,
                ruleSet: rulesData as RuleSet,
                asvsData,
                spvsData,
            });

            // Filter to requested requirements
            const requirements = result.included.filter((r) =>
                requirementIds.includes(r.requirementId)
            );

            if (requirements.length === 0) {
                return reply.status(400).send({ error: 'No matching requirements found' });
            }

            // Create tickets
            try {
                const tickets = adapter.createBulkTickets
                    ? await adapter.createBulkTickets(requirements, options as TicketCreateOptions)
                    : await Promise.all(
                        requirements.map((r) => adapter.createTicket(r, options as TicketCreateOptions))
                    );

                return reply.send({
                    created: tickets.length,
                    tickets,
                });
            } catch (err) {
                return reply.status(500).send({ error: `Failed to create tickets: ${err}` });
            }
        }
    );

    // ---------------------------------------------------------------------------
    // POST /api/ticketing/link - Link existing ticket to requirement
    // ---------------------------------------------------------------------------
    fastify.post(
        '/api/ticketing/link',
        async (
            request: FastifyRequest<{ Body: z.infer<typeof LinkTicketSchema> }>,
            reply: FastifyReply
        ) => {
            const parsed = LinkTicketSchema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ error: 'Invalid request', details: parsed.error });
            }

            const { sessionId, requirementId, ticketId, adapterName } = parsed.data;

            // Get adapter
            const adapter = getTicketingAdapter(adapterName);
            if (!adapter) {
                return reply.status(404).send({ error: `Adapter ${adapterName} not found` });
            }

            // Check auth
            const isAuth = await adapter.isAuthenticated();
            if (!isAuth) {
                return reply.status(401).send({ error: 'Adapter not authenticated' });
            }

            // Get requirement
            const stored = getQuestionnaire(sessionId);
            if (!stored) {
                return reply.status(404).send({ error: 'Session not found' });
            }

            const asvsData = loadASVSData();
            const spvsData = loadSPVSData();
            const result = evaluateRules({
                attributes: stored.attributes,
                ruleSet: rulesData as RuleSet,
                asvsData,
                spvsData,
            });

            const requirement = result.included.find((r) => r.requirementId === requirementId);
            if (!requirement) {
                return reply.status(404).send({ error: 'Requirement not found in session' });
            }

            // Link ticket
            try {
                const ticket = await adapter.linkTicket(requirement, ticketId);
                return reply.send({ linked: true, ticket });
            } catch (err) {
                return reply.status(500).send({ error: `Failed to link ticket: ${err}` });
            }
        }
    );

    // ---------------------------------------------------------------------------
    // GET /api/ticketing/status/:ticketId - Get ticket status
    // ---------------------------------------------------------------------------
    fastify.get(
        '/api/ticketing/status/:ticketId',
        async (
            request: FastifyRequest<{
                Params: { ticketId: string };
                Querystring: { adapter?: string };
            }>,
            reply: FastifyReply
        ) => {
            const { ticketId } = request.params;
            const { adapter: adapterName = 'mock' } = request.query;

            const adapter = getTicketingAdapter(adapterName);
            if (!adapter) {
                return reply.status(404).send({ error: `Adapter ${adapterName} not found` });
            }

            if (!adapter.getTicketStatus) {
                return reply.status(400).send({ error: 'Adapter does not support status checking' });
            }

            try {
                const status = await adapter.getTicketStatus(ticketId);
                return reply.send(status);
            } catch (err) {
                return reply.status(500).send({ error: `Failed to get status: ${err}` });
            }
        }
    );
}
