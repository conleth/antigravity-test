/**
 * Modern RAT Backend Server
 * 
 * Fastify-based API server for the Security Requirements Automation Tool.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';

import { checklistRoutes } from './routes/checklistRoutes.js';
import { ticketingRoutes } from './routes/ticketingRoutes.js';

// Initialize ticketing adapters
import './ticketing/index.js';

// =============================================================================
// Server Configuration
// =============================================================================

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

// =============================================================================
// Server Setup
// =============================================================================

async function buildServer() {
    const fastify = Fastify({
        logger: {
            level: process.env.LOG_LEVEL ?? 'info',
            transport:
                process.env.NODE_ENV === 'development'
                    ? {
                        target: 'pino-pretty',
                        options: {
                            translateTime: 'HH:MM:ss Z',
                            ignore: 'pid,hostname',
                        },
                    }
                    : undefined,
        },
    });

    // Register plugins
    await fastify.register(cors, {
        origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
        credentials: true,
    });

    await fastify.register(cookie, {
        secret: process.env.COOKIE_SECRET ?? 'modern-rat-dev-secret-change-in-prod',
    });

    // Health check
    fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // API info
    fastify.get('/api', async () => ({
        name: 'Modern RAT API',
        version: '0.1.0',
        description: 'Security Requirements Automation Tool',
        endpoints: {
            questions: 'GET /api/questions',
            questionnaire: {
                submit: 'POST /api/questionnaire/submit',
                get: 'GET /api/questionnaire/:sessionId',
                list: 'GET /api/questionnaires',
            },
            checklist: {
                get: 'GET /api/checklist?sessionId=...',
                preview: 'POST /api/checklist/preview',
                export: 'GET /api/checklist/export/:format?sessionId=...',
            },
            exclusions: 'GET /api/exclusions?sessionId=...',
            ticketing: {
                adapters: 'GET /api/ticketing/adapters',
                create: 'POST /api/ticketing/create',
                link: 'POST /api/ticketing/link',
            },
        },
    }));

    // Register routes
    await fastify.register(checklistRoutes);
    await fastify.register(ticketingRoutes);

    return fastify;
}

// =============================================================================
// Server Start
// =============================================================================

async function start() {
    try {
        const fastify = await buildServer();

        await fastify.listen({ port: PORT, host: HOST });

        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🛡️  Modern RAT Backend                                      ║
║   Security Requirements Automation Tool                       ║
║                                                               ║
║   Server running at: http://${HOST}:${PORT}                   ║
║   API docs at:       http://${HOST}:${PORT}/api               ║
║   Health check:      http://${HOST}:${PORT}/health            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
