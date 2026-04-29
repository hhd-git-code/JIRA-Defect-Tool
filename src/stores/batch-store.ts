import { useSyncExternalStore, useCallback } from 'react';
import type { DefectData, BatchItemResult } from '../types/defect';

export interface BatchState {
  items: DefectData[];
  currentIndex: number;
  results: BatchItemResult[];
  isSubmitting: boolean;
  currentSubmitIndex: number;
  originalItems: DefectData[];
  cancelled: boolean;
}

let cancelled = false;

export function isBatchCancelled(): boolean {
  return cancelled;
}

const initialState: BatchState = {
  items: [],
  currentIndex: 0,
  results: [],
  isSubmitting: false,
  currentSubmitIndex: 0,
  originalItems: [],
  cancelled: false,
};

let state: BatchState = { ...initialState };
let listeners: Set<() => void> = new Set();

function getState(): BatchState {
  return state;
}

function setState(partial: Partial<BatchState> | ((prev: BatchState) => Partial<BatchState>)) {
  const update = typeof partial === 'function' ? partial(state) : partial;
  state = { ...state, ...update };
  listeners.forEach(l => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBatchStore() {
  const state = useSyncExternalStore(subscribe, getState);

  const setItems = useCallback((items: DefectData[]) => {
    setState({
      items: items.map(item => ({ ...item })),
      currentIndex: 0,
      results: [],
      isSubmitting: false,
      currentSubmitIndex: 0,
      originalItems: items,
    });
  }, []);

  const setCurrentIndex = useCallback((index: number) => {
    setState(prev => ({ ...prev, currentIndex: index }));
  }, []);

  const updateItem = useCallback((index: number, item: DefectData) => {
    setState(prev => {
      const items = [...prev.items];
      items[index] = item;
      return { ...prev, items };
    });
  }, []);

  const addResult = useCallback((result: BatchItemResult) => {
    setState(prev => ({
      ...prev,
      results: [...prev.results, result],
      currentSubmitIndex: prev.currentSubmitIndex + 1,
    }));
  }, []);

  const setSubmitting = useCallback((isSubmitting: boolean) => {
    setState(prev => ({ ...prev, isSubmitting }));
  }, []);

  const cancelSubmit = useCallback(() => {
    cancelled = true;
    setState(prev => ({ ...prev, cancelled: true }));
  }, []);

  const reset = useCallback(() => {
    cancelled = false;
    setState({ ...initialState, cancelled: false });
  }, []);

  const removeSuccessItems = useCallback(() => {
    cancelled = false;
    setState(prev => {
      const successIds = new Set(prev.results.filter(r => r.success).map(r => r.id));
      const remaining = prev.items.filter(item => !successIds.has(item.id));
      return {
        ...prev,
        items: remaining,
        originalItems: remaining,
        results: [],
        currentSubmitIndex: 0,
        currentIndex: 0,
        isSubmitting: false,
        cancelled: false,
      };
    });
  }, []);

  return { state, setItems, setCurrentIndex, updateItem, addResult, setSubmitting, cancelSubmit, reset, removeSuccessItems };
}
