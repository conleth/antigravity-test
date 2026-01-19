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

    const nextStep = useCallback(() => {
        setState((s) => ({
            ...s,
            currentStep: Math.min(s.currentStep + 1, s.questions.length - 1),
        }));
    }, []);

    const prevStep = useCallback(() => {
        setState((s) => ({
            ...s,
            currentStep: Math.max(s.currentStep - 1, 0),
        }));
    }, []);

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
    const isLastStep = state.currentStep === state.questions.length - 1;
    const isFirstStep = state.currentStep === 0;
    const progress = state.questions.length > 0
        ? ((state.currentStep + 1) / state.questions.length) * 100
        : 0;

    const canProceed = currentQuestion
        ? !currentQuestion.required || currentAnswer !== undefined
        : false;

    return {
        ...state,
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
