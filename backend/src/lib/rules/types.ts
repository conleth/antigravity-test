/**
 * Core types for the Modern RAT rules engine.
 * All shortlisted requirements must include traceability fields.
 */

// =============================================================================
// Standards and Requirements
// =============================================================================

export type Standard = 'ASVS' | 'SPVS';

export interface ShortlistedRequirement {
    /** Which standard this requirement comes from */
    standard: Standard;
    /** Version of the standard (e.g., "5.0.0" for ASVS, "1.0.0" for SPVS) */
    standardVersion: string;
    /** Canonical requirement ID - NEVER generated, always from source */
    requirementId: string;
    /** Human-readable title */
    title: string;
    /** Full description from the standard */
    description: string;
    /** Deterministic explanation of why this requirement is included */
    rationale: string;
    /** Verification/maturity level (1, 2, or 3) */
    level: 1 | 2 | 3;
    /** Tags for filtering: role, platform, category */
    tags: string[];
    /** Chapter/category name for grouping */
    category: string;
    /** Section name for sub-grouping */
    section?: string;
}

export interface ExcludedRequirement {
    /** Which standard this requirement comes from */
    standard: Standard;
    /** Version of the standard */
    standardVersion: string;
    /** Canonical requirement ID */
    requirementId: string;
    /** Human-readable title */
    title: string;
    /** Reason for exclusion */
    exclusionReason: string;
    /** Rule ID that caused exclusion (if applicable) */
    excludedByRule?: string;
}

// =============================================================================
// Derived Attributes (computed from questionnaire answers)
// =============================================================================

export type AppType = 'web' | 'api' | 'mobile' | 'internal' | 'iot' | 'desktop' | 'serverless';
export type AuthType = 'none' | 'session' | 'oauth' | 'sso' | 'basic' | 'apikey' | 'saml';
export type DataSensitivity = 'public' | 'internal' | 'confidential' | 'regulated';
export type InternetExposure = 'public' | 'private' | 'mixed';
export type HostingModel = 'onprem' | 'cloud' | 'hybrid';
export type ComplianceTarget = 'pci' | 'gdpr' | 'soc2' | 'hipaa' | 'nist' | 'iso27001';

export interface PipelineMaturity {
    hasCI: boolean;
    hasSignedArtifacts: boolean;
    hasSecretScanning: boolean;
    hasIaC: boolean;
    hasSBOM: boolean;
}

export interface DerivedAttributes {
    appType: AppType;
    authType: AuthType[];
    dataSensitivity: DataSensitivity;
    internetExposure: InternetExposure;
    hostingModel: HostingModel;
    pipelineMaturity: PipelineMaturity;
    isContainerized: boolean;
    isMultiTenant: boolean;
    complianceTargets: ComplianceTarget[];
    hasLegacySystems: boolean;
    /** Computed recommended level based on risk factors */
    recommendedLevel: 1 | 2 | 3;
}

// =============================================================================
// Rule Predicates (declarative conditions)
// =============================================================================

/** Always include matching requirements */
export interface AlwaysPredicate {
    type: 'always';
}

/** Include if requirement level <= specified level */
export interface LevelPredicate {
    type: 'level';
    maxLevel: 1 | 2 | 3;
}

/** Include if attribute matches value */
export interface AttributePredicate {
    type: 'attribute';
    field: keyof Omit<DerivedAttributes, 'pipelineMaturity' | 'recommendedLevel'>;
    operator: 'equals' | 'notEquals' | 'in';
    value: string | string[];
}

/** Include if pipeline maturity field matches */
export interface PipelineAttributePredicate {
    type: 'pipelineAttribute';
    field: keyof PipelineMaturity;
    equals: boolean;
}

/** All conditions must be true */
export interface AndPredicate {
    type: 'and';
    conditions: RulePredicate[];
}

/** At least one condition must be true */
export interface OrPredicate {
    type: 'or';
    conditions: RulePredicate[];
}

/** Negation of a condition */
export interface NotPredicate {
    type: 'not';
    condition: RulePredicate;
}

export type RulePredicate =
    | AlwaysPredicate
    | LevelPredicate
    | AttributePredicate
    | PipelineAttributePredicate
    | AndPredicate
    | OrPredicate
    | NotPredicate;

// =============================================================================
// Rules
// =============================================================================

export interface RequirementSelector {
    /** Include specific chapters (e.g., ["V1", "V3"]) */
    chapters?: string[];
    /** Include specific sections (e.g., ["1.1", "3.2"]) */
    sections?: string[];
    /** Include specific requirement IDs */
    requirementIds?: string[];
    /** Include requirements with specific tags */
    tags?: string[];
    /** Exclude specific requirement IDs */
    excludeIds?: string[];
}

export interface Rule {
    /** Unique rule identifier */
    id: string;
    /** Human-readable description of what this rule does */
    description: string;
    /** When this rule applies */
    predicate: RulePredicate;
    /** Which standard(s) this rule affects */
    affectsStandard: Standard | 'both';
    /** What to include when predicate is true */
    includes?: {
        asvs?: RequirementSelector;
        spvs?: RequirementSelector;
    };
    /** What to exclude when predicate is true */
    excludes?: {
        asvs?: RequirementSelector;
        spvs?: RequirementSelector;
    };
    /** Priority for conflict resolution (higher = more important) */
    priority?: number;
}

export interface RuleSet {
    version: string;
    description: string;
    rules: Rule[];
}

// =============================================================================
// Raw Data Types (from source files)
// =============================================================================

export interface ASVSRequirement {
    id: string;
    description: string;
    level: 1 | 2 | 3;
    cwe?: string[];
    nist?: string[];
}

export interface ASVSSection {
    id: string;
    name: string;
    requirements: ASVSRequirement[];
}

export interface ASVSChapter {
    id: string;
    name: string;
    sections: ASVSSection[];
}

export interface ASVSData {
    version: string;
    chapters: ASVSChapter[];
}

export interface SPVSRequirement {
    req_id: string;
    req_name: string;
    level: 1 | 2 | 3;
    category: string;
    subcategory: string;
    nist?: string;
    owasp_cicd?: string;
    cwe?: string;
}

export interface SPVSData {
    version: string;
    requirements: SPVSRequirement[];
}

// =============================================================================
// Engine Results
// =============================================================================

export interface ShortlistResult {
    /** Derived attributes used for filtering */
    attributes: DerivedAttributes;
    /** Requirements that passed all rules */
    included: ShortlistedRequirement[];
    /** Requirements that were excluded (optional, for transparency) */
    excluded?: ExcludedRequirement[];
    /** Summary statistics */
    stats: {
        totalASVS: number;
        totalSPVS: number;
        includedASVS: number;
        includedSPVS: number;
        excludedASVS: number;
        excludedSPVS: number;
    };
    /** Rules that were applied */
    appliedRules: string[];
}
