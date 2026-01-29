/**
 * Rules Engine - Evaluates declarative rules against derived attributes
 * to produce a deterministic shortlist of requirements.
 * 
 * Key invariants:
 * - Same inputs always produce same outputs (deterministic)
 * - All requirement IDs are preserved from source standards
 * - Rationale strings are generated from rule descriptions
 */

import type {
    DerivedAttributes,
    RulePredicate,
    RuleSet,
    ShortlistedRequirement,
    ExcludedRequirement,
    ShortlistResult,
    ASVSData,
    ASVSChapter,
    ASVSSection,
    ASVSRequirement,
    SPVSData,
    SPVSRequirement,
    RequirementSelector,
} from './types.js';
import { getRolesForRequirement } from './roleMapper.js';

// =============================================================================
// Predicate Evaluation
// =============================================================================

/**
 * Evaluates a rule predicate against derived attributes.
 * Returns true if the predicate matches.
 */
export function evaluatePredicate(
    predicate: RulePredicate,
    attributes: DerivedAttributes,
    requirementLevel?: 1 | 2 | 3
): boolean {
    switch (predicate.type) {
        case 'always':
            return true;

        case 'level':
            // If no requirement level provided, assume it matches
            if (requirementLevel === undefined) return true;
            return requirementLevel <= predicate.maxLevel;

        case 'attribute': {
            const attrValue = attributes[predicate.field];
            if (predicate.operator === 'equals') {
                return attrValue === predicate.value;
            }
            if (predicate.operator === 'notEquals') {
                return attrValue !== predicate.value;
            }
            if (predicate.operator === 'in') {
                return Array.isArray(predicate.value) && predicate.value.includes(String(attrValue));
            }
            return false;
        }

        case 'pipelineAttribute': {
            const pipelineValue = attributes.pipelineMaturity[predicate.field];
            return pipelineValue === predicate.equals;
        }

        case 'and':
            return predicate.conditions.every((cond) =>
                evaluatePredicate(cond, attributes, requirementLevel)
            );

        case 'or':
            return predicate.conditions.some((cond) =>
                evaluatePredicate(cond, attributes, requirementLevel)
            );

        case 'not':
            return !evaluatePredicate(predicate.condition, attributes, requirementLevel);

        default:
            // Exhaustive check
            const _exhaustive: never = predicate;
            throw new Error(`Unknown predicate type: ${JSON.stringify(_exhaustive)}`);
    }
}

// =============================================================================
// Requirement Matching
// =============================================================================

interface RequirementMeta {
    id: string;
    chapterId: string;
    sectionId: string;
    level: 1 | 2 | 3;
    tags: string[];
}

/**
 * Checks if a requirement matches a selector.
 */
function matchesSelector(
    req: RequirementMeta,
    selector: RequirementSelector
): boolean {
    // Check exclusions first
    if (selector.excludeIds?.includes(req.id)) {
        return false;
    }

    // If no positive selectors, don't match
    const hasPositiveSelector =
        selector.chapters?.length ||
        selector.sections?.length ||
        selector.requirementIds?.length ||
        selector.tags?.length;

    if (!hasPositiveSelector) {
        return false;
    }

    // Check chapters
    if (selector.chapters?.length && !selector.chapters.includes(req.chapterId)) {
        return false;
    }

    // Check sections
    if (selector.sections?.length && !selector.sections.includes(req.sectionId)) {
        return false;
    }

    // Check specific IDs
    if (selector.requirementIds?.length && !selector.requirementIds.includes(req.id)) {
        return false;
    }

    // Check tags (requirement must have at least one of the specified tags)
    if (selector.tags?.length) {
        const hasMatchingTag = req.tags.some((tag) => selector.tags!.includes(tag));
        if (!hasMatchingTag) {
            return false;
        }
    }

    return true;
}

// =============================================================================
// ASVS Processing
// =============================================================================

interface ProcessedASVSRequirement {
    original: ASVSRequirement;
    chapter: ASVSChapter;
    section: ASVSSection;
    fullId: string; // e.g., "v5.0.0-1.2.3"
}

function processASVSData(data: ASVSData): ProcessedASVSRequirement[] {
    const results: ProcessedASVSRequirement[] = [];

    for (const chapter of data.chapters) {
        for (const section of chapter.sections) {
            for (const req of section.requirements) {
                results.push({
                    original: req,
                    chapter,
                    section,
                    fullId: `v${data.version}-${req.id}`,
                });
            }
        }
    }

    return results;
}

