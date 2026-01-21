
import { describe, it, expect } from 'vitest';

interface Requirement {
    id: string;
    description: string;
}

// Logic under test: The Scoping Model
// Excluded = All Requirements - Selected Requirements
function getExcluded(all: Requirement[], selectedIds: Set<string>): Requirement[] {
    return all.filter(r => !selectedIds.has(r.id));
}

function getInScope(all: Requirement[], selectedIds: Set<string>): Requirement[] {
    return all.filter(r => selectedIds.has(r.id));
}

describe('Scoping Model Integrity', () => {
    // Mock Data
    const allRequirements: Requirement[] = [
        { id: 'R1', description: 'Req 1' },
        { id: 'R2', description: 'Req 2' },
        { id: 'R3', description: 'Req 3' },
        { id: 'R4', description: 'Req 4' },
        { id: 'R5', description: 'Req 5' },
    ];

    it('should initially have everything as excluded (Opt-In Model)', () => {
        const selectedIds = new Set<string>(); // Empty start

        const inScope = getInScope(allRequirements, selectedIds);
        const excluded = getExcluded(allRequirements, selectedIds);

        expect(inScope.length).toBe(0);
        expect(excluded.length).toBe(5);
        expect(excluded.map(r => r.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']);
    });

    it('should correctly move items to In Scope', () => {
        const selectedIds = new Set<string>(['R1', 'R3']);

        const inScope = getInScope(allRequirements, selectedIds);
        const excluded = getExcluded(allRequirements, selectedIds);

        expect(inScope.length).toBe(2);
        expect(inScope.map(r => r.id)).toEqual(expect.arrayContaining(['R1', 'R3']));

        expect(excluded.length).toBe(3);
        expect(excluded.map(r => r.id)).toEqual(expect.arrayContaining(['R2', 'R4', 'R5']));
    });

    it('should ensure Excluded + InScope equals Total', () => {
        const selectedIds = new Set<string>(['R2']);

        const inScope = getInScope(allRequirements, selectedIds);
        const excluded = getExcluded(allRequirements, selectedIds);

        const totalCount = inScope.length + excluded.length;
        expect(totalCount).toBe(allRequirements.length);

        // Intersection should be empty
        const intersection = inScope.filter(r => excluded.some(ex => ex.id === r.id));
        expect(intersection.length).toBe(0);
    });

    it('should handle "Select All Visible" scenario', () => {
        // Scenario: User filters to "Even Numbers" (R2, R4) and selects them.
        const visibleFilter = (r: Requirement) => ['R2', 'R4'].includes(r.id);
        const visible = allRequirements.filter(visibleFilter);

        // User clicks "Add Visible to Scope"
        const selectedIds = new Set<string>();
        visible.forEach(r => selectedIds.add(r.id));

        // State Check
        const inScope = getInScope(allRequirements, selectedIds);
        const excluded = getExcluded(allRequirements, selectedIds);

        // In Scope should be just the visible ones
        expect(inScope.length).toBe(2);
        expect(inScope.map(r => r.id).sort()).toEqual(['R2', 'R4']);

        // Excluded should be the rest (R1, R3, R5).
        // This confirms that "Hidden" items (R1, R3, R5) remain Excluded.
        expect(excluded.length).toBe(3);
        expect(excluded.map(r => r.id).sort()).toEqual(['R1', 'R3', 'R5']);
    });
});
