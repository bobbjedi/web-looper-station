import { ref, computed } from 'vue';

// Глобальный стейт для синхронизации лупов
export const useSyncStore = () => {
  // Длительность цикла в секундах (устанавливается первым лупом)
  const cycleDuration = ref<number>(0);

  // Время начала текущего цикла
  const currentCycleStart = ref<number>(0);

  // Флаг активности синхронизации
  const isSyncActive = ref<boolean>(false);

  // Текущее время для синхронизации (обновляется каждые 100мс)
  const currentTimeForSync = ref<number>(Date.now());

  // Таймер для обновления времени синхронизации
  let syncTimer: number | null = null;

  // Вычисляем прогресс в текущем цикле (0-1)
  const currentCycleProgress = computed(() => {
    if (!isSyncActive.value || cycleDuration.value <= 0) return 0;

    const elapsed = (currentTimeForSync.value - currentCycleStart.value) / 1000;
    const progress = Math.min(1, Math.max(0, elapsed / cycleDuration.value));

    return progress;
  });

  // Запуск синхронизации (вызывается первым лупом при записи)
  function startSync(duration: number) {
    cycleDuration.value = duration;
    currentCycleStart.value = Date.now();
    isSyncActive.value = true;

    // Запускаем таймер обновления времени
    if (syncTimer) {
      clearInterval(syncTimer);
    }
    syncTimer = window.setInterval(() => {
      if (isSyncActive.value) {
        currentTimeForSync.value = Date.now();
      } else {
        stopSyncTimer();
      }
    }, 100);

    console.log('Sync started:', { duration, startTime: currentCycleStart.value });
  }

  // Остановка синхронизации
  function stopSync() {
    isSyncActive.value = false;
    stopSyncTimer();
    console.log('Sync stopped');
  }

  // Остановка таймера
  function stopSyncTimer() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  // Обновление времени начала цикла (при каждом новом цикле)
  function updateCycleStart() {
    if (isSyncActive.value && cycleDuration.value > 0) {
      currentCycleStart.value = Date.now();
      console.log('Cycle start updated:', currentCycleStart.value);
    }
  }

  // Очистка при размонтировании
  function cleanup() {
    stopSyncTimer();
  }

  return {
    // Состояние
    cycleDuration,
    currentCycleStart,
    isSyncActive,
    currentTimeForSync,
    currentCycleProgress,

    // Методы
    startSync,
    stopSync,
    updateCycleStart,
    cleanup
  };
};

// Создаём глобальный экземпляр
export const syncStore = useSyncStore();
