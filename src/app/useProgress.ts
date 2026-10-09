import { useSyncExternalStore } from 'react';
import { getProgress, subscribeProgress, type Progress } from '../storage/progress';

export function useProgress(): Progress {
  return useSyncExternalStore(subscribeProgress, getProgress);
}
