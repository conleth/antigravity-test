import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check, Loader2, Info } from 'lucide-react';
import { useQuestionnaire } from '@/hooks/useQuestionnaire';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useState } from 'react';

/**
 * Provides contextual security insights based on selected answers.
 */
function getInsight(question: any, answer: any): string | null {
    if (!answer) return null;

    if (question.id === 'app-type') {
        if (answer === 'api') return "API services require strict input validation and rate limiting. We'll focus on OWASP API Top 10 and secure documentation.";
        if (answer === 'mobile') return "Mobile apps have unique binary and communication risks. We'll include MASVS controls for platform-specific security.";
        if (answer === 'iot') return "IoT devices face physical access and firmware security risks. We'll verify secure boot and hardware interfaces.";
        if (answer === 'serverless') return "Serverless functions need strict cold-start mitigation and least-privilege IAM roles.";
    }
    if (question.id === 'auth-type' && Array.isArray(answer)) {
        if (answer.includes('none')) return "Anonymous access usually implies public data. Ensure sensitive endpoints are strictly excluded from this scope.";
        if (answer.includes('basic') || answer.includes('apikey')) return "Static credentials (Basic/API Key) must be rotated frequently and monitored for leaks.";
        if (answer.includes('saml') || answer.includes('sso')) return "Federated identity reduces credential theft risk but requires strict validation of assertions.";
    }
    if (question.id === 'data-sensitivity' && (answer === 'confidential' || answer === 'regulated')) {
        return "Handling sensitive data requires advanced encryption at rest and comprehensive audit logging. Strict RBAC will be enforced.";
    }
    if (question.id === 'internet-exposure' && answer === 'public') {
        return "Public exposure increases the attack surface. We'll focus on edge protection and strict input validation.";
    }
    if (question.id === 'hosting-model' && answer === 'cloud') {
        return "Cloud environments benefit from shared responsibility models. We'll include automated pipeline checks (SPVS) for your infrastructure.";
    }
    if (question.id === 'is-containerized' && answer === true) {
        return "Containers introduce unique orchestration risks. We'll include requirements for image signing, registry security, and K8s hardening.";
    }
    if (question.id === 'is-multi-tenant' && answer === true) {
        return "Multi-tenancy demands bulletproof data isolation. We'll focus on tenant-aware access control and row-level security verification.";
    }
    if (question.id === 'compliance-targets' && Array.isArray(answer) && answer.length > 0) {
        const targets = answer.map(t => String(t).toUpperCase()).join(', ');
        return `Targeting ${targets} will require High Assurance (Level 2/3) verification and formalized evidence gathering.`;
    }

    return null;
}

