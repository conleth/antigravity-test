/**
 * Rules Engine Unit Tests
 * 
 * Tests for the core rules engine functionality:
 * - Predicate evaluation (and/or/not/attribute/level)
 * - Requirement filtering
 * - Rationale generation
 */

import { describe, it, expect } from 'vitest';
import {
    evaluatePredicate,
    evaluateRules,
    validateRuleSet,
} from '../src/lib/rules/rulesEngine';
import type {
    DerivedAttributes,
    RulePredicate,
    RuleSet,
    ASVSData,
    SPVSData,
} from '../src/lib/rules/types';

// =============================================================================
// Test Data
// =============================================================================

const mockAttributes: DerivedAttributes = {
    appType: 'web',
    authType: 'oauth',
    dataSensitivity: 'confidential',
    internetExposure: 'public',
    hostingModel: 'cloud',
    pipelineMaturity: {
        hasCI: true,
        hasSignedArtifacts: true,
        hasSecretScanning: true,
        hasIaC: false,
        hasSBOM: false,
    },
    recommendedLevel: 2,
};

const mockASVSData: ASVSData = {
    version: '5.0.0',
    chapters: [
        {
            id: 'V1',
            name: 'Architecture',
            sections: [
                {
                    id: '1.1',
                    name: 'Security Hygiene',
                    requirements: [
                        { id: '1.1.1', description: 'Test requirement 1', level: 1 },
                        { id: '1.1.2', description: 'Test requirement 2', level: 2 },
                    ],
                },
            ],
        },
        {
            id: 'V2',
            name: 'Authentication',
            sections: [
                {
                    id: '2.1',
                    name: 'Password Security',
                    requirements: [
                        { id: '2.1.1', description: 'Password length', level: 1 },
                        { id: '2.1.2', description: 'Password complexity', level: 3 },
                    ],
                },
            ],
        },
    ],
};

const mockSPVSData: SPVSData = {
    version: '1.0.0',
    requirements: [
        {
            req_id: 'V1.1.1',
            req_name: 'Threat modeling',
            level: 1,
            category: 'Plan',
            subcategory: 'Threat Assessment',
        },
        {
            req_id: 'V2.1.1',
            req_name: 'Secure coding',
            level: 1,
            category: 'Develop',
            subcategory: 'Secure Coding',
        },
    ],
};

// =============================================================================
// Predicate Evaluation Tests
// =============================================================================

