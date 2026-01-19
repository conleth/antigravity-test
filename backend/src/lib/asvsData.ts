/**
 * ASVS Data Loader
 * 
 * Loads and parses ASVS requirements from JSON files.
 * Preserves canonical ID format: v{version}-{chapter}.{section}.{requirement}
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ASVSData, ASVSChapter, ASVSSection, ASVSRequirement } from './rules/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cache loaded data
let cachedASVSData: ASVSData | null = null;

/**
 * Load ASVS data from the JSON file.
 */
export function loadASVSData(version: string = '5.0.0'): ASVSData {
    if (cachedASVSData && cachedASVSData.version === version) {
        return cachedASVSData;
    }

    const filePath = join(__dirname, '..', 'data', `asvs-${version}.json`);

    try {
        const rawData = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(rawData) as ASVSData;

        // Validate structure
        if (!data.version || !Array.isArray(data.chapters)) {
            throw new Error('Invalid ASVS data structure');
        }

        cachedASVSData = data;
        return data;
    } catch (error) {
        throw new Error(`Failed to load ASVS data for version ${version}: ${error}`);
    }
}

/**
 * Get total count of ASVS requirements.
 */
export function getASVSRequirementCount(data: ASVSData): number {
    let count = 0;
    for (const chapter of data.chapters) {
        for (const section of chapter.sections) {
            count += section.requirements.length;
        }
    }
    return count;
}

/**
 * Get all ASVS chapter IDs.
 */
export function getASVSChapterIds(data: ASVSData): string[] {
    return data.chapters.map((c) => c.id);
}

/**
 * Find a specific requirement by ID.
 * ID format: {chapter}.{section}.{requirement} e.g., "2.1.1"
 */
export function findASVSRequirement(
    data: ASVSData,
    id: string
): { requirement: ASVSRequirement; chapter: ASVSChapter; section: ASVSSection } | undefined {
    const parts = id.split('.');
    if (parts.length !== 3) return undefined;

    const chapterId = `V${parts[0]}`;
    const sectionId = `${parts[0]}.${parts[1]}`;
    const reqId = id;

    for (const chapter of data.chapters) {
        if (chapter.id === chapterId) {
            for (const section of chapter.sections) {
                if (section.id === sectionId) {
                    const req = section.requirements.find((r) => r.id === reqId);
                    if (req) {
                        return { requirement: req, chapter, section };
                    }
                }
            }
        }
    }

    return undefined;
}

/**
 * Get requirements by level.
 */
export function getASVSRequirementsByLevel(
    data: ASVSData,
    maxLevel: 1 | 2 | 3
): ASVSRequirement[] {
    const results: ASVSRequirement[] = [];

    for (const chapter of data.chapters) {
        for (const section of chapter.sections) {
            for (const req of section.requirements) {
                if (req.level <= maxLevel) {
                    results.push(req);
                }
            }
        }
    }

    return results;
}

/**
 * Get requirements by chapter.
 */
export function getASVSRequirementsByChapter(
    data: ASVSData,
    chapterIds: string[]
): ASVSRequirement[] {
    const results: ASVSRequirement[] = [];

    for (const chapter of data.chapters) {
        if (chapterIds.includes(chapter.id)) {
            for (const section of chapter.sections) {
                results.push(...section.requirements);
            }
        }
    }

    return results;
}

/**
 * Validate ASVS ID format.
 * Valid format: v{version}-{chapter}.{section}.{requirement}
 * e.g., v5.0.0-1.2.3
 */
export function validateASVSId(id: string): boolean {
    const pattern = /^v\d+\.\d+\.\d+-\d+\.\d+\.\d+$/;
    return pattern.test(id);
}

/**
 * Generate full ASVS ID from short ID.
 */
export function toFullASVSId(shortId: string, version: string = '5.0.0'): string {
    return `v${version}-${shortId}`;
}
