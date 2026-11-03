'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { registerMatchScore, updateMatchScore } from '@/app/actions';

export type QueuedMatchAction = {
  id: string;
  type: 'REGISTER_SCORE' | 'UPDATE_SCORE';
  matchId: string;
  scoreA: number;
  scoreB: number;
  completedAt?: string;
  startedAt?: string;
  version?: number;
  createdAt: string;
  error?: string;
};

const QUEUE_STORAGE_KEY = 'padelflex_offline_queue_v1';

export function useOfflineSync(onSyncSuccess?: () => void) {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') return navigator.onLine;
    return true;
  });
  const [queue, setQueue] = useState<QueuedMatchAction[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
        if (stored) return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to load offline queue:', e);
      }
    }
    return [];
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);

  // Save queue to localStorage on changes
  const saveQueue = useCallback((newQueue: QueuedMatchAction[]) => {
    setQueue(newQueue);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(newQueue));
      } catch (e) {
        console.error('Failed to save offline queue:', e);
      }
    }
  }, []);

  // Sync the queue with the backend
  const syncQueue = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine || isSyncing) return;

    const currentQueue = (() => {
      try {
        const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
        return stored ? (JSON.parse(stored) as QueuedMatchAction[]) : [];
      } catch {
        return [];
      }
    })();

    if (currentQueue.length === 0) return;

    setIsSyncing(true);
    setLastSyncMessage('Synkroniserer ventende kamper...');

    const remainingQueue: QueuedMatchAction[] = [];
    let syncedCount = 0;

    for (const item of currentQueue) {
      try {
        if (item.type === 'REGISTER_SCORE') {
          await registerMatchScore(
            item.matchId,
            item.scoreA,
            item.scoreB,
            item.completedAt ? new Date(item.completedAt) : undefined,
            item.version
          );
        } else if (item.type === 'UPDATE_SCORE') {
          await updateMatchScore(
            item.matchId,
            item.scoreA,
            item.scoreB,
            item.startedAt,
            item.completedAt
          );
        }
        syncedCount++;
      } catch (err: any) {
        console.error('Sync failed for item', item.id, err);
        // Behold i kø hvis det var en nettfeil
        remainingQueue.push({
          ...item,
          error: err.message || 'Synkroniseringsfeil'
        });
      }
    }

    saveQueue(remainingQueue);
    setIsSyncing(false);

    if (syncedCount > 0) {
      setLastSyncMessage(`${syncedCount} kamp(er) ble synkronisert med skyen!`);
      setTimeout(() => setLastSyncMessage(null), 4000);
      if (onSyncSuccess) onSyncSuccess();
    } else if (remainingQueue.length > 0) {
      setLastSyncMessage('Kunne ikke synkronisere alle kamper. Prøver igjen om litt.');
      setTimeout(() => setLastSyncMessage(null), 4000);
    }
  }, [isSyncing, onSyncSuccess, saveQueue]);

  // Online / Offline event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodisk synkroniseringssjekk
    const interval = setInterval(() => {
      if (navigator.onLine && queue.length > 0 && !isSyncing) {
        syncQueue();
      }
    }, 12000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [queue.length, isSyncing, syncQueue]);

  // Safe wrapper to register a match score (either online or queued offline)
  const submitMatchScore = useCallback(
    async (
      matchId: string,
      scoreA: number,
      scoreB: number,
      completedAt?: Date,
      version?: number
    ): Promise<{ success: boolean; offline?: boolean; error?: string }> => {
      // Sjekk om vi er offline
      if (typeof window !== 'undefined' && !navigator.onLine) {
        const newItem: QueuedMatchAction = {
          id: Math.random().toString(36).substring(2, 9),
          type: 'REGISTER_SCORE',
          matchId,
          scoreA,
          scoreB,
          completedAt: completedAt ? completedAt.toISOString() : new Date().toISOString(),
          version,
          createdAt: new Date().toISOString()
        };

        const updated = [...queue, newItem];
        saveQueue(updated);

        return {
          success: true,
          offline: true,
          error: undefined
        };
      }

      // Vi er online, prøv direkte
      try {
        await registerMatchScore(matchId, scoreA, scoreB, completedAt, version);
        return { success: true, offline: false };
      } catch (err: any) {
        // Hvis feilen skyldes nettverksbrudd, legg i kø
        if (
          err.message?.includes('fetch') ||
          err.message?.includes('network') ||
          err.message?.includes('Failed to fetch') ||
          !navigator.onLine
        ) {
          const newItem: QueuedMatchAction = {
            id: Math.random().toString(36).substring(2, 9),
            type: 'REGISTER_SCORE',
            matchId,
            scoreA,
            scoreB,
            completedAt: completedAt ? completedAt.toISOString() : new Date().toISOString(),
            version,
            createdAt: new Date().toISOString()
          };

          const updated = [...queue, newItem];
          saveQueue(updated);

          return {
            success: true,
            offline: true
          };
        }

        return {
          success: false,
          error: err.message || 'Kunne ikke lagre resultat'
        };
      }
    },
    [queue, saveQueue]
  );

  return {
    isOnline,
    pendingCount: queue.length,
    pendingQueue: queue,
    queue,
    isSyncing,
    lastSyncMessage,
    syncNow: syncQueue,
    syncQueue,
    submitMatchScore
  };
}
