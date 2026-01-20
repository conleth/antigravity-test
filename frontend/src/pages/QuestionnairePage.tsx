import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react';
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

export function QuestionnairePage() {
    const navigate = useNavigate();
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
    } = useQuestionnaire();

    const handleSubmit = async () => {
        try {
            const response = await submit();
            // Store session ID in localStorage for checklist page
            localStorage.setItem('rat-session-id', response.sessionId);
            navigate('/checklist');
        } catch {
            // Error is already set in state
        }
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
                            Generate Checklist
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
