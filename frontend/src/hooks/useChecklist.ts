import { useState, useCallback, useEffect } from 'react';
import {
    getChecklist,
    exportChecklist,
    downloadBlob,
    type ChecklistResponse,
    type ShortlistedRequirement,
} from '@/lib/api';

export interface ChecklistFilters {
    standard: 'all' | 'ASVS' | 'SPVS';
    level: 'all' | 1 | 2 | 3;
    category: string | null;
    search: string;
}

export interface ChecklistState {
    data: ChecklistResponse | null;
    selectedIds: Set<string>;
    filters: ChecklistFilters;
    isLoading: boolean;
    isExporting: boolean;
    error: string | null;
}

export function useChecklist(sessionId: string | null) {
    const [state, setState] = useState<ChecklistState>({
        data: null,
        selectedIds: new Set(),
        filters: {
            standard: 'all',
            level: 'all',
            category: null,
            search: '',
        },
        isLoading: false,
        isExporting: false,
        error: null,
    });

    // Load checklist when sessionId changes
    useEffect(() => {
        if (sessionId) {
            loadChecklist(sessionId);
        }
    }, [sessionId]);

    const loadChecklist = async (sid: string) => {
        try {
            setState((s) => ({ ...s, isLoading: true, error: null }));
            const response = await getChecklist(sid, false);
            setState((s) => ({ ...s, data: response, isLoading: false }));
        } catch (err) {
            setState((s) => ({
                ...s,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Failed to load checklist',
            }));
        }
    };

    const setFilter = useCallback(
        <K extends keyof ChecklistFilters>(key: K, value: ChecklistFilters[K]) => {
            setState((s) => ({
                ...s,
                filters: { ...s.filters, [key]: value },
            }));
        },
        []
    );

    const toggleSelection = useCallback((requirementId: string) => {
        setState((s) => {
            const newSet = new Set(s.selectedIds);
            if (newSet.has(requirementId)) {
                newSet.delete(requirementId);
            } else {
                newSet.add(requirementId);
            }
            return { ...s, selectedIds: newSet };
        });
    }, []);

    const selectAll = useCallback(() => {
        setState((s) => {
            if (!s.data) return s;
            const filtered = getFilteredRequirements(s.data.included, s.filters);
            const allIds = new Set(filtered.map((r) => r.requirementId));
            return { ...s, selectedIds: allIds };
        });
    }, []);

    const clearSelection = useCallback(() => {
        setState((s) => ({ ...s, selectedIds: new Set() }));
    }, []);

    const doExport = useCallback(
        async (format: 'json' | 'csv' | 'markdown') => {
            if (!sessionId) return;
            try {
                setState((s) => ({ ...s, isExporting: true }));
                const blob = await exportChecklist(sessionId, format);
                const ext = format === 'markdown' ? 'md' : format;
                downloadBlob(blob, `security-checklist.${ext}`);
                setState((s) => ({ ...s, isExporting: false }));
            } catch (err) {
                setState((s) => ({
                    ...s,
                    isExporting: false,
                    error: err instanceof Error ? err.message : 'Export failed',
                }));
            }
        },
        [sessionId]
    );

    // Filter requirements
    const filteredRequirements = state.data
        ? getFilteredRequirements(state.data.included, state.filters)
        : [];

    // Get unique categories
    const categories = state.data
        ? [...new Set(state.data.included.map((r) => r.category))].sort()
        : [];

    return {
        ...state,
        filteredRequirements,
        categories,
        setFilter,
        toggleSelection,
        selectAll,
        clearSelection,
        export: doExport,
        reload: () => sessionId && loadChecklist(sessionId),
    };
}

function getFilteredRequirements(
    requirements: ShortlistedRequirement[],
    filters: ChecklistFilters
): ShortlistedRequirement[] {
    return requirements.filter((req) => {
        // Standard filter
        if (filters.standard !== 'all' && req.standard !== filters.standard) {
            return false;
        }

        // Level filter
        if (filters.level !== 'all' && req.level !== filters.level) {
            return false;
        }

        // Category filter
        if (filters.category && req.category !== filters.category) {
            return false;
        }

        // Search filter
        if (filters.search) {
            const search = filters.search.toLowerCase();
            const matchesId = req.requirementId.toLowerCase().includes(search);
            const matchesTitle = req.title.toLowerCase().includes(search);
            const matchesDesc = req.description.toLowerCase().includes(search);
            if (!matchesId && !matchesTitle && !matchesDesc) {
                return false;
            }
        }

        return true;
    });
}
