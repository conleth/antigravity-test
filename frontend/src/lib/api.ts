const API_BASE = '/api';

export interface Question {
    id: string;
    text: string;
    helpText?: string;
    type: 'single-select' | 'multi-select' | 'boolean' | 'text';
    required: boolean;
    options?: { value: string; label: string; description?: string }[];
    mapsTo: string;
    order: number;
}

export interface QuestionsResponse {
    version: string;
    questions: Question[];
}

export interface DerivedAttributes {
    appType: string;
    authType: string;
    dataSensitivity: string;
    internetExposure: string;
    hostingModel: string;
    pipelineMaturity: {
        hasCI: boolean;
        hasSignedArtifacts: boolean;
        hasSecretScanning: boolean;
        hasIaC: boolean;
        hasSBOM: boolean;
    };
    recommendedLevel: 1 | 2 | 3;
}

export interface QuestionnaireSubmitResponse {
    sessionId: string;
    attributes: DerivedAttributes;
    recommendedLevel: 1 | 2 | 3;
    createdAt: string;
}

export interface ShortlistedRequirement {
    standard: 'ASVS' | 'SPVS';
    standardVersion: string;
    requirementId: string;
    title: string;
    description: string;
    rationale: string;
    level: 1 | 2 | 3;
    tags: string[];
    category: string;
    section?: string;
}

export interface ExcludedRequirement {
    standard: 'ASVS' | 'SPVS';
    standardVersion: string;
    requirementId: string;
    title: string;
    exclusionReason: string;
    excludedByRule?: string;
}

export interface ChecklistResponse {
    sessionId: string;
    attributes: DerivedAttributes;
    included: ShortlistedRequirement[];
    excluded?: ExcludedRequirement[];
    stats: {
        totalASVS: number;
        totalSPVS: number;
        includedASVS: number;
        includedSPVS: number;
        excludedASVS: number;
        excludedSPVS: number;
    };
    appliedRules: string[];
}

export interface ExclusionsResponse {
    sessionId: string;
    excluded: ExcludedRequirement[];
    stats: {
        excludedASVS: number;
        excludedSPVS: number;
    };
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || 'API request failed');
    }

    return response.json();
}

export async function getQuestions(): Promise<QuestionsResponse> {
    return fetchJson<QuestionsResponse>(`${API_BASE}/questions`);
}

export async function submitQuestionnaire(
    answers: Record<string, string | boolean | string[]>,
    sessionId?: string
): Promise<QuestionnaireSubmitResponse> {
    return fetchJson<QuestionnaireSubmitResponse>(`${API_BASE}/questionnaire/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers, sessionId }),
    });
}

export async function getChecklist(
    sessionId: string,
    includeExclusions = false
): Promise<ChecklistResponse> {
    const params = new URLSearchParams({
        sessionId,
        includeExclusions: String(includeExclusions),
    });
    return fetchJson<ChecklistResponse>(`${API_BASE}/checklist?${params}`);
}

export async function getExclusions(sessionId: string): Promise<ExclusionsResponse> {
    return fetchJson<ExclusionsResponse>(`${API_BASE}/exclusions?sessionId=${sessionId}`);
}

export async function exportChecklist(
    sessionId: string,
    format: 'json' | 'csv' | 'markdown'
): Promise<Blob> {
    const response = await fetch(
        `${API_BASE}/checklist/export/${format}?sessionId=${sessionId}`
    );

    if (!response.ok) {
        throw new Error('Export failed');
    }

    return response.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
