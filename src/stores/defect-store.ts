import { useState, useCallback } from 'react';
import type { DefectData } from '../types/defect';
import { createEmptyDefect } from '../types/defect';

export function useDefectStore() {
  const [currentDefect, setCurrentDefect] = useState<DefectData>(createEmptyDefect);

  const updateField = useCallback(<K extends keyof DefectData>(field: K, value: DefectData[K]) => {
    setCurrentDefect(prev => ({ ...prev, [field]: value }));
  }, []);

  const resetDefect = useCallback(() => {
    setCurrentDefect(createEmptyDefect());
  }, []);

  const setFromImport = useCallback((defect: DefectData) => {
    setCurrentDefect(defect);
  }, []);

  return { currentDefect, setCurrentDefect, updateField, resetDefect, setFromImport };
}
