import { syncStore } from '../stores/sync-store';

export function restartMetronome(metronomeRef: {
  startMetronome: () => void;
  stopMetronome: () => void;
  isMetronomeOn: () => boolean;
  bpm: () => number
} | null) {
  if (
    metronomeRef &&
    typeof metronomeRef.stopMetronome === 'function' &&
    typeof metronomeRef.startMetronome === 'function'
  ) {
    metronomeRef.stopMetronome();
    setTimeout(() => {
      metronomeRef.startMetronome();
    }, 50);
  }
}

// Функция для синхронизации записи с метрономом
export function syncRecordingWithMetronome(callback: () => void, delay = 0) {
  if (!syncStore.isSyncActive.value) {
    // Если синхронизация не активна, выполняем сразу
    setTimeout(callback, delay);
    return;
  }

  const timeToBeat = syncStore.getTimeToNextBeat();
  const beatInterval = 60 / syncStore.bpm.value;

  // Если мы близко к удару, ждем до следующего удара
  if (timeToBeat > 0.05 && timeToBeat < beatInterval - 0.05) {
    setTimeout(() => {
      syncRecordingWithMetronome(callback, delay);
    }, timeToBeat * 1000);
    return;
  }

  // Выполняем callback с задержкой
  setTimeout(callback, delay);
}

// Функция для получения времени до следующего удара
export function getTimeToNextBeat(): number {
  return syncStore.getTimeToNextBeat();
}

// Функция для проверки, близко ли мы к удару
export function isNearBeat(threshold = 0.1): boolean {
  return syncStore.isNearBeat(threshold);
}

// Функция для автоматического расчета BPM на основе длительности
export function calculateOptimalBpm(duration: number): number {
  return syncStore.calculateBpmFromDuration(duration);
}
