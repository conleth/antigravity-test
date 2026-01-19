import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, EyeOff, ArrowLeft } from 'lucide-react';
import { getExclusions, type ExclusionsResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ExclusionsPage() {
    const navigate = useNavigate();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [data, setData] = useState<ExclusionsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('rat-session-id');
        if (!stored) {
            navigate('/questionnaire');
            return;
        }
        setSessionId(stored);
        loadExclusions(stored);
    }, [navigate]);

    const loadExclusions = async (sid: string) => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await getExclusions(sid);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load exclusions');
        } finally {
            setIsLoading(false);
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

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/checklist')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Checklist
                </Button>
            </div>

            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <EyeOff className="h-6 w-6" />
                    Excluded Requirements
                </h1>
                <p className="text-muted-foreground mt-1">
                    These requirements were excluded based on your questionnaire answers.
                    This transparency view helps you understand why certain requirements
                    don't appear in your checklist.
                </p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Excluded ASVS</CardDescription>
                        <CardTitle className="text-3xl text-blue-400">
                            {data.stats.excludedASVS}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Excluded SPVS</CardDescription>
                        <CardTitle className="text-3xl text-green-400">
                            {data.stats.excludedSPVS}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Exclusions List */}
            {data.excluded.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        <EyeOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No requirements were excluded.</p>
                        <p className="text-sm mt-2">
                            All applicable requirements are included in your checklist.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {data.excluded.map((req) => (
                        <Card key={req.requirementId} className="border-dashed">
                            <CardContent className="py-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge
                                            variant={req.standard === 'ASVS' ? 'default' : 'secondary'}
                                            className="opacity-60"
                                        >
                                            {req.standard}
                                        </Badge>
                                        <code className="text-xs text-muted-foreground">
                                            {req.requirementId}
                                        </code>
                                    </div>

                                    <p className="text-sm text-muted-foreground">{req.title}</p>

                                    <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-xs">
                                        <EyeOff className="h-3 w-3 mt-0.5 text-destructive" />
                                        <div>
                                            <span className="font-medium text-destructive">
                                                Excluded:
                                            </span>{' '}
                                            <span className="text-muted-foreground">
                                                {req.exclusionReason}
                                            </span>
                                            {req.excludedByRule && (
                                                <span className="text-muted-foreground/60 ml-2">
                                                    (Rule: {req.excludedByRule})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Info */}
            <Card className="bg-muted/30">
                <CardContent className="py-4">
                    <p className="text-sm text-muted-foreground">
                        <strong>Note:</strong> Exclusions are determined by the declarative
                        rules engine based on your questionnaire answers. If you believe a
                        requirement should be included, you can revisit the questionnaire
                        and adjust your answers, or manually add the requirement to your
                        checklist.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
