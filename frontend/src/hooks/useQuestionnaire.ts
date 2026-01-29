import { useState, useCallback, useEffect } from 'react';
import {
    getQuestions,
    submitQuestionnaire,
    type Question,
    type DerivedAttributes,
} from '@/lib/api';

export type QuestionnaireAnswers = Record<string, string | boolean | string[]>;

export interface QuestionnaireState {
    questions: Question[];
    answers: QuestionnaireAnswers;
    currentStep: number;
    isLoading: boolean;
    isSubmitting: boolean;
    error: string | null;
    sessionId: string | null;
    attributes: DerivedAttributes | null;
}

export function useQuestionnaire() {
    const [state, setState] = useState<QuestionnaireState>({
        questions: [],
        answers: {},
        currentStep: 0,
        isLoading: true,
        isSubmitting: false,
        error: null,
        sessionId: null,
        attributes: null,
    });

    // Load questions on mount
    useEffect(() => {
        loadQuestions();
    }, []);

    const loadQuestions = async () => {
        try {
            setState((s) => ({ ...s, isLoading: true, error: null }));
            const response = await getQuestions();
            const sortedQuestions = response.questions.sort((a, b) => a.order - b.order);
            setState((s) => ({ ...s, questions: sortedQuestions, isLoading: false }));
        } catch (err) {
            setState((s) => ({
                ...s,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Failed to load questions',
            }));
        }
    };

    const setAnswer = useCallback((questionId: string, value: string | boolean | string[] | null | undefined) => {
        setState((s) => {
            const newAnswers = { ...s.answers };
            if (value === null || value === undefined) {
                delete newAnswers[questionId];
            } else {
                newAnswers[questionId] = value;
            }
            return {
                ...s,
                answers: newAnswers,
            };
        });
    }, []);

    const checkCondition = useCallback((question: Question | undefined, answers: QuestionnaireAnswers): boolean => {
        if (!question || !question.condition) return true;
        const { questionId, operator, value } = question.condition;
        const answer = answers[questionId];

        switch (operator) {
            case 'equals':
                return answer === value;
            case 'notEquals':
                return answer !== value;
            case 'in':
                return Array.isArray(value) && value.includes(answer as string);
            default:
                return true;
        }
    }, []);

    const nextStep = useCallback(() => {
        setState((s) => {
            let next = s.currentStep + 1;
            while (next < s.questions.length && !checkCondition(s.questions[next] as any, s.answers)) {
                next++;
            }
            return {
                ...s,
                currentStep: Math.min(next, s.questions.length - 1),
            };
        });
    }, [checkCondition]);

    const prevStep = useCallback(() => {
        setState((s) => {
            let prev = s.currentStep - 1;
            while (prev > 0 && !checkCondition(s.questions[prev] as any, s.answers)) {
                prev--;
            }
            return {
                ...s,
                currentStep: Math.max(prev, 0),
            };
        });
    }, [checkCondition]);

    const goToStep = useCallback((step: number) => {
        setState((s) => ({
            ...s,
            currentStep: Math.max(0, Math.min(step, s.questions.length - 1)),
        }));
    }, []);

    const submit = useCallback(async () => {
        try {
            setState((s) => ({ ...s, isSubmitting: true, error: null }));
            const response = await submitQuestionnaire(state.answers);
            setState((s) => ({
                ...s,
                isSubmitting: false,
                sessionId: response.sessionId,
                attributes: response.attributes,
            }));
            return response;
        } catch (err) {
            setState((s) => ({
                ...s,
                isSubmitting: false,
                error: err instanceof Error ? err.message : 'Failed to submit questionnaire',
            }));
            throw err;
        }
    }, [state.answers]);

    const reset = useCallback(() => {
        setState((s) => ({
            ...s,
            answers: {},
            currentStep: 0,
            sessionId: null,
            attributes: null,
            error: null,
        }));
    }, []);

    const currentQuestion = state.questions[state.currentStep];
    const currentAnswer = currentQuestion ? state.answers[currentQuestion.id] : undefined;

    // Filter questions by condition to calculate real progress and last step
    const visibleQuestions = state.questions.filter(q => checkCondition(q, state.answers));
    const currentVisibleIndex = visibleQuestions.indexOf(currentQuestion);

    const isLastStep = currentVisibleIndex === visibleQuestions.length - 1;
    const isFirstStep = currentVisibleIndex === 0;
    const progress = visibleQuestions.length > 0
        ? ((currentVisibleIndex + 1) / visibleQuestions.length) * 100
        : 0;

    const canProceed = currentQuestion
        ? !currentQuestion.required || currentAnswer !== undefined
        : false;

    return {
        ...state,
        visibleQuestions,
        currentVisibleIndex,
        currentQuestion,
        currentAnswer,
        isLastStep,
        isFirstStep,
        progress,
        canProceed,
        setAnswer,
        nextStep,
        prevStep,
        goToStep,
        submit,
        reset,
    };
}
