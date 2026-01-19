import { useState, useCallback, useEffect } from 'react';
import {
    getChecklist,
    exportChecklist,
    downloadBlob,
    type ChecklistResponse,
    type ShortlistedRequirement,
} from '@/lib/api';

export interface ChecklistFilters {
    asvsLevel: 'all' | 1 | 2 | 3 | 'none';
    spvsLevel: 'all' | 1 | 2 | 3 | 'none';
    category: string | null;
    status: 'all' | 'selected' | 'unselected';
    role: string | null;
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
            asvsLevel: 'all',
            spvsLevel: 'all',
            category: null,
            status: 'all',
            role: null,
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
            const filtered = getFilteredRequirements(s.data.included, s.filters, s.selectedIds);
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
        ? getFilteredRequirements(state.data.included, state.filters, state.selectedIds)
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
    filters: ChecklistFilters,
    selectedIds: Set<string>
): ShortlistedRequirement[] {
    return requirements.filter((req) => {
        // ASVS Filter Logic
        let asvsMatch = false;
        if (req.standard === 'ASVS') {
            if (filters.asvsLevel === 'all') {
                asvsMatch = true;
            } else if (filters.asvsLevel !== 'none' && req.level <= filters.asvsLevel) {
                asvsMatch = true;
            }
        }

        // SPVS Filter Logic
        let spvsMatch = false;
        if (req.standard === 'SPVS') {
            if (filters.spvsLevel === 'all') {
                spvsMatch = true;
            } else if (filters.spvsLevel !== 'none' && req.level <= filters.spvsLevel) {
                spvsMatch = true;
            }
        }

        // Combine Standards: If neither matched (meaning excluded by level or 'none'), return false
        // Note: A requirement is only ONE standard. So strict OR check.
        if (!asvsMatch && !spvsMatch) {
            return false;
        }

        // Category filter
        if (filters.category && req.category !== filters.category) {
            return false;
        }

        // Role filter
        if (filters.role && filters.role !== 'all') {
            if (!req.tags || !req.tags.includes(filters.role)) {
                return false;
            }
        }

        // Status filter
        if (filters.status === 'selected' && !selectedIds.has(req.requirementId)) {
            return false;
        }
        if (filters.status === 'unselected' && selectedIds.has(req.requirementId)) {
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