export function QuestionnairePage() {
    const navigate = useNavigate();
    const [isReviewing, setIsReviewing] = useState(false);
    const {
        visibleQuestions,
        questions,
        currentQuestion,
        currentAnswer,
        currentVisibleIndex,
        progress,
        isLoading,
        isSubmitting,
        isLastStep,
        isFirstStep,
        canProceed,
        answers,
        error,
        setAnswer,
        nextStep,
        prevStep,
        goToStep,
        submit,
    } = useQuestionnaire();

    const handleEditQuestion = (questionId: string) => {
        const index = questions.findIndex((q: any) => q.id === questionId);
        if (index !== -1) {
            goToStep(index);
            setIsReviewing(false);
        }
    };

    const handleNext = () => {
        if (isLastStep) {
            setIsReviewing(true);
        } else {
            nextStep();
        }
    };

    const handleSubmit = async () => {
        try {
            const response = await submit();
            localStorage.setItem('rat-session-id', response.sessionId);
            navigate('/checklist');
        } catch {
            // Error managed by hook
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isReviewing) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold">Review Your Project Profile</h1>
                    <p className="text-muted-foreground">Confirm your answers before we generate your tailored security checklist.</p>
                </div>

                <div className="space-y-4">
                    {visibleQuestions.map((q) => (
                        <Card key={q.id} className="overflow-hidden border-none shadow-sm ring-1 ring-input group hover:ring-primary/50 transition-all">
                            <CardHeader className="py-3 px-4 bg-muted/30 flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium">{q.text}</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleEditQuestion(q.id)}
                                >
                                    Edit
                                </Button>
                            </CardHeader>
                            <CardContent className="py-3 px-4">
                                <p className="text-sm font-semibold text-primary">
                                    {(() => {
                                        const answer = answers[q.id];
                                        if (Array.isArray(answer)) {
                                            return (answer as string[])
                                                .map(v => q.options?.find(o => o.value === v)?.label || v)
                                                .join(', ');
                                        }
                                        if (typeof answer === 'boolean') {
                                            return answer ? 'Yes' : 'No';
                                        }
                                        return q.options?.find(o => o.value === answer)?.label || String(answer);
                                    })()}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setIsReviewing(false)}>
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Back to Questions
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" className="px-8 shadow-lg shadow-primary/20">
                        {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                        Generate Checklist
                    </Button>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Card className="max-w-2xl mx-auto border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive">Error</CardTitle>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button onClick={() => window.location.reload()}>Retry</Button>
                </CardFooter>
            </Card>
        );
    }

    if (!currentQuestion) {
        return null;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Progress */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                    <span className="text-primary">Step {currentVisibleIndex + 1} / {visibleQuestions.length}</span>
                    <span className="text-muted-foreground">{Math.round(progress)}% complete</span>
                </div>
                <Progress value={progress} className="h-2 rounded-full overflow-hidden transition-all duration-500" />
            </div>

            {/* Question Card */}
            <Card className="shadow-xl shadow-primary/5 border-none ring-1 ring-input animate-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                            {currentQuestion.id.split('-')[0]}
                        </span>
                    </div>
                    <CardTitle className="leading-tight text-xl">{currentQuestion.text}</CardTitle>
                    {currentQuestion.helpText && (
                        <CardDescription className="flex items-start gap-1.5 mt-2">
                            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                            {currentQuestion.helpText}
                        </CardDescription>
                    )}
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Insight Snippet */}
                    {getInsight(currentQuestion, currentAnswer) && (
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex gap-3 animate-in fade-in slide-in-from-top-2">
                            <div className="mt-0.5">💡</div>
                            <p className="leading-relaxed font-medium">{getInsight(currentQuestion, currentAnswer)}</p>
                        </div>
                    )}

                    {currentQuestion.type === 'single-select' && currentQuestion.options && (
                        <RadioGroup
                            value={(currentAnswer as string) || ""}
                            onValueChange={(value) => setAnswer(currentQuestion.id, value)}
                            className="space-y-3"
                        >
                            {currentQuestion.options.map((option) => (
                                <label
                                    key={option.value}
                                    className={`flex items-start space-x-3 p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${currentAnswer === option.value
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                        : 'border-input bg-card hover:border-primary/30 hover:bg-accent/50'}`}
                                >
                                    <RadioGroupItem value={option.value} className="mt-1" />
                                    <div className="space-y-1">
                                        <p className="font-semibold leading-none">{option.label}</p>
                                        {option.description && (
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                {option.description}
                                            </p>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </RadioGroup>
                    )}

                    {currentQuestion.type === 'multi-select' && currentQuestion.options && (
                        <div className="space-y-3">
                            {currentQuestion.options.map((option) => {
                                const selected = (currentAnswer as string[] || []).includes(option.value);
                                return (
                                    <label
                                        key={option.value}
                                        className={`flex items-start space-x-3 p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${selected
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                            : 'border-input bg-card hover:border-primary/30 hover:bg-accent/50'}`}
                                    >
                                        <Checkbox
                                            checked={selected}
                                            onCheckedChange={(checked) => {
                                                const current = (currentAnswer as string[] || []);
                                                if (checked) {
                                                    setAnswer(currentQuestion.id, [...current, option.value]);
                                                } else {
                                                    setAnswer(currentQuestion.id, current.filter(v => v !== option.value));
                                                }
                                            }}
                                            className="mt-1"
                                        />
                                        <div className="space-y-1">
                                            <p className="font-semibold leading-none">{option.label}</p>
                                            {option.description && (
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    {option.description}
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {currentQuestion.type === 'boolean' && (
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'Yes', value: true },
                                { label: 'No', value: false },
                            ].map((opt) => (
                                <label
                                    key={String(opt.value)}
                                    className={`flex flex-col items-center justify-center p-8 rounded-xl border-2 transition-all cursor-pointer ${currentAnswer === opt.value
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                        : 'border-input bg-card hover:border-primary/30 hover:bg-accent/30'
                                        }`}
                                >
                                    <Checkbox
                                        checked={currentAnswer === opt.value}
                                        onCheckedChange={() => setAnswer(currentQuestion.id, opt.value)}
                                        className="sr-only"
                                    />
                                    <span className="text-2xl font-bold">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex justify-between border-t pt-6">
                    <Button
                        variant="ghost"
                        onClick={prevStep}
                        disabled={isFirstStep}
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Previous
                    </Button>

                    <Button
                        onClick={handleNext}
                        disabled={!canProceed}
                        size="lg"
                        className="px-8"
                    >
                        {isLastStep ? 'Review Answers' : 'Next'}
                        {!isLastStep && <ChevronRight className="h-4 w-4 ml-2" />}
                    </Button>
                </CardFooter>
            </Card>

            {/* Step Indicators */}
            <div className="flex justify-center gap-1.5 pt-2">
                {visibleQuestions.map((_, index) => (
                    <div
                        key={index}
                        className={`h-1 w-6 rounded-full transition-all duration-300 ${index === currentVisibleIndex
                            ? 'bg-primary w-10'
                            : index < currentVisibleIndex
                                ? 'bg-primary/40'
                                : 'bg-muted'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
