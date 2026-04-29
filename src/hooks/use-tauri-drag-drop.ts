import { useEffect, useRef, useCallback } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

interface UseTauriDragDropOptions {
  ref: React.RefObject<HTMLDivElement | null>;
  onDrop: (paths: string[]) => void;
  enabled?: boolean;
}

export function useTauriDragDrop({ ref, onDrop, enabled = true }: UseTauriDragDropOptions) {
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const isInside = useCallback((x: number, y: number): boolean => {
    const el = ref.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }, [ref]);

  useEffect(() => {
    if (!enabled) return;

    const unlisteners: UnlistenFn[] = [];

    (async () => {
      unlisteners.push(
        await listen<DragDropPayload>('tauri://drag-drop', (event) => {
          const { paths, position } = event.payload;
          if (isInside(position.x, position.y)) {
            onDropRef.current(paths);
          }
        }),
      );
    })();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [enabled, isInside]);
}
