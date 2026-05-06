import { useSyncExternalStore, useCallback } from 'react';
import type { TestPoint, PrdSource } from '../types/test-case';
import type { TranslatedTestPoint } from '../services/test-case-translate';
import type { BatchItemResult as CreateResult } from '../types/defect';

export type { CreateResult };

export interface PrdState {
  currentStep: number;
  maxReachedStep: number;
  prdSource: PrdSource | null;
  testPoints: TestPoint[];
  translatedTestPoints: TranslatedTestPoint[];
  generating: boolean;
  translating: boolean;
  creating: boolean;
  createResults: CreateResult[];
  streamingText: string;
}

const initialState: PrdState = {
  currentStep: 0,
  maxReachedStep: 0,
  prdSource: null,
  testPoints: [],
  translatedTestPoints: [],
  generating: false,
  translating: false,
  creating: false,
  createResults: [],
  streamingText: '',
};

let state: PrdState = { ...initialState };
let listeners: Set<() => void> = new Set();

function getState(): PrdState {
  return state;
}

function setState(partial: Partial<PrdState> | ((prev: PrdState) => Partial<PrdState>)) {
  const update = typeof partial === 'function' ? partial(state) : partial;
  state = { ...state, ...update };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePrdStore() {
  const s = useSyncExternalStore(subscribe, getState);

  const setStep = useCallback((step: number) => {
    setState((prev) => ({
      currentStep: step,
      maxReachedStep: Math.max(prev.maxReachedStep, step),
    }));
  }, []);

  const setPrdSource = useCallback((source: PrdSource | null) => {
    setState({ prdSource: source });
  }, []);

  const setTestPoints = useCallback((points: TestPoint[]) => {
    setState({ testPoints: points });
  }, []);

  const updateTestPoint = useCallback((id: string, updates: Partial<TestPoint>) => {
    setState((prev) => ({
      testPoints: prev.testPoints.map((tp) => (tp.id === id ? { ...tp, ...updates } : tp)),
    }));
  }, []);

  const addTestPoint = useCallback((point: TestPoint) => {
    setState((prev) => ({ testPoints: [...prev.testPoints, point] }));
  }, []);

  const removeTestPoint = useCallback((id: string) => {
    setState((prev) => ({ testPoints: prev.testPoints.filter((tp) => tp.id !== id) }));
  }, []);

  const setTranslatedTestPoints = useCallback((translated: TranslatedTestPoint[]) => {
    setState({ translatedTestPoints: translated });
  }, []);

  const updateTranslatedTestPoint = useCallback((index: number, updates: Partial<TranslatedTestPoint>) => {
    setState((prev) => {
      const updated = [...prev.translatedTestPoints];
      updated[index] = { ...updated[index], ...updates };
      return { translatedTestPoints: updated };
    });
  }, []);

  const setGenerating = useCallback((value: boolean) => {
    setState({ generating: value });
  }, []);

  const setTranslating = useCallback((value: boolean) => {
    setState({ translating: value });
  }, []);

  const setCreating = useCallback((value: boolean) => {
    setState({ creating: value });
  }, []);

  const setStreamingText = useCallback((text: string) => {
    setState({ streamingText: text });
  }, []);

  const addCreateResult = useCallback((result: CreateResult) => {
    setState((prev) => ({ createResults: [...prev.createResults, result] }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...initialState });
  }, []);

  return {
    state: s,
    setStep,
    setPrdSource,
    setTestPoints,
    updateTestPoint,
    addTestPoint,
    removeTestPoint,
    setTranslatedTestPoints,
    updateTranslatedTestPoint,
    setGenerating,
    setStreamingText,
    setTranslating,
    setCreating,
    addCreateResult,
    reset,
  };
}