function asvsToShortlisted(
    req: ProcessedASVSRequirement,
    version: string,
    rationale: string,
    tags: string[]
): ShortlistedRequirement {
    return {
        standard: 'ASVS',
        standardVersion: version,
        requirementId: req.fullId,
        title: `${req.chapter.name} - ${req.section.name}`,
        description: req.original.description,
        rationale,
        level: req.original.level,
        tags: [
            ...tags,
            ...getRolesForRequirement({
                description: req.original.description,
                category: req.chapter.name,
                section: req.section.name,
                standard: 'ASVS',
            }).map((r) => `role:${r}`),
        ],
        category: req.chapter.name,
        section: req.section.name,
    };
}

// =============================================================================
// SPVS Processing
// =============================================================================

function spvsToShortlisted(
    req: SPVSRequirement,
    version: string,
    rationale: string,
    tags: string[]
): ShortlistedRequirement {
    return {
        standard: 'SPVS',
        standardVersion: version,
        requirementId: req.req_id,
        title: req.req_name,
        description: req.req_name, // SPVS uses req_name as description
        rationale,
        level: req.level,
        tags: [...tags, ...getRolesForRequirement({ ...req, standard: 'SPVS', category: req.category }).map(r => `role:${r}`)],
        category: req.category,
        section: req.subcategory,
    };
}

// =============================================================================
// Main Engine
// =============================================================================

export interface RulesEngineInput {
    attributes: DerivedAttributes;
    ruleSet: RuleSet;
    asvsData: ASVSData;
    spvsData: SPVSData;
    includeExclusions?: boolean;
}

/**
 * Main rules engine entry point.
 * Takes derived attributes and applies declarative rules to produce a shortlist.
 */
