import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import {
    getTicketingAdapters,
    getTicketingAuthStatus,
    getTicketingAuthUrl,
    createTickets,
    type TicketingAdapterInfo,
} from '../lib/api';
import { Loader2, Ticket, CheckCircle2, AlertCircle } from 'lucide-react';

interface TicketingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionId: string;
    requirementIds: string[];
}

export function TicketingDialog({
    open,
    onOpenChange,
    sessionId,
    requirementIds,
}: TicketingDialogProps) {
    const [adapters, setAdapters] = React.useState<TicketingAdapterInfo[]>([]);
    const [selectedAdapter, setSelectedAdapter] = React.useState<string>('');
    const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);
    const [isLoading, setIsLoading] = React.useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<{ created: number } | null>(null);

    // Options
    const [project, setProject] = React.useState('');
    const [priority, setPriority] = React.useState<'low' | 'medium' | 'high' | 'critical'>('medium');

    React.useEffect(() => {
        if (open) {
            loadAdapters();
            setSuccess(null);
            setError(null);
        }
    }, [open]);

    React.useEffect(() => {
        if (selectedAdapter) {
            checkAuth();
        }
    }, [selectedAdapter]);

    const loadAdapters = async () => {
        setIsLoading(true);
        try {
            const data = await getTicketingAdapters();
            setAdapters(data);
            if (data && data.length > 0 && !selectedAdapter) {
                const first = data[0];
                if (first) {
                    setSelectedAdapter(first.name);
                }
            }
        } catch (err) {
            setError('Failed to load ticketing adapters');
        } finally {
            setIsLoading(false);
        }
    };

    const checkAuth = async () => {
        try {
            const authed = await getTicketingAuthStatus(selectedAdapter);
            setIsAuthenticated(authed);
        } catch (err) {
            setIsAuthenticated(false);
        }
    };

    const handleAuth = async () => {
        try {
            const { url } = await getTicketingAuthUrl(selectedAdapter, window.location.href);
            window.location.href = url;
        } catch (err) {
            setError('Failed to get auth URL');
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            const result = await createTickets({
                sessionId,
                requirementIds,
                adapterName: selectedAdapter,
                options: {
                    project,
                    priority,
                },
            });
            setSuccess({ created: result.created });
        } catch (err: any) {
            setError(err.message || 'Failed to create tickets');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Ticket className="h-5 w-5" />
                        Export to Ticketing System
                    </DialogTitle>
                    <DialogDescription>
                        Create tickets for {requirementIds.length} selected requirements.
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    <div className="flex flex-col items-center justify-center py-6 space-y-4">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <div className="text-center">
                            <h3 className="font-semibold text-lg">Export Successful</h3>
                            <p className="text-sm text-muted-foreground">
                                Created {success.created} tickets in {adapters.find(a => a.name === selectedAdapter)?.displayName}.
                            </p>
                        </div>
                        <Button onClick={() => onOpenChange(false)}>Close</Button>
                    </div>
                ) : (
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="adapter">System</Label>
                            <Select
                                value={selectedAdapter}
                                onValueChange={setSelectedAdapter}
                                disabled={isLoading || isSubmitting}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select system" />
                                </SelectTrigger>
                                <SelectContent>
                                    {adapters.map((adapter) => (
                                        <SelectItem key={adapter.name} value={adapter.name}>
                                            {adapter.displayName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {!isAuthenticated && selectedAdapter && !isLoading && (
                            <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-md flex gap-2 items-start text-sm text-yellow-800">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <div className="space-y-2">
                                    <p>You need to authenticate with {adapters.find(a => a.name === selectedAdapter)?.displayName} first.</p>
                                    <Button size="sm" variant="outline" onClick={handleAuth}>
                                        Authenticate
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="project">Project / Repository</Label>
                            <Input
                                id="project"
                                placeholder={selectedAdapter === 'github' ? 'owner/repo' : 'PROJ-KEY'}
                                value={project}
                                onChange={(e) => setProject(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Select
                                value={priority}
                                onValueChange={(v: any) => setPriority(v)}
                                disabled={isSubmitting}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {error && (
                            <div className="p-3 border border-destructive/50 bg-destructive/10 rounded-md flex gap-2 items-center text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}
                    </div>
                )}

                {!success && (
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!isAuthenticated || isSubmitting || !project}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Tickets
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
