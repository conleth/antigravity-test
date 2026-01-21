/**
 * Questionnaire Engine
 * 
 * Processes questionnaire answers and computes derived attributes
 * for the rules engine. Also calculates recommended security level.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { DerivedAttributes } from '../rules/types.js';

const DATA_DIR = join(process.cwd(), 'src', 'data');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');

// =============================================================================
// Question Types
// =============================================================================

export interface QuestionOption {
    value: string;
    label: string;
    description?: string;
}

export interface Question {
    id: string;
    text: string;
    helpText?: string;
    type: 'single-select' | 'multi-select' | 'boolean' | 'text';
    required: boolean;
    options?: QuestionOption[];
    mapsTo: string; // Dot notation path in DerivedAttributes
    order: number;
}

export interface QuestionnaireData {
    version: string;
    description: string;
    questions: Question[];
}

export interface QuestionnaireAnswers {
    [questionId: string]: string | boolean | string[];
}

// =============================================================================
// Level Calculation
// =============================================================================

interface RiskFactor {
    condition: (attrs: Partial<DerivedAttributes>) => boolean;
    levelIncrease: number;
    description: string;
}

const RISK_FACTORS: RiskFactor[] = [
    {
        condition: (a) => a.dataSensitivity === 'regulated',
        levelIncrease: 2,
        description: 'Regulated data requires Level 3',
    },
    {
        condition: (a) => a.dataSensitivity === 'confidential',
        levelIncrease: 1,
        description: 'Confidential data requires at least Level 2',
    },
    {
        condition: (a) => a.internetExposure === 'public',
        levelIncrease: 1,
        description: 'Public exposure increases risk',
    },
    {
        condition: (a) => a.authType === 'oauth' || a.authType === 'sso',
        levelIncrease: 0,
        description: 'Token-based auth is already hardened',
    },
    {
        condition: (a) => a.authType === 'none',
        levelIncrease: 0,
        description: 'No auth - level depends on data sensitivity',
    },
    {
        condition: (a) => a.hostingModel === 'cloud',
        levelIncrease: 0,
        description: 'Cloud hosting with shared responsibility',
    },
];

/**
 * Calculate recommended security level based on risk factors.
 * Base level is 1, increases based on risk.
 */
function calculateRecommendedLevel(
    attrs: Partial<DerivedAttributes>
): 1 | 2 | 3 {
    let level = 1;

    for (const factor of RISK_FACTORS) {
        if (factor.condition(attrs)) {
            level += factor.levelIncrease;
        }
    }

    // Clamp to valid range
    return Math.min(3, Math.max(1, level)) as 1 | 2 | 3;
}

// =============================================================================
// Answer Processing
// =============================================================================

/**
 * Set a value at a dot-notation path in an object.
 */
function setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;
        if (!(part in current)) {
            current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1]!;
    current[lastPart] = value;
}

/**
 * Process questionnaire answers into derived attributes.
 */
export function processAnswers(
    questions: Question[],
    answers: QuestionnaireAnswers
): DerivedAttributes {
    // Start with defaults
    const result: Record<string, unknown> = {
        appType: 'web',
        authType: 'session',
        dataSensitivity: 'internal',
        internetExposure: 'private',
        hostingModel: 'cloud',
        pipelineMaturity: {
            hasCI: false,
            hasSignedArtifacts: false,
            hasSecretScanning: false,
            hasIaC: false,
            hasSBOM: false,
        },
        recommendedLevel: 1,
    };

    // Apply answers
    for (const question of questions) {
        const answer = answers[question.id];
        if (answer !== undefined) {
            setNestedValue(result, question.mapsTo, answer);
        }
    }

    // Calculate recommended level
    const partialAttrs = result as Partial<DerivedAttributes>;
    result.recommendedLevel = calculateRecommendedLevel(partialAttrs);

    return result as unknown as DerivedAttributes;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate that all required questions have answers.
 */
export function validateAnswers(
    questions: Question[],
    answers: QuestionnaireAnswers
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const question of questions) {
        if (question.required) {
            const answer = answers[question.id];
            if (answer === undefined || answer === '' || answer === null) {
                errors.push(`Missing required answer for: ${question.text}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// =============================================================================
// Questionnaire Store (in-memory, replaceable)
// =============================================================================

export interface StoredQuestionnaire {
    id: string;
    answers: QuestionnaireAnswers;
    attributes: DerivedAttributes;
    selectedIds?: string[];
    createdAt: Date;
    updatedAt: Date;
}

const questionnaireStore = new Map<string, StoredQuestionnaire>();

// Load sessions on startup
try {
    if (existsSync(SESSIONS_FILE)) {
        const raw = readFileSync(SESSIONS_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
            data.forEach((session: any) => {
                // Restore dates
                session.createdAt = new Date(session.createdAt);
                session.updatedAt = new Date(session.updatedAt);
                questionnaireStore.set(session.id, session);
            });
            console.log(`Loaded ${data.length} sessions from disk`);
        }
    }
} catch (err) {
    console.error('Failed to load sessions:', err);
}

function persistStore() {
    try {
        const data = Array.from(questionnaireStore.values());
        writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Failed to save sessions:', err);
    }
}

export function saveQuestionnaire(
    id: string,
    answers: QuestionnaireAnswers,
    attributes: DerivedAttributes
): StoredQuestionnaire {
    const now = new Date();
    const existing = questionnaireStore.get(id);

    const stored: StoredQuestionnaire = {
        id,
        answers,
        attributes,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    };

    questionnaireStore.set(id, stored);
    persistStore();
    return stored;
}

// Update questionnaire selection
export function updateQuestionnaireSelection(
    id: string,
    selectedIds: string[]
): StoredQuestionnaire | undefined {
    const stored = questionnaireStore.get(id);
    if (!stored) return undefined;

    stored.selectedIds = selectedIds;
    stored.updatedAt = new Date();

    questionnaireStore.set(id, stored);
    persistStore();
    return stored;
}

export function getQuestionnaire(id: string): StoredQuestionnaire | undefined {
    return questionnaireStore.get(id);
}

export function deleteQuestionnaire(id: string): boolean {
    const result = questionnaireStore.delete(id);
    if (result) persistStore();
    return result;
}

export function listQuestionnaires(): StoredQuestionnaire[] {
    return Array.from(questionnaireStore.values());
}
