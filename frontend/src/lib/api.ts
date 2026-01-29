const API_BASE = '/api';

export interface QuestionOption {
    value: string;
    label: string;
    description?: string;
}

export interface QuestionCondition {
    questionId: string;
    operator: 'equals' | 'notEquals' | 'in';
    value: any;
}

export interface Question {
    id: string;
    text: string;
    helpText?: string;
    type: 'single-select' | 'multi-select' | 'boolean' | 'text';
    required: boolean;
    options?: QuestionOption[];
    condition?: QuestionCondition;
    mapsTo: string;
    order: number;
}

export interface QuestionsResponse {
    version: string;
    questions: Question[];
}

export interface DerivedAttributes {
    appType: string;
    authType: string[];
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
    isContainerized: boolean;
    isMultiTenant: boolean;
    complianceTargets: string[];
    hasLegacySystems: boolean;
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
    selectedIds: string[];
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
        let errorMessage = error.error || 'API request failed';
        if (error.details && Array.isArray(error.details)) {
            errorMessage += `: ${error.details.join(', ')}`;
        }
        throw new Error(errorMessage);
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
export async function updateSelection(
    sessionId: string,
    selectedIds: string[]
): Promise<void> {
    await fetchJson(`${API_BASE}/checklist/selection`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, selectedIds }),
    });
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
// =============================================================================
// Ticketing API
// =============================================================================

export interface TicketingAdapterInfo {
    name: string;
    displayName: string;
}

export interface TicketReference {
    ticketId: string;
    ticketUrl: string;
    system: string;
    createdAt: string;
}

export interface CreateTicketsResponse {
    created: number;
    tickets: TicketReference[];
}

export async function getTicketingAdapters(): Promise<TicketingAdapterInfo[]> {
    const data = await fetchJson<{ adapters: TicketingAdapterInfo[] }>(`${API_BASE}/ticketing/adapters`);
    return data.adapters;
}

export async function getTicketingAuthStatus(adapter: string): Promise<boolean> {
    const data = await fetchJson<{ authenticated: boolean }>(`${API_BASE}/ticketing/${adapter}/auth/status`);
    return data.authenticated;
}

export async function getTicketingAuthUrl(adapter: string, redirectUri?: string): Promise<{ url: string; state: string }> {
    const params = redirectUri ? `?redirectUri=${encodeURIComponent(redirectUri)}` : '';
    return fetchJson<{ url: string; state: string }>(`${API_BASE}/ticketing/${adapter}/auth/url${params}`);
}

export async function createTickets(params: {
    sessionId: string;
    requirementIds: string[];
    adapterName: string;
    options?: {
        project?: string;
        priority?: 'low' | 'medium' | 'high' | 'critical';
        labels?: string[];
    };
}): Promise<CreateTicketsResponse> {
    return fetchJson<CreateTicketsResponse>(`${API_BASE}/ticketing/create`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
}
