import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check, Loader2, Shield, GitBranch } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

export function QuestionnairePage() {
    const navigate = useNavigate();
    const [showSummary, setShowSummary] = useState(false);
    const {
        questions,
        currentQuestion,
        currentAnswer,
        currentStep,
        progress,
        isLoading,
        isSubmitting,
        isLastStep,
        isFirstStep,
        canProceed,
        error,
        setAnswer,
        nextStep,
        prevStep,
        submit,
        attributes,
    } = useQuestionnaire();

    const handleSubmit = async () => {
        try {
            const response = await submit();
            // Store session ID immediately
            localStorage.setItem('rat-session-id', response.sessionId);
            setShowSummary(true);
        } catch {
            // Error is already set in state
        }
    };

    const handleProceed = () => {
        navigate('/checklist');
    };

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
                    <CardTitle className="text-destructive">Error</CardTitle>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (showSummary && attributes) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">Recommendation Summary</h1>
                    <p className="text-muted-foreground">
                        Based on your answers, we have generated a tailored security profile.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ASVS Recommendation */}
                    <Card className="border-t-4 border-t-blue-500 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Shield className="w-24 h-24" />
                        </div>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">ASVS</Badge>
                                Application Security
                            </CardTitle>
                            <CardDescription>
                                OWASP Application Security Verification Standard
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col items-center py-4">
                                <span className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">Recommended Level</span>
                                <span className="text-5xl font-bold text-blue-600">L{attributes.recommendedLevel}</span>
                            </div>
                            <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                                <p><strong>Why?</strong></p>
                                <ul className="list-disc pl-4 space-y-1">
                                    {attributes.dataSensitivity === 'public' && <li>App handles public data</li>}
                                    {attributes.dataSensitivity === 'internal' && <li>App handles internal data</li>}
                                    {attributes.dataSensitivity === 'confidential' && <li>App handles confidential data</li>}
                                    {attributes.internetExposure === 'public' && <li>Accessible from the internet</li>}
                                </ul>
                            </div>
                        </CardContent>
                    </Card>

                    {/* SPVS Recommendation */}
                    <Card className="border-t-4 border-t-green-500 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <GitBranch className="w-24 h-24" />
                        </div>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Badge variant="default" className="bg-green-500 hover:bg-green-600">SPVS</Badge>
                                Supply Chain
                            </CardTitle>
                            <CardDescription>
                                OWASP Software Component Verification Standard
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col items-center py-4">
                                <span className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">Recommended Level</span>
                                <span className="text-5xl font-bold text-green-600">L1+</span>
                            </div>
                            <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                                <p><strong>Focus Areas:</strong></p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Secure Build Pipeline</li>
                                    <li>Dependency Management</li>
                                    {!attributes.pipelineMaturity?.hasSignedArtifacts && (
                                        <li className="text-amber-600 font-medium">Implement Artifact Signing</li>
                                    )}
                                    {!attributes.pipelineMaturity?.hasSecretScanning && (
                                        <li className="text-amber-600 font-medium">Enable Secret Scanning</li>
                                    )}
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-center pt-8">
                    <Button size="lg" onClick={handleProceed} className="w-full md:w-auto min-w-[200px]">
                        Proceed to Checklist
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }

    if (!currentQuestion) {
        return null;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            {/* Progress */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Question {currentStep + 1} of {questions.length}</span>
                    <span>{Math.round(progress)}% complete</span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            {/* Question Card */}
            <Card className="animate-slide-up">
                <CardHeader>
                    <CardTitle>{currentQuestion.text}</CardTitle>
                    {currentQuestion.helpText && (
                        <CardDescription>{currentQuestion.helpText}</CardDescription>
                    )}
                </CardHeader>

                <CardContent>
                    {currentQuestion.type === 'single-select' && currentQuestion.options && (
                        <RadioGroup
                            value={currentAnswer as string | undefined}
                            onValueChange={(value) => setAnswer(currentQuestion.id, value)}
                            className="space-y-3"
                        >
                            {currentQuestion.options.map((option) => (
                                <label
                                    key={option.value}
                                    className="flex items-start space-x-3 p-4 rounded-lg border border-input bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                                >
                                    <RadioGroupItem value={option.value} className="mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="font-medium leading-none">{option.label}</p>
                                        {option.description && (
                                            <p className="text-sm text-muted-foreground">
                                                {option.description}
                                            </p>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </RadioGroup>
                    )}

                    {currentQuestion.type === 'boolean' && (
                        <div className="space-y-3">
                            <label
                                className="flex items-center space-x-3 p-4 rounded-lg border border-input bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                            >
                                <Checkbox
                                    checked={currentAnswer === true}
                                    onCheckedChange={(checked) =>
                                        setAnswer(currentQuestion.id, checked === true ? true : undefined)
                                    }
                                />
                                <div className="space-y-1">
                                    <p className="font-medium leading-none">Yes</p>
                                </div>
                            </label>
                            <label
                                className="flex items-center space-x-3 p-4 rounded-lg border border-input bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                            >
                                <Checkbox
                                    checked={currentAnswer === false}
                                    onCheckedChange={(checked) =>
                                        setAnswer(currentQuestion.id, checked === true ? false : undefined)
                                    }
                                />
                                <div className="space-y-1">
                                    <p className="font-medium leading-none">No</p>
                                </div>
                            </label>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex justify-between">
                    <Button
                        variant="outline"
                        onClick={prevStep}
                        disabled={isFirstStep}
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Previous
                    </Button>

                    {isLastStep ? (
                        <Button
                            onClick={handleSubmit}
                            disabled={!canProceed || isSubmitting}
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Check className="h-4 w-4 mr-2" />
                            )}
                            View recommendations
                        </Button>
                    ) : (
                        <Button
                            onClick={nextStep}
                            disabled={!canProceed}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    )}
                </CardFooter>
            </Card>

            {/* Step Indicators */}
            <div className="flex justify-center gap-2">
                {questions.map((_, index) => (
                    <div
                        key={index}
                        className={`h-2 w-2 rounded-full transition-colors ${index === currentStep
                            ? 'bg-primary'
                            : index < currentStep
                                ? 'bg-primary/50'
                                : 'bg-muted'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
