/**
 * Checklist API Routes
 * 
 * Handles questionnaire submission, checklist generation, and exports.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { loadASVSData } from '../lib/asvsData.js';
import { loadSPVSData } from '../lib/spvsData.js';
import { evaluateRules } from '../lib/rules/rulesEngine.js';
import type {
    RuleSet, DerivedAttributes, ShortlistResult
} from '../lib/rules/types';

import {
    processAnswers,
    validateAnswers,
    saveQuestionnaire,
    getQuestionnaire,
    updateQuestionnaireSelection,
    listQuestionnaires,
    type Question,
    type QuestionnaireAnswers,
} from '../lib/questionnaire/questionnaireEngine.js';

// Import data files
import questionsData from '../data/questions.json' assert { type: 'json' };
import rulesData from '../data/rules.json' assert { type: 'json' };

const RULES = rulesData as unknown as RuleSet;
const ASVS_DATA = loadASVSData();
const SPVS_DATA = loadSPVSData();

// =============================================================================
// Schemas
// =============================================================================

const QuestionnaireSubmitSchema = z.object({
    sessionId: z.string().optional(),
    answers: z.record(z.union([z.string(), z.boolean(), z.array(z.string())])),
});

const ExportFormatSchema = z.enum(['json', 'csv', 'markdown']);

// =============================================================================
// Route Registration
// =============================================================================

export async function checklistRoutes(fastify: FastifyInstance): Promise<void> {
    // ---------------------------------------------------------------------------
    // GET /api/questions - Get all questionnaire questions
    // ---------------------------------------------------------------------------
    fastify.get('/api/questions', async (_request, reply) => {
        return reply.send({
            version: questionsData.version,
            questions: questionsData.questions,
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/questionnaire/submit - Submit questionnaire answers
    // ---------------------------------------------------------------------------
    fastify.post(
        '/api/questionnaire/submit',
        async (
            request: FastifyRequest<{ Body: z.infer<typeof QuestionnaireSubmitSchema> }>,
            reply: FastifyReply
        ) => {
            const parsed = QuestionnaireSubmitSchema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ error: 'Invalid request body', details: parsed.error });
            }

            const { sessionId, answers } = parsed.data;
            const questions = questionsData.questions as Question[];

            // Validate answers
            const validation = validateAnswers(questions, answers as QuestionnaireAnswers);
            if (!validation.valid) {
                return reply.status(400).send({ error: 'Missing required answers', details: validation.errors });
            }

            // Process answers into derived attributes
            const attributes = processAnswers(questions, answers as QuestionnaireAnswers);

            // Generate session ID if not provided
            const id = sessionId ?? crypto.randomUUID();

            // Save questionnaire
            const stored = saveQuestionnaire(id, answers as QuestionnaireAnswers, attributes);

            return reply.send({
                sessionId: id,
                attributes,
                recommendedLevel: attributes.recommendedLevel,
                createdAt: stored.createdAt,
            });
        }
    );

    // ---------------------------------------------------------------------------
    // GET /api/questionnaire/:sessionId - Get stored questionnaire
    // ---------------------------------------------------------------------------
    fastify.get(
        '/api/questionnaire/:sessionId',
        async (
            request: FastifyRequest<{ Params: { sessionId: string } }>,
            reply: FastifyReply
        ) => {
            const { sessionId } = request.params;
            const stored = getQuestionnaire(sessionId);

            if (!stored) {
                return reply.status(404).send({ error: 'Questionnaire not found' });
            }

            return reply.send(stored);
        }
    );

    // ---------------------------------------------------------------------------
    // GET /api/questionnaires - List all stored questionnaires
    // ---------------------------------------------------------------------------
    fastify.get('/api/questionnaires', async (_request, reply) => {
        const questionnaires = listQuestionnaires();
        return reply.send({
            count: questionnaires.length,
            questionnaires: questionnaires.map((q) => ({
                id: q.id,
                recommendedLevel: q.attributes.recommendedLevel,
                createdAt: q.createdAt,
                updatedAt: q.updatedAt,
            })),
        });
    });

    // ---------------------------------------------------------------------------
    // GET /api/checklist - Get shortlisted requirements for a session
    // ---------------------------------------------------------------------------
    fastify.get(
        '/api/checklist',
        async (
            request: FastifyRequest<{
                Querystring: {
                    sessionId?: string;
                    includeExclusions?: string;
                };
            }>,
            reply: FastifyReply
        ) => {
            const { sessionId, includeExclusions } = request.query;

            if (!sessionId) {
                return reply.status(400).send({ error: 'sessionId is required' });
            }

            const stored = getQuestionnaire(sessionId);
            if (!stored) {
                return reply.status(404).send({ error: 'Session not found' });
            }

            // Load data
            const asvsData = loadASVSData();
            const spvsData = loadSPVSData();

            // Evaluate rules
            const result = evaluateRules({
                attributes: stored.attributes,
                ruleSet: rulesData as RuleSet,
                asvsData,
                spvsData,
                includeExclusions: includeExclusions === 'true',
            });

            return reply.send({
                sessionId,
                ...result,
            });
        }
    );

    // ---------------------------------------------------------------------------
    // POST /api/checklist/selection - Update user selection
    // ---------------------------------------------------------------------------
    fastify.post(
        '/api/checklist/selection',
        async (
            request: FastifyRequest<{
                Body: { sessionId: string; selectedIds: string[] };
            }>,
            reply: FastifyReply
        ) => {
            const { sessionId, selectedIds } = request.body;

            if (!sessionId || !selectedIds) {
                return reply.status(400).send({ error: 'sessionId and selectedIds are required' });
            }

            const updated = updateQuestionnaireSelection(sessionId, selectedIds);
            if (!updated) {
                return reply.status(404).send({ error: 'Session not found' });
            }

            return reply.send({ success: true });
        }
    );

    // ---------------------------------------------------------------------------
    // GET /api/exclusions - Get list of excluded requirements
    // ---------------------------------------------------------------------------
    fastify.get(
        '/api/exclusions',
        async (
            request: FastifyRequest<{ Querystring: { sessionId: string } }>,
            reply: FastifyReply
        ) => {
            const { sessionId } = request.query;

            if (!sessionId) {
                return reply.status(400).send({ error: 'sessionId is required' });
            }

            const stored = getQuestionnaire(sessionId);
            if (!stored) {
                return reply.status(404).send({ error: 'Session not found' });
            }

            // Run rules to get base included/excluded
            const rulesResult = evaluateRules({
                attributes: stored.attributes,
                ruleSet: RULES,
                asvsData: ASVS_DATA,
                spvsData: SPVS_DATA,
                includeExclusions: true,
            });

            const excluded = rulesResult.excluded || [];

            // Add items that were included but NOT selected by user
            const selectedSet = new Set(stored.selectedIds || []);
            const userExcluded = rulesResult.included.filter(req => !selectedSet.has(req.requirementId));

            // Convert user excluded to ExcludedRequirement format
            userExcluded.forEach(req => {
                excluded.push({
                    requirementId: req.requirementId,
                    title: req.description,
                    standard: req.standard,
                    standardVersion: req.standardVersion,
                    exclusionReason: 'Not selected by user',
                    excludedByRule: 'User Selection'
                });
            });

            // Recalculate stats
            const stats = {
                excludedASVS: excluded.filter(r => r.standard === 'ASVS').length,
                excludedSPVS: excluded.filter(r => r.standard === 'SPVS').length,
            };

            return reply.send({
                sessionId,
                excluded,
                stats,
            });
        }
    );

    // ---------------------------------------------------------------------------
    fastify.post(
        '/api/checklist/preview',
        async (
            request: FastifyRequest<{
                Body: {
                    attributes: DerivedAttributes;
                    includeExclusions?: boolean;
                };
            }>,
            reply: FastifyReply
        ) => {
            const { attributes, includeExclusions } = request.body;

            if (!attributes) {
                return reply.status(400).send({ error: 'attributes is required' });
            }

            // Load data
            const asvsData = loadASVSData();
            const spvsData = loadSPVSData();

            // Evaluate rules
            const result = evaluateRules({
                attributes,
                ruleSet: rulesData as RuleSet,
                asvsData,
                spvsData,
                includeExclusions: includeExclusions ?? false,
            });

            return reply.send(result);
        }
    );

    // ---------------------------------------------------------------------------
    // GET /api/checklist/export/:format - Export checklist
    // ---------------------------------------------------------------------------
    fastify.get(
        '/api/checklist/export/:format',
        async (
            request: FastifyRequest<{
                Params: { format: string };
                Querystring: { sessionId?: string };
            }>,
            reply: FastifyReply
        ) => {
            const { format } = request.params;
            const { sessionId } = request.query;

            // Validate format
            const formatParsed = ExportFormatSchema.safeParse(format);
            if (!formatParsed.success) {
                return reply.status(400).send({ error: 'Invalid format. Use: json, csv, markdown' });
            }

            if (!sessionId) {
                return reply.status(400).send({ error: 'sessionId is required' });
            }

            const stored = getQuestionnaire(sessionId);
            if (!stored) {
                return reply.status(404).send({ error: 'Session not found' });
            }

            // Load and evaluate
            const asvsData = loadASVSData();
            const spvsData = loadSPVSData();
            const result = evaluateRules({
                attributes: stored.attributes,
                ruleSet: rulesData as RuleSet,
                asvsData,
                spvsData,
                includeExclusions: false,
            });

            switch (formatParsed.data) {
                case 'json':
                    return reply
                        .header('Content-Type', 'application/json')
                        .header('Content-Disposition', `attachment; filename="checklist-${sessionId}.json"`)
                        .send(result);

                case 'csv':
                    const csv = exportToCSV(result);
                    return reply
                        .header('Content-Type', 'text/csv')
                        .header('Content-Disposition', `attachment; filename="checklist-${sessionId}.csv"`)
                        .send(csv);

                case 'markdown':
                    const md = exportToMarkdown(result);
                    return reply
                        .header('Content-Type', 'text/markdown')
                        .header('Content-Disposition', `attachment; filename="checklist-${sessionId}.md"`)
                        .send(md);
            }
        }
    );


}

// =============================================================================
// Export Helpers
// =============================================================================

function exportToCSV(result: ShortlistResult): string {
    const headers = [
        'Standard',
        'Version',
        'Requirement ID',
        'Title',
        'Description',
        'Level',
        'Category',
        'Section',
        'Rationale',
        'Tags',
    ];

    const rows = result.included.map((req) => [
        req.standard,
        req.standardVersion,
        req.requirementId,
        `"${req.title.replace(/"/g, '""')}"`,
        `"${req.description.replace(/"/g, '""')}"`,
        req.level,
        `"${req.category}"`,
        `"${req.section ?? ''}"`,
        `"${req.rationale.replace(/"/g, '""')}"`,
        `"${req.tags.join(', ')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function exportToMarkdown(result: ShortlistResult): string {
    const lines: string[] = [
        '# Security Requirements Checklist',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Summary',
        '',
        `- **Total Requirements**: ${result.included.length}`,
        `- **ASVS Requirements**: ${result.stats.includedASVS}`,
        `- **SPVS Requirements**: ${result.stats.includedSPVS}`,
        `- **Recommended Level**: L${result.attributes.recommendedLevel}`,
        '',
        '## Context',
        '',
        `- **Application Type**: ${result.attributes.appType}`,
        `- **Authentication**: ${result.attributes.authType}`,
        `- **Data Sensitivity**: ${result.attributes.dataSensitivity}`,
        `- **Internet Exposure**: ${result.attributes.internetExposure}`,
        `- **Hosting Model**: ${result.attributes.hostingModel}`,
        '',
        '---',
        '',
    ];

    // Group by standard and category
    const byStandard = new Map<string, typeof result.included>();
    for (const req of result.included) {
        const key = req.standard;
        if (!byStandard.has(key)) {
            byStandard.set(key, []);
        }
        byStandard.get(key)!.push(req);
    }

    for (const [standard, reqs] of byStandard) {
        lines.push(`## ${standard} Requirements`, '');

        // Group by category
        const byCategory = new Map<string, typeof reqs>();
        for (const req of reqs) {
            if (!byCategory.has(req.category)) {
                byCategory.set(req.category, []);
            }
            byCategory.get(req.category)!.push(req);
        }

        for (const [category, categoryReqs] of byCategory) {
            lines.push(`### ${category}`, '');

            for (const req of categoryReqs) {
                lines.push(
                    `- [ ] **${req.requirementId}** (L${req.level}): ${req.description}`,
                    `  - *Rationale*: ${req.rationale}`,
                    ''
                );
            }
        }
    }

    return lines.join('\n');
}