export function evaluateRules(input: RulesEngineInput): ShortlistResult {
    const { attributes, ruleSet, asvsData, spvsData, includeExclusions = false } = input;

    // Process ASVS requirements into flat list
    const allASVS = processASVSData(asvsData);
    const allSPVS = spvsData.requirements;

    // Track which requirements are included/excluded and why
    const asvsIncluded = new Map<string, { req: ProcessedASVSRequirement; rules: string[] }>();
    const asvsExcluded = new Map<string, { req: ProcessedASVSRequirement; reason: string; rule: string }>();
    const spvsIncluded = new Map<string, { req: SPVSRequirement; rules: string[] }>();
    const spvsExcluded = new Map<string, { req: SPVSRequirement; reason: string; rule: string }>();

    // Sort rules by priority (higher first)
    const sortedRules = [...ruleSet.rules].sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );

    const appliedRules: string[] = [];

    // Evaluate each rule
    for (const rule of sortedRules) {
        // Check if rule predicate matches
        if (!evaluatePredicate(rule.predicate, attributes)) {
            continue;
        }

        appliedRules.push(rule.id);

        // Process ASVS inclusions
        if (rule.includes?.asvs && (rule.affectsStandard === 'ASVS' || rule.affectsStandard === 'both')) {
            for (const asvsReq of allASVS) {
                const meta: RequirementMeta = {
                    id: asvsReq.original.id,
                    chapterId: asvsReq.chapter.id,
                    sectionId: `${asvsReq.chapter.id}.${asvsReq.section.id}`,
                    level: asvsReq.original.level,
                    tags: [], // TODO: Add tag extraction
                };

                // Check level predicate if present
                const levelMatches = evaluatePredicate(rule.predicate, attributes, asvsReq.original.level);
                if (!levelMatches) continue;

                if (matchesSelector(meta, rule.includes.asvs)) {
                    const existing = asvsIncluded.get(asvsReq.fullId);
                    if (existing) {
                        existing.rules.push(rule.id);
                    } else {
                        asvsIncluded.set(asvsReq.fullId, { req: asvsReq, rules: [rule.id] });
                    }
                }
            }
        }

        // Process ASVS exclusions
        if (rule.excludes?.asvs && (rule.affectsStandard === 'ASVS' || rule.affectsStandard === 'both')) {
            for (const asvsReq of allASVS) {
                const meta: RequirementMeta = {
                    id: asvsReq.original.id,
                    chapterId: asvsReq.chapter.id,
                    sectionId: `${asvsReq.chapter.id}.${asvsReq.section.id}`,
                    level: asvsReq.original.level,
                    tags: [],
                };

                if (matchesSelector(meta, rule.excludes.asvs)) {
                    asvsIncluded.delete(asvsReq.fullId);
                    asvsExcluded.set(asvsReq.fullId, {
                        req: asvsReq,
                        reason: rule.description,
                        rule: rule.id,
                    });
                }
            }
        }

        // Process SPVS inclusions
        if (rule.includes?.spvs && (rule.affectsStandard === 'SPVS' || rule.affectsStandard === 'both')) {
            for (const spvsReq of allSPVS) {
                // Extract stage from req_id (e.g., "V2.3.5" -> "V2")
                const stageMatch = spvsReq.req_id.match(/^(V\d)/);
                const stageId = stageMatch?.[1] ?? '';

                const meta: RequirementMeta = {
                    id: spvsReq.req_id,
                    chapterId: stageId,
                    sectionId: spvsReq.subcategory,
                    level: spvsReq.level,
                    tags: [],
                };

                const levelMatches = evaluatePredicate(rule.predicate, attributes, spvsReq.level);
                if (!levelMatches) continue;

                if (matchesSelector(meta, rule.includes.spvs)) {
                    const existing = spvsIncluded.get(spvsReq.req_id);
                    if (existing) {
                        existing.rules.push(rule.id);
                    } else {
                        spvsIncluded.set(spvsReq.req_id, { req: spvsReq, rules: [rule.id] });
                    }
                }
            }
        }

        // Process SPVS exclusions
        if (rule.excludes?.spvs && (rule.affectsStandard === 'SPVS' || rule.affectsStandard === 'both')) {
            for (const spvsReq of allSPVS) {
                const stageMatch = spvsReq.req_id.match(/^(V\d)/);
                const stageId = stageMatch?.[1] ?? '';

                const meta: RequirementMeta = {
                    id: spvsReq.req_id,
                    chapterId: stageId,
                    sectionId: spvsReq.subcategory,
                    level: spvsReq.level,
                    tags: [],
                };

                if (matchesSelector(meta, rule.excludes.spvs)) {
                    spvsIncluded.delete(spvsReq.req_id);
                    spvsExcluded.set(spvsReq.req_id, {
                        req: spvsReq,
                        reason: rule.description,
                        rule: rule.id,
                    });
                }
            }
        }
    }

    // Generate rationale strings
    function generateRationale(ruleIds: string[]): string {
        const ruleDescs = ruleIds
            .map((id) => ruleSet.rules.find((r) => r.id === id)?.description)
            .filter(Boolean);
        return ruleDescs.join('; ');
    }

    // Convert to output format
    const included: ShortlistedRequirement[] = [];

    for (const [, { req, rules }] of asvsIncluded) {
        included.push(
            asvsToShortlisted(
                req,
                asvsData.version,
                generateRationale(rules),
                []
            )
        );
    }

    for (const [, { req, rules }] of spvsIncluded) {
        included.push(
            spvsToShortlisted(
                req,
                spvsData.version,
                generateRationale(rules),
                []
            )
        );
    }

    // Build excluded list if requested
    let excluded: ExcludedRequirement[] | undefined;
    if (includeExclusions) {
        excluded = [];

        for (const [, { req, reason, rule }] of asvsExcluded) {
            excluded.push({
                standard: 'ASVS',
                standardVersion: asvsData.version,
                requirementId: req.fullId,
                title: `${req.chapter.name} - ${req.section.name}`,
                exclusionReason: reason,
                excludedByRule: rule,
            });
        }

        for (const [, { req, reason, rule }] of spvsExcluded) {
            excluded.push({
                standard: 'SPVS',
                standardVersion: spvsData.version,
                requirementId: req.req_id,
                title: req.req_name,
                exclusionReason: reason,
                excludedByRule: rule,
            });
        }
    }

    return {
        attributes,
        included,
        excluded,
        stats: {
            totalASVS: allASVS.length,
            totalSPVS: allSPVS.length,
            includedASVS: asvsIncluded.size,
            includedSPVS: spvsIncluded.size,
            excludedASVS: asvsExcluded.size,
            excludedSPVS: spvsExcluded.size,
        },
        appliedRules,
    };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Validates that a rule set has valid structure.
 */
export function validateRuleSet(ruleSet: unknown): ruleSet is RuleSet {
    if (typeof ruleSet !== 'object' || ruleSet === null) return false;
    const rs = ruleSet as Record<string, unknown>;

    if (typeof rs.version !== 'string') return false;
    if (!Array.isArray(rs.rules)) return false;

    // Basic rule validation
    for (const rule of rs.rules) {
        if (typeof rule !== 'object' || rule === null) return false;
        const r = rule as Record<string, unknown>;
        if (typeof r.id !== 'string') return false;
        if (typeof r.description !== 'string') return false;
        if (typeof r.predicate !== 'object') return false;
        if (!['ASVS', 'SPVS', 'both'].includes(r.affectsStandard as string)) return false;
    }

    return true;
}