describe('evaluatePredicate', () => {
    describe('always predicate', () => {
        it('should always return true', () => {
            const predicate: RulePredicate = { type: 'always' };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(true);
        });
    });

    describe('level predicate', () => {
        it('should return true when requirement level is at or below max', () => {
            const predicate: RulePredicate = { type: 'level', maxLevel: 2 };
            expect(evaluatePredicate(predicate, mockAttributes, 1)).toBe(true);
            expect(evaluatePredicate(predicate, mockAttributes, 2)).toBe(true);
        });

        it('should return false when requirement level exceeds max', () => {
            const predicate: RulePredicate = { type: 'level', maxLevel: 1 };
            expect(evaluatePredicate(predicate, mockAttributes, 2)).toBe(false);
            expect(evaluatePredicate(predicate, mockAttributes, 3)).toBe(false);
        });

        it('should return true when no requirement level provided', () => {
            const predicate: RulePredicate = { type: 'level', maxLevel: 1 };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(true);
        });
    });

    describe('attribute predicate', () => {
        it('should match when attribute equals value', () => {
            const predicate: RulePredicate = {
                type: 'attribute',
                field: 'appType',
                operator: 'equals',
                value: 'web',
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(true);
        });

        it('should not match when attribute does not equal value', () => {
            const predicate: RulePredicate = {
                type: 'attribute',
                field: 'appType',
                operator: 'equals',
                value: 'api',
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(false);
        });

        it('should match with notEquals operator', () => {
            const predicate: RulePredicate = {
                type: 'attribute',
                field: 'appType',
                operator: 'notEquals',
                value: 'api',
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(true);
        });

        it('should match with in operator', () => {
            const predicate: RulePredicate = {
                type: 'attribute',
                field: 'appType',
                operator: 'in',
                value: ['web', 'api'],
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(true);
        });
    });

    describe('pipelineAttribute predicate', () => {
        it('should match when pipeline field equals value', () => {
            const predicate: RulePredicate = {
                type: 'pipelineAttribute',
                field: 'hasCI',
                equals: true,
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(true);
        });

        it('should not match when pipeline field does not equal value', () => {
            const predicate: RulePredicate = {
                type: 'pipelineAttribute',
                field: 'hasIaC',
                equals: true,
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(false);
        });
    });

    describe('and predicate', () => {
        it('should return true when all conditions are true', () => {
            const predicate: RulePredicate = {
                type: 'and',
                conditions: [
                    { type: 'attribute', field: 'appType', operator: 'equals', value: 'web' },
                    { type: 'attribute', field: 'authType', operator: 'equals', value: 'oauth' },
                ],
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(true);
        });

        it('should return false when any condition is false', () => {
            const predicate: RulePredicate = {
                type: 'and',
                conditions: [
                    { type: 'attribute', field: 'appType', operator: 'equals', value: 'web' },
                    { type: 'attribute', field: 'authType', operator: 'equals', value: 'session' },
                ],
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(false);
        });
    });

    describe('or predicate', () => {
        it('should return true when any condition is true', () => {
            const predicate: RulePredicate = {
                type: 'or',
                conditions: [
                    { type: 'attribute', field: 'appType', operator: 'equals', value: 'api' },
                    { type: 'attribute', field: 'authType', operator: 'equals', value: 'oauth' },
                ],
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(true);
        });

        it('should return false when all conditions are false', () => {
            const predicate: RulePredicate = {
                type: 'or',
                conditions: [
                    { type: 'attribute', field: 'appType', operator: 'equals', value: 'api' },
                    { type: 'attribute', field: 'authType', operator: 'equals', value: 'session' },
                ],
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(false);
        });
    });

    describe('not predicate', () => {
        it('should negate the condition', () => {
            const predicate: RulePredicate = {
                type: 'not',
                condition: {
                    type: 'attribute',
                    field: 'appType',
                    operator: 'equals',
                    value: 'api',
                },
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(true);
        });
    });

    describe('nested predicates', () => {
        it('should evaluate complex nested predicates', () => {
            const predicate: RulePredicate = {
                type: 'and',
                conditions: [
                    { type: 'attribute', field: 'appType', operator: 'equals', value: 'web' },
                    {
                        type: 'or',
                        conditions: [
                            { type: 'attribute', field: 'dataSensitivity', operator: 'equals', value: 'confidential' },
                            { type: 'attribute', field: 'dataSensitivity', operator: 'equals', value: 'regulated' },
                        ],
                    },
                ],
            };
            expect(evaluatePredicate(predicate, mockAttributes)).toBe(true);
        });
    });
});

// =============================================================================
// Rule Evaluation Tests
// =============================================================================

describe('evaluateRules', () => {
    it('should return empty results for empty ruleset', () => {
        const ruleSet: RuleSet = {
            version: '1.0.0',
            description: 'Empty rules',
            rules: [],
        };

        const result = evaluateRules({
            attributes: mockAttributes,
            ruleSet,
            asvsData: mockASVSData,
            spvsData: mockSPVSData,
        });

        expect(result.included).toHaveLength(0);
        expect(result.appliedRules).toHaveLength(0);
    });

    it('should include requirements matching rule predicates', () => {
        const ruleSet: RuleSet = {
            version: '1.0.0',
            description: 'Test rules',
            rules: [
                {
                    id: 'include-v1',
                    description: 'Include V1 chapter',
                    predicate: { type: 'always' },
                    affectsStandard: 'ASVS',
                    includes: { asvs: { chapters: ['V1'] } },
                },
            ],
        };

        const result = evaluateRules({
            attributes: mockAttributes,
            ruleSet,
            asvsData: mockASVSData,
            spvsData: mockSPVSData,
        });

        expect(result.included.length).toBeGreaterThan(0);
        expect(result.included.every((r) => r.standard === 'ASVS')).toBe(true);
        expect(result.appliedRules).toContain('include-v1');
    });

    it('should exclude requirements based on rules', () => {
        const ruleSet: RuleSet = {
            version: '1.0.0',
            description: 'Test rules',
            rules: [
                {
                    id: 'include-all',
                    description: 'Include all',
                    predicate: { type: 'always' },
                    affectsStandard: 'ASVS',
                    includes: { asvs: { chapters: ['V1', 'V2'] } },
                    priority: 1,
                },
                {
                    id: 'exclude-v2',
                    description: 'Exclude V2',
                    predicate: { type: 'always' },
                    affectsStandard: 'ASVS',
                    excludes: { asvs: { chapters: ['V2'] } },
                    priority: 10,
                },
            ],
        };

        const result = evaluateRules({
            attributes: mockAttributes,
            ruleSet,
            asvsData: mockASVSData,
            spvsData: mockSPVSData,
            includeExclusions: true,
        });

        // We should have some requirements included
        expect(result.included.length).toBeGreaterThan(0);
        // Exclusions should be tracked
        expect(result.excluded).toBeDefined();
        // V2 requirements should be in the excluded list since we excluded them
        expect(result.stats.excludedASVS).toBeGreaterThan(0);
        // Applied rules should include both rules
        expect(result.appliedRules).toContain('include-all');
        expect(result.appliedRules).toContain('exclude-v2');
    });

    it('should generate rationale strings', () => {
        const ruleSet: RuleSet = {
            version: '1.0.0',
            description: 'Test rules',
            rules: [
                {
                    id: 'include-v1',
                    description: 'Include architecture requirements',
                    predicate: { type: 'always' },
                    affectsStandard: 'ASVS',
                    includes: { asvs: { chapters: ['V1'] } },
                },
            ],
        };

        const result = evaluateRules({
            attributes: mockAttributes,
            ruleSet,
            asvsData: mockASVSData,
            spvsData: mockSPVSData,
        });

        expect(result.included[0]?.rationale).toBe('Include architecture requirements');
    });

    it('should preserve correct stats', () => {
        const ruleSet: RuleSet = {
            version: '1.0.0',
            description: 'Test rules',
            rules: [
                {
                    id: 'include-all',
                    description: 'Include all',
                    predicate: { type: 'always' },
                    affectsStandard: 'both',
                    includes: {
                        asvs: { chapters: ['V1'] },
                        spvs: { chapters: ['V1'] },
                    },
                },
            ],
        };

        const result = evaluateRules({
            attributes: mockAttributes,
            ruleSet,
            asvsData: mockASVSData,
            spvsData: mockSPVSData,
        });

        expect(result.stats.totalASVS).toBe(4); // 2 requirements in V1, 2 in V2
        expect(result.stats.totalSPVS).toBe(2);
        expect(result.stats.includedASVS).toBeGreaterThan(0);
        expect(result.stats.includedSPVS).toBeGreaterThan(0);
    });
});

// =============================================================================
// Validation Tests
// =============================================================================

describe('validateRuleSet', () => {
    it('should return true for valid ruleset', () => {
        const ruleSet = {
            version: '1.0.0',
            description: 'Valid rules',
            rules: [
                {
                    id: 'test',
                    description: 'Test rule',
                    predicate: { type: 'always' },
                    affectsStandard: 'ASVS',
                },
            ],
        };
        expect(validateRuleSet(ruleSet)).toBe(true);
    });

    it('should return false for invalid ruleset', () => {
        expect(validateRuleSet(null)).toBe(false);
        expect(validateRuleSet({})).toBe(false);
        expect(validateRuleSet({ version: '1.0.0' })).toBe(false);
        expect(validateRuleSet({ version: '1.0.0', rules: 'not-array' })).toBe(false);
    });
});

// =============================================================================
// Determinism Tests
// =============================================================================

describe('determinism', () => {
    it('should produce identical results for identical inputs', () => {
        const ruleSet: RuleSet = {
            version: '1.0.0',
            description: 'Test rules',
            rules: [
                {
                    id: 'include-v1',
                    description: 'Include V1',
                    predicate: { type: 'always' },
                    affectsStandard: 'ASVS',
                    includes: { asvs: { chapters: ['V1'] } },
                },
            ],
        };

        const result1 = evaluateRules({
            attributes: mockAttributes,
            ruleSet,
            asvsData: mockASVSData,
            spvsData: mockSPVSData,
        });

        const result2 = evaluateRules({
            attributes: mockAttributes,
            ruleSet,
            asvsData: mockASVSData,
            spvsData: mockSPVSData,
        });

        expect(result1.included.map((r) => r.requirementId)).toEqual(
            result2.included.map((r) => r.requirementId)
        );
        expect(result1.stats).toEqual(result2.stats);
        expect(result1.appliedRules).toEqual(result2.appliedRules);
    });
});
