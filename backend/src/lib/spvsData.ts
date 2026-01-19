/**
 * SPVS Data Loader
 * 
 * Loads and parses SPVS requirements from CSV files.
 * Preserves canonical ID format: V{stage}.{category}.{requirement}
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import type { SPVSData, SPVSRequirement } from './rules/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cache loaded data
let cachedSPVSData: SPVSData | null = null;

interface RawSPVSRow {
    req_id: string;
    category: string;
    subcategory: string;
    req_name: string;
    level: string;
    NIST: string;
    OWASP_CICD: string;
    CWE: string;
}

/**
 * Parse level string to number.
 */
function parseLevel(level: string): 1 | 2 | 3 {
    const parsed = parseInt(level, 10);
    if (parsed === 1 || parsed === 2 || parsed === 3) {
        return parsed;
    }
    return 1; // Default to L1
}

/**
 * Load SPVS data from the CSV file.
 */
export function loadSPVSData(version: string = '1.0.0'): SPVSData {
    if (cachedSPVSData && cachedSPVSData.version === version) {
        return cachedSPVSData;
    }

    const filePath = join(__dirname, '..', 'data', `spvs-${version}.csv`);

    try {
        const rawData = readFileSync(filePath, 'utf-8');
        const rows = parse(rawData, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        }) as RawSPVSRow[];

        const requirements: SPVSRequirement[] = rows
            .filter((row) => row.req_id && row.req_id.startsWith('V'))
            .map((row) => ({
                req_id: row.req_id,
                req_name: row.req_name,
                level: parseLevel(row.level),
                category: row.category,
                subcategory: row.subcategory,
                nist: row.NIST || undefined,
                owasp_cicd: row.OWASP_CICD || undefined,
                cwe: row.CWE || undefined,
            }));

        cachedSPVSData = {
            version,
            requirements,
        };

        return cachedSPVSData;
    } catch (error) {
        throw new Error(`Failed to load SPVS data for version ${version}: ${error}`);
    }
}

/**
 * Get total count of SPVS requirements.
 */
export function getSPVSRequirementCount(data: SPVSData): number {
    return data.requirements.length;
}

/**
 * Get all SPVS stage IDs.
 */
export function getSPVSStageIds(data: SPVSData): string[] {
    const stages = new Set<string>();
    for (const req of data.requirements) {
        const match = req.req_id.match(/^(V\d)/);
        if (match && match[1]) {
            stages.add(match[1]);
        }
    }
    return Array.from(stages).sort();
}

/**
 * Get all SPVS categories.
 */
export function getSPVSCategories(data: SPVSData): string[] {
    const categories = new Set<string>();
    for (const req of data.requirements) {
        categories.add(req.category);
    }
    return Array.from(categories).sort();
}

/**
 * Find a specific requirement by ID.
 */
export function findSPVSRequirement(
    data: SPVSData,
    id: string
): SPVSRequirement | undefined {
    return data.requirements.find((r) => r.req_id === id);
}

/**
 * Get requirements by level.
 */
export function getSPVSRequirementsByLevel(
    data: SPVSData,
    maxLevel: 1 | 2 | 3
): SPVSRequirement[] {
    return data.requirements.filter((r) => r.level <= maxLevel);
}

/**
 * Get requirements by stage.
 */
export function getSPVSRequirementsByStage(
    data: SPVSData,
    stageIds: string[]
): SPVSRequirement[] {
    return data.requirements.filter((r) => {
        const match = r.req_id.match(/^(V\d)/);
        return match ? stageIds.includes(match[1]!) : false;
    });
}

/**
 * Get requirements by category.
 */
export function getSPVSRequirementsByCategory(
    data: SPVSData,
    categories: string[]
): SPVSRequirement[] {
    return data.requirements.filter((r) => categories.includes(r.category));
}

/**
 * Validate SPVS ID format.
 * Valid format: V{stage}.{category}.{requirement}
 * e.g., V2.3.5
 */
export function validateSPVSId(id: string): boolean {
    const pattern = /^V\d+\.\d+\.\d+$/;
    return pattern.test(id);
}

/**
 * Get SPVS stage name from stage ID.
 */
export function getSPVSStageName(stageId: string): string {
    const stageNames: Record<string, string> = {
        V1: 'Plan',
        V2: 'Develop',
        V3: 'Integrate',
        V4: 'Release',
        V5: 'Operate',
    };
    return stageNames[stageId] ?? 'Unknown';
}
