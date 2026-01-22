import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Download,
    Search,
    Filter,
    Loader2,
    Shield,
    AlertCircle,
    CheckCircle2,
    Save,
    Ticket,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import { useChecklist } from '@/hooks/useChecklist';
import { Button } from '@/components/ui/button';
import { TicketingDialog } from '@/components/TicketingDialog';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ShortlistedRequirement } from '@/lib/api';

interface ChecklistPageProps {
    viewMode?: 'checklist' | 'in-scope' | 'exclusions';
}

function RequirementCard({
    req,
    selectedIds,
    toggleSelection,
}: {
    req: ShortlistedRequirement;
    selectedIds: Set<string>;
    toggleSelection: (id: string) => void;
}) {
    return (
        <Card
            className={cn(
                'transition-colors h-full flex flex-col',
                selectedIds.has(req.requirementId) && 'border-primary'
            )}
        >
            <CardContent className="p-4 flex flex-col h-full gap-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                            variant={req.standard === 'ASVS' ? 'default' : 'secondary'}
                            className="text-[10px] px-1.5 h-5"
                        >
                            {req.standard}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 h-5">L{req.level}</Badge>
                    </div>
                    <Checkbox
                        checked={selectedIds.has(req.requirementId)}
                        onCheckedChange={() => toggleSelection(req.requirementId)}
                        className="mt-0.5"
                    />
                </div>

                <code className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded w-fit">
                    {req.requirementId}
                </code>

                <p className="text-xs line-clamp-4 flex-1" title={req.description}>{req.description}</p>

                <div className="flex flex-wrap gap-1 mt-1">
                    {req.tags
                        .filter((tag) => tag.startsWith('role:'))
                        .map((tag) => (
                            <Badge
                                key={tag}
                                variant="outline"
                                className="text-[9px] px-1 h-4 bg-muted/30 border-none text-muted-foreground capitalize"
                            >
                                {tag.replace('role:', '')}
                            </Badge>
                        ))}
                </div>

                <div className="mt-auto pt-2 space-y-2">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Shield className="h-3 w-3" />
                        <span className="truncate" title={req.category}>{req.category}</span>
                    </div>

                    {req.rationale && (
                        <div className="flex items-start gap-1 p-1.5 rounded-md bg-muted/50 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                            <span className="text-muted-foreground line-clamp-2" title={req.rationale}>
                                {req.rationale}
                            </span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export function ChecklistPage({ viewMode = 'checklist' }: ChecklistPageProps) {
    const navigate = useNavigate();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isTicketingOpen, setIsTicketingOpen] = useState(false);
    const [asvsExpanded, setAsvsExpanded] = useState(true);
    const [spvsExpanded, setSpvsExpanded] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('rat-session-id');
        if (!stored) {
            navigate('/questionnaire');
            return;
        }
        setSessionId(stored);
    }, [navigate]);

    const {
        data,
        filteredRequirements,
        categories,
        selectedIds,
        filters,
        isLoading,
        isExporting,
        error,
        setFilter,
        toggleSelection,
        selectAll,
        clearSelection,
        export: doExport,
    } = useChecklist(sessionId);

    // Sync filters with viewMode
    useEffect(() => {
        if (viewMode === 'in-scope') {
            setFilter('status', 'selected');
        } else if (viewMode === 'exclusions') {
            setFilter('status', 'unselected');
        } else {
            setFilter('status', 'all');
        }
    }, [viewMode, setFilter]);

    // Save handler
    const handleSave = async () => {
        if (!sessionId || !data) return;
        try {
            await import('@/lib/api').then(m => m.updateSelection(sessionId, Array.from(selectedIds)));
            // Optional: Show toast or feedback
            navigate('/in-scope');
        } catch (err) {
            console.error('Failed to save selection', err);
        }
    };

    if (!sessionId) {
        return null;
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Error
                    </CardTitle>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (!data) {
        return null;
    }

    const asvsCount = filteredRequirements.filter(r => r.standard === 'ASVS').length;
    const spvsCount = filteredRequirements.filter(r => r.standard === 'SPVS').length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Visible Requirements</CardDescription>
                        <CardTitle className="text-3xl">{filteredRequirements.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>ASVS (Visible)</CardDescription>
                        <CardTitle className="text-3xl text-blue-400">
                            {asvsCount}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>SPVS (Visible)</CardDescription>
                        <CardTitle className="text-3xl text-green-400">
                            {spvsCount}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Recommended Level</CardDescription>
                        <CardTitle className="text-3xl">
                            L{data.attributes.recommendedLevel}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Save Selection Action */}
            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    className="bg-green-600 hover:bg-green-700 text-white shadow-md"
                    size="lg"
                >
                    <Save className="h-5 w-5 mr-2" />
                    Save & View Scope
                </Button>
            </div>

            {/* Filters and Actions */}
            <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search requirements..."
                        value={filters.search}
                        onChange={(e) => setFilter('search', e.target.value)}
                        className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </div>

                {/* Status Filter */}
                <select
                    value={filters.status}
                    onChange={(e) =>
                        setFilter('status', e.target.value as 'all' | 'selected' | 'unselected')
                    }
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                    <option value="all">All Status</option>
                    <option value="selected">Selected</option>
                    <option value="unselected">Unselected</option>
                </select>

                {/* Standard Filter */}
                <select
                    value={filters.standard}
                    onChange={(e) =>
                        setFilter('standard', e.target.value as 'all' | 'ASVS' | 'SPVS')
                    }
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                    <option value="all">All Standards</option>
                    <option value="ASVS">ASVS Only</option>
                    <option value="SPVS">SPVS Only</option>
                </select>

                {/* Level Filter */}
                <select
                    value={filters.level}
                    onChange={(e) =>
                        setFilter(
                            'level',
                            e.target.value === 'all' ? 'all' : (parseInt(e.target.value) as 1 | 2 | 3)
                        )
                    }
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                    <option value="all">All Levels</option>
                    <option value="1">Level 1</option>
                    <option value="2">Level 2</option>
                    <option value="3">Level 3</option>
                </select>

                {/* Category Filter */}
                <select
                    value={filters.category ?? ''}
                    onChange={(e) => setFilter('category', e.target.value || null)}
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm max-w-[200px]"
                >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                        <option key={cat} value={cat}>
                            {cat}
                        </option>
                    ))}
                </select>

                {/* Role Filter */}
                <select
                    value={filters.role}
                    onChange={(e) => setFilter('role', e.target.value)}
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                    <option value="all">All Roles</option>
                    <option value="developer">Developer</option>
                    <option value="architect">Architect</option>
                    <option value="devops">DevOps</option>
                    <option value="security">Security</option>
                    <option value="qa">QA / Product</option>
                </select>

                {/* Export Buttons */}
                <div className="flex gap-2 ml-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => doExport('json')}
                        disabled={isExporting}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        JSON
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => doExport('csv')}
                        disabled={isExporting}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        CSV
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => doExport('markdown')}
                        disabled={isExporting}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Markdown
                    </Button>
                    {viewMode === 'in-scope' && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => setIsTicketingOpen(true)}
                            className="bg-primary text-primary-foreground"
                        >
                            <Ticket className="h-4 w-4 mr-2" />
                            Create Tickets
                        </Button>
                    )}
                </div>
            </div>

            {/* Selection Actions */}
            <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                    {selectedIds.size} selected
                </span>
                <Button variant="ghost" size="sm" onClick={selectAll}>
                    Select Visible
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Clear
                </Button>
            </div>

            {/* Requirements List */}
            <div className="space-y-8">
                {filteredRequirements.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No requirements match your filters.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* ASVS Section */}
                        {filteredRequirements.some(r => r.standard === 'ASVS') && (
                            <div className="space-y-4">
                                <button
                                    onClick={() => setAsvsExpanded(!asvsExpanded)}
                                    className="flex items-center gap-2 w-full text-left group"
                                >
                                    {asvsExpanded ? (
                                        <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    ) : (
                                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    )}
                                    <h2 className="text-xl font-bold flex items-center gap-3">
                                        ASVS Requirements
                                        <Badge variant="default" className="bg-blue-500/10 text-blue-400 border-blue-400/20">
                                            {filteredRequirements.filter(r => r.standard === 'ASVS').length}
                                        </Badge>
                                    </h2>
                                    <div className="h-px bg-border flex-1 ml-4" />
                                </button>

                                {asvsExpanded && (
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                        {filteredRequirements
                                            .filter((r) => r.standard === 'ASVS')
                                            .map((req) => (
                                                <RequirementCard
                                                    key={req.requirementId}
                                                    req={req}
                                                    selectedIds={selectedIds}
                                                    toggleSelection={toggleSelection}
                                                />
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SPVS Section */}
                        {filteredRequirements.some(r => r.standard === 'SPVS') && (
                            <div className="space-y-4">
                                <button
                                    onClick={() => setSpvsExpanded(!spvsExpanded)}
                                    className="flex items-center gap-2 w-full text-left group"
                                >
                                    {spvsExpanded ? (
                                        <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    ) : (
                                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    )}
                                    <h2 className="text-xl font-bold flex items-center gap-3">
                                        SPVS Requirements
                                        <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-400/20">
                                            {filteredRequirements.filter(r => r.standard === 'SPVS').length}
                                        </Badge>
                                    </h2>
                                    <div className="h-px bg-border flex-1 ml-4" />
                                </button>

                                {spvsExpanded && (
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                        {filteredRequirements
                                            .filter((r) => r.standard === 'SPVS')
                                            .map((req) => (
                                                <RequirementCard
                                                    key={req.requirementId}
                                                    req={req}
                                                    selectedIds={selectedIds}
                                                    toggleSelection={toggleSelection}
                                                />
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Results Count */}
            <div className="text-center text-sm text-muted-foreground">
                Showing {filteredRequirements.length} of {data.included.length} requirements
            </div>
            {sessionId && (
                <TicketingDialog
                    open={isTicketingOpen}
                    onOpenChange={setIsTicketingOpen}
                    sessionId={sessionId}
                    requirementIds={Array.from(selectedIds)}
                />
            )}
        </div>
    );
}
