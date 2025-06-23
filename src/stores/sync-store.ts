import { ref, computed } from 'vue';

// Глобальный стейт для синхронизации лупов и метронома
export const useSyncStore = () => {
  // Основные параметры синхронизации
  const cycleDuration = ref<number>(0); // Длительность цикла в секундах
  const currentCycleStart = ref<number>(0); // Время начала текущего цикла
  const isSyncActive = ref<boolean>(false); // Флаг активности синхронизации
  const currentTimeForSync = ref<number>(Date.now()); // Текущее время для синхронизации

  // Параметры метронома
  const bpm = ref<number>(120); // BPM метронома
  const isMetronomeOn = ref<boolean>(false); // Включен ли метроном
  const metronomeVolume = ref<number>(0.7); // Громкость метронома

  // Синхронизация по тактам
  const beatsPerBar = ref<number>(4); // Ударов в такте (4/4)
  const currentBeat = ref<number>(0); // Текущий удар в такте
  const totalBeats = ref<number>(0); // Общее количество ударов в цикле

  // Таймеры
  let syncTimer: number | null = null;
  let metronomeTimer: number | null = null;
  let metronomeBeat = 0; // Счетчик ударов метронома

  // Вычисляем прогресс в текущем цикле (0-1)
  const currentCycleProgress = computed(() => {
    if (!isSyncActive.value || cycleDuration.value <= 0) return 0;

    const elapsed = (currentTimeForSync.value - currentCycleStart.value) / 1000;
    const progress = Math.min(1, Math.max(0, elapsed / cycleDuration.value));

    return progress;
  });

  // Вычисляем текущий удар в цикле
  const currentBeatInCycle = computed(() => {
    if (!isSyncActive.value || cycleDuration.value <= 0) return 0;

    const elapsed = (currentTimeForSync.value - currentCycleStart.value) / 1000;
    const beatInterval = 60 / bpm.value;
    const beat = Math.floor(elapsed / beatInterval);

    return beat;
  });

  // Вычисляем позицию в такте (0-1)
  const beatPosition = computed(() => {
    if (!isSyncActive.value || cycleDuration.value <= 0) return 0;

    const elapsed = (currentTimeForSync.value - currentCycleStart.value) / 1000;
    const beatInterval = 60 / bpm.value;
    const beatProgress = (elapsed % beatInterval) / beatInterval;

    return beatProgress;
  });

  // Вычисляем время до следующего удара
  const timeToNextBeat = computed(() => {
    if (!isSyncActive.value || cycleDuration.value <= 0) return 0;

    const elapsed = (currentTimeForSync.value - currentCycleStart.value) / 1000;
    const beatInterval = 60 / bpm.value;
    const timeInBeat = elapsed % beatInterval;

    return beatInterval - timeInBeat;
  });

  // Автоматический расчет BPM на основе длительности лупа
  function calculateBpmFromDuration(duration: number): number {
    // Ищем BPM, который даст целое количество тактов
    const possibleBpms = [60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];

    for (const testBpm of possibleBpms) {
      const beatInterval = 60 / testBpm;
      const beatsInDuration = duration / beatInterval;
      const barsInDuration = beatsInDuration / beatsPerBar.value;

      // Проверяем, близко ли к целому числу тактов
      const remainder = Math.abs(barsInDuration - Math.round(barsInDuration));
      if (remainder < 0.1) { // Погрешность менее 10%
        return testBpm;
      }
    }

    // Если не нашли подходящий, возвращаем ближайший к 120 BPM
    return 120;
  }

  // Функция воспроизведения клика метронома
  function playMetronomeClick(accent = false) {
    const ctx = new ((window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext))();
    const bufferSize = 2048;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Создаем clicky звук
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (accent ? 12 : 20));
      data[i] = (Math.random() * 2 - 1) * env * 1.5;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = accent ? 3200 : 2200;
    const gain = ctx.createGain();
    gain.gain.value = accent ? metronomeVolume.value * 1.3 : metronomeVolume.value * 1.2;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    setTimeout(() => {
      source.stop();
      void ctx.close();
    }, accent ? 25 : 30);
  }

  // Запуск синхронизированного метронома
  function startSyncedMetronome() {
    stopMetronome();
    if (!isMetronomeOn.value || !isSyncActive.value) return;

    const beatInterval = 60000 / bpm.value;
    metronomeBeat = 0;

    function metronomeTick() {
      if (!isMetronomeOn.value || !isSyncActive.value) return;

      // Определяем, является ли это акцентным ударом
      const isAccent = metronomeBeat % beatsPerBar.value === 0;

      // Воспроизводим клик
      playMetronomeClick(isAccent);

      // Обновляем счетчики
      metronomeBeat = (metronomeBeat + 1) % totalBeats.value;
      currentBeat.value = metronomeBeat;

      // Планируем следующий удар
      metronomeTimer = window.setTimeout(metronomeTick, beatInterval);
    }

    // Запускаем первый удар
    metronomeTick();
  }

  // Остановка метронома
  function stopMetronome() {
    if (metronomeTimer) {
      clearTimeout(metronomeTimer);
      metronomeTimer = null;
    }
    metronomeBeat = 0;
    currentBeat.value = 0;
  }

  // Запуск синхронизации (вызывается первым лупом при записи)
  function startSync(duration: number) {
    cycleDuration.value = duration;
    currentCycleStart.value = Date.now();
    isSyncActive.value = true;

    // Автоматически рассчитываем BPM и количество ударов
    const calculatedBpm = calculateBpmFromDuration(duration);
    bpm.value = calculatedBpm;

    const beatInterval = 60 / bpm.value;
    totalBeats.value = Math.round(duration / beatInterval);

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
    }, 50); // Увеличиваем частоту обновления для более точной синхронизации

    // Запускаем синхронизированный метроном
    if (isMetronomeOn.value) {
      startSyncedMetronome();
    }

    console.log('Sync started:', {
      duration,
      bpm: bpm.value,
      totalBeats: totalBeats.value,
      startTime: currentCycleStart.value
    });
  }

  // Остановка синхронизации
  function stopSync() {
    isSyncActive.value = false;
    stopSyncTimer();
    stopMetronome();
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
      metronomeBeat = 0;
      currentBeat.value = 0;

      // Перезапускаем метроном с новой точки отсчета
      if (isMetronomeOn.value) {
        startSyncedMetronome();
      }

      console.log('Cycle start updated:', currentCycleStart.value);
    }
  }

  // Управление метрономом
  function toggleMetronome() {
    isMetronomeOn.value = !isMetronomeOn.value;

    if (isMetronomeOn.value && isSyncActive.value) {
      startSyncedMetronome();
    } else {
      stopMetronome();
    }
  }

  function setBpm(newBpm: number) {
    bpm.value = Math.max(40, Math.min(240, newBpm));

    if (isSyncActive.value && cycleDuration.value > 0) {
      const beatInterval = 60 / bpm.value;
      totalBeats.value = Math.round(cycleDuration.value / beatInterval);

      if (isMetronomeOn.value) {
        startSyncedMetronome();
      }
    }
  }

  function setMetronomeVolume(volume: number) {
    metronomeVolume.value = Math.max(0, Math.min(1, volume));
  }

  // Получение времени до следующего удара для синхронизации записи
  function getTimeToNextBeat(): number {
    if (!isSyncActive.value || cycleDuration.value <= 0) return 0;
    return timeToNextBeat.value;
  }

  // Проверка, близко ли мы к удару (для автоматической синхронизации)
  function isNearBeat(threshold = 0.1): boolean {
    const timeToBeat = timeToNextBeat.value;
    const beatInterval = 60 / bpm.value;
    return timeToBeat <= threshold || timeToBeat >= beatInterval - threshold;
  }

  // Очистка при размонтировании
  function cleanup() {
    stopSyncTimer();
    stopMetronome();
  }

  return {
    // Состояние
    cycleDuration,
    currentCycleStart,
    isSyncActive,
    currentTimeForSync,
    currentCycleProgress,
    bpm,
    isMetronomeOn,
    metronomeVolume,
    currentBeat,
    totalBeats,
    currentBeatInCycle,
    beatPosition,
    timeToNextBeat,

    // Методы
    startSync,
    stopSync,
    updateCycleStart,
    toggleMetronome,
    setBpm,
    setMetronomeVolume,
    getTimeToNextBeat,
    isNearBeat,
    calculateBpmFromDuration,
    cleanup
  };
};

// Создаём глобальный экземпляр
export const syncStore = useSyncStore();
