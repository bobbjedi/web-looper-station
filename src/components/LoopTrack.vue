<template>
  <div class="loop-track-wrapper flex flex-column items-center q-mb-lg">
    <!-- Универсальный круговой прогресс -->
    <div class="circle-wrapper"
      @wheel.prevent="onWheelVolume"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @mouseenter="showVolume = true"
      @mouseleave="showVolume = false"
    >
      <div v-if="showVolume || isTouching" class="volume-indicator">
        <q-icon name="volume_up" size="20px" class="q-mr-xs" />
        {{ Math.round(volume * 100) }}%
      </div>
      <CircularProgress
        :progress="universalProgress"
        :duration="masterDuration"
        :color="universalProgressColor"
        :backgroundColor="universalBackgroundColor"
        :size="100"
        @click="handleCircleClick"
        @touchend="handleCircleClick"
        :class="{
          'clickable': canStartRecording || isRecording || (audioUrl && !isRecording),
          'empty-loop': !audioUrl && !isRecording && !isWaitingForSound,
          'recording-pulse': isRecording || isWaitingForSound
        }"
      >
        <template #default>
          <q-icon
            v-if="isRecording"
            name="mic"
            color="red"
            size="36px"
            class="recording-icon"
          />
          <q-icon
            v-else-if="isWaitingForSound"
            name="mic"
            color="orange"
            size="36px"
            class="waiting-icon"
          />
          <q-icon
            v-else-if="isWaitingForSync"
            name="schedule"
            color="yellow-7"
            size="36px"
            class="waiting-sync-icon"
          />
          <q-icon
            v-else-if="isPlaying || isInCycle"
            name="play_arrow"
            color="green"
            size="36px"
            class="playing-icon"
          />
          <q-icon
            v-else-if="audioUrl"
            name="check_circle"
            color="primary"
            size="36px"
            class="recorded-icon"
          />
          <q-icon
            v-else
            name="mic"
            color="primary"
            size="42px"
            class="empty-mic-icon"
          />
        </template>
      </CircularProgress>
    </div>
    <div class="reset-btn-wrapper">
      <q-btn
        color="grey-8"
        icon="delete"
        @click="resetLoop"
        label="Сбросить"
        class="reset-btn q-mt-md"
        flat
        rounded
        size="md"
      />
    </div>

    <audio v-if="audioUrl" :src="audioUrl" ref="audioRef" style="display:none" />
  </div>
</template>

<script setup lang="ts">
import { ref, defineExpose, watch, defineEmits, onUnmounted, computed } from 'vue';
import CircularProgress from './CircularProgress.vue';
import { syncStore } from '../stores/sync-store';
import { settingsStore } from '../stores/settings-store';

const props = defineProps<{
  loopId: number,
  canRecord?: boolean,
  masterDuration?: number,
  masterDurationSec?: number,
  cycleStartTime?: number
}>();

const emit = defineEmits(['ended', 'first-recorded']);

const isRecording = ref(false);
const isPlaying = ref(false);
const isMuted = ref(false);
const isWaitingForSound = ref(false);
const isInCycle = ref(false);
const audioUrl = ref<string | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null);
const audioDuration = ref<number | null>(null);
const currentTime = ref(0);
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let micStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array = new Uint8Array(0);
let waitSoundTimer: number | null = null;
let autoStopTimer: number | null = null;
let progressTimer: number | null = null;
const isWaitingForSync = ref(false);

// Громкость
const volume = ref(1); // от 0 до 1
const showVolume = ref(false);
const isTouching = ref(false);
let lastTouchY = 0;

// Универсальные computed свойства для всех состояний
const universalProgress = computed(() => {
  if (isWaitingForSync.value && syncStore.isSyncActive.value) {
    return syncStore.currentCycleProgress.value;
  }
  return progressValue.value;
});

const universalProgressColor = computed(() => {
  if (isWaitingForSync.value) {
    return 'yellow';
  }
  return progressColor.value;
});

const universalBackgroundColor = computed(() => {
  if (isWaitingForSync.value) {
    return 'rgba(255, 235, 59, 0.13)';
  }
  return circleBgColor.value;
});

function setVolume(val: number) {
  volume.value = Math.max(0, Math.min(1, val));
  if (audioRef.value) {
    audioRef.value.volume = isMuted.value ? 0 : volume.value;
  }
}

function onWheelVolume(e: WheelEvent) {
  const delta = e.deltaY < 0 ? 0.05 : -0.05;
  setVolume(volume.value + delta);
  showVolume.value = true;
  // Типизация таймера без any
  const fn = onWheelVolume as unknown as Record<string, unknown>;
  if (fn._timer) {
    clearTimeout(fn._timer as number);
  }
  fn._timer = window.setTimeout(() => showVolume.value = false, 1200);
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1 && e.touches[0]) {
    isTouching.value = true;
    lastTouchY = e.touches[0].clientY;
  }
}
function onTouchMove(e: TouchEvent) {
  if (isTouching.value && e.touches.length === 1 && e.touches[0]) {
    const dy = lastTouchY - e.touches[0].clientY;
    lastTouchY = e.touches[0].clientY;
    setVolume(volume.value + dy * 0.005); // чувствительность
  }
}
function onTouchEnd() {
  isTouching.value = false;
  setTimeout(() => showVolume.value = false, 1000);
  handleCircleClick();
}

// Computed свойства для прогресса
const masterDuration = computed(() => {
  return Number(props.masterDuration) || 0;
});

const canStartRecording = computed(() => {
  return !audioUrl.value && !isRecording.value && props.canRecord !== false;
});

const shouldShowProgress = computed(() => {
  // Показываем прогресс при воспроизведении или записи >1 лупа
  return (isPlaying.value || isInCycle.value) || (isRecording.value && props.loopId > 1);
});

const progressValue = computed(() => {
  if (!shouldShowProgress.value || masterDuration.value <= 0) return 0;
  return Math.min(1, currentTime.value / masterDuration.value);
});

const progressColor = computed(() => {
  if (isRecording.value) return 'rgba(244, 67, 54, 0.8)'; // полупрозрачный красный для записи
  if (isPlaying.value || isInCycle.value) return 'rgba(76, 175, 80, 0.8)'; // полупрозрачный зелёный для воспроизведения
  return 'rgba(33, 150, 243, 0.8)'; // полупрозрачный синий по умолчанию
});

const circleBgColor = computed(() => {
  // Если луп замьючен - полупрозрачный серый фон
  if (isMuted.value) return 'rgba(117, 117, 117, 0.3)'; // полупрозрачный серый для замьюченного состояния
  if (isRecording.value) return 'rgba(244, 67, 54, 0.2)'; // полупрозрачный красный фон для записи
  if (isPlaying.value || isInCycle.value) return 'rgba(76, 175, 80, 0.2)'; // полупрозрачный зелёный фон для воспроизведения
  return 'rgba(33, 150, 243, 0.2)'; // полупрозрачный синий фон по умолчанию
});

function toggleRecording() {
  if (!isRecording.value) {
    if (props.loopId === 1) {
      waitForSoundStart();
    } else {
      console.log('Setting isWaitingForSync = true for loopId:', props.loopId);
      isWaitingForSync.value = true;
    }
  } else {
    stopRecording();
  }
}

function waitForSoundStart() {
  isWaitingForSound.value = true;
  void navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    micStream = stream;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new AudioCtx();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    dataArray = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    checkSoundLevel();
  });
}

function checkSoundLevel() {
  if (!analyser) return;
  analyser.getByteTimeDomainData(dataArray);
  let peak = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const val = Math.abs(((dataArray[i] ?? 0) - 128) / 128);
    if (val > peak) peak = val;
  }
  if (peak > (settingsStore.soundThreshold.value || 0.2)) {
    stopMicMonitor();
    startRecording().catch(console.error);
  } else {
    waitSoundTimer = window.setTimeout(checkSoundLevel, 50);
  }
}

function stopMicMonitor() {
  isWaitingForSound.value = false;
  if (waitSoundTimer) clearTimeout(waitSoundTimer);
  if (audioContext) void audioContext.close();
  if (micStream) micStream.getTracks().forEach(track => track.stop());
  analyser = null;
  audioContext = null;
  micStream = null;
}

async function startRecording() {
  isWaitingForSound.value = false;

  // Для первого лупа запускаем глобальную синхронизацию
  if (props.loopId === 1) {
    // Запускаем синхронизацию с примерной длительностью (будет обновлена после записи)
    syncStore.startSync(5); // временная длительность
  }

  // Проверка masterDuration для не первого лупа
  if (props.loopId !== 1) {
    const md = Number(props.masterDuration);
    if (!md || !isFinite(md) || md <= 0) {
      console.warn('Некорректный masterDuration для loopId', props.loopId, ':', props.masterDuration);
      return;
    }
    // Запускаем прогресс для записи >1 лупа
    startProgressTimer();
  }
  console.log('startRecording', props.loopId, 'masterDuration:', props.masterDuration);
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];
  mediaRecorder.ondataavailable = (e) => {
    console.log('ondataavailable', props.loopId, e.data.size);
    if (e.data && e.data.size > 0) audioChunks.push(e.data);
  };
  mediaRecorder.onstop = async () => {
    console.log('MediaRecorder onstop', props.loopId, audioChunks.length);
    if (audioChunks.length === 0) return;
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    if (audioBlob.size === 0) return;
    audioUrl.value = URL.createObjectURL(audioBlob);

    // Получаем длительность аудио через AudioContext
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      audioDuration.value = audioBuffer.duration;
      console.log('loopId', props.loopId, 'decoded audioDuration', audioDuration.value, 'blob size', audioBlob.size);
      void audioCtx.close();
    } catch (error) {
      console.error('Ошибка декодирования аудио для loopId', props.loopId, ':', error);
      // Fallback: пробуем через tempAudio
      const tempAudio = new Audio(audioUrl.value);
      tempAudio.onloadedmetadata = () => {
        const duration = tempAudio.duration;
        if (isFinite(duration) && duration > 0) {
          audioDuration.value = duration;
          console.log('loopId', props.loopId, 'tempAudio audioDuration', audioDuration.value);
        } else {
          console.warn('Некорректная длительность через tempAudio для loopId', props.loopId, ':', duration);
          audioDuration.value = 5.0; // 5 секунд по умолчанию
          console.log('loopId', props.loopId, 'fallback audioDuration', audioDuration.value);
        }
      };
    }

    // Вызываем централизованную обработку завершения записи
    onRecordingComplete();
  };
  mediaRecorder.start();
  isRecording.value = true;
  // Если это не первый луп и задана masterDuration — автостоп по таймеру
  if (props.loopId !== 1 && props.masterDuration && props.masterDuration > 0) {
    autoStopTimer = null;
    const minDuration = 300; // минимальная длительность записи 300 мс
    const autoStopDelay = Math.max(props.masterDuration * 1000, minDuration);
    autoStopTimer = window.setTimeout(() => {
      console.log('autoStopTimer fired', props.loopId, 'after', autoStopDelay, 'ms, masterDuration:', props.masterDuration);
      if (isRecording.value) stopRecording();
    }, autoStopDelay);
  }
}

function stopRecording() {
  stopMicMonitor();
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
  if (mediaRecorder) {
    mediaRecorder.stop();
    isRecording.value = false;
  }
  stopProgressTimer();
}

function startProgressTimer() {
  stopProgressTimer();
  currentTime.value = 0;
  progressTimer = window.setInterval(() => {
    currentTime.value += 0.1; // обновляем каждые 100мс
  }, 100);
}

function stopProgressTimer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  currentTime.value = 0;
}

function playAudio() {
  if (audioRef.value) {
    audioRef.value.currentTime = 0;
    void audioRef.value.play();
    isPlaying.value = true;
    isInCycle.value = true;
    startProgressTimer();
    audioRef.value.onended = () => {
      isPlaying.value = false;
      emit('ended');
    };
    // Устанавливаем громкость в зависимости от mute
    audioRef.value.volume = isMuted.value ? 0 : volume.value;
    // Все лупы обрезаются по masterDuration для синхронизации
    if (props.masterDuration && props.masterDuration > 0) {
      setTimeout(() => {
        if (isPlaying.value) {
          isPlaying.value = false;
          stopProgressTimer();
          // Не сбрасываем isInCycle здесь - он сбросится только при полной остановке
        }
      }, props.masterDuration * 1000);
    }
  }
}

function stopAudio() {
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value.currentTime = 0;
    isPlaying.value = false;
    isInCycle.value = false;
    stopProgressTimer();
  }
}

function resetLoop() {
  if (isRecording.value) {
    stopRecording();
  }
  stopAudio();
  audioUrl.value = null;
  audioDuration.value = null;
  isMuted.value = false;
  isPlaying.value = false;
  isInCycle.value = false;
  stopProgressTimer();
}

// Если mute меняется во время воспроизведения
watch(isMuted, (val) => {
  if (audioRef.value && typeof audioRef.value.volume === 'number') {
    audioRef.value.volume = val ? 0 : volume.value;
  }
});

watch(volume, (val) => {
  if (audioRef.value && !isMuted.value && typeof audioRef.value.volume === 'number') {
    audioRef.value.volume = val;
  }
});

function handleCircleClick() {
  // Если записываем - останавливаем запись
  if (isRecording.value) {
    stopRecording();
    return;
  }

  // Если можно начать запись - запускаем
  if (canStartRecording.value) {
    // Добавляем тактильную обратную связь
    if (navigator.vibrate) {
      navigator.vibrate(50); // короткая вибрация 50мс
    }

    // Добавляем визуальную обратную связь
    const circle = document.querySelector('.clickable') as HTMLElement;
    if (circle) {
      circle.style.transform = 'scale(0.95)';
      setTimeout(() => {
        circle.style.transform = '';
      }, 150);
    }

    if (props.loopId === 1) {
      toggleRecording();
    } else {
      console.log('Setting isWaitingForSync = true for loopId:', props.loopId);
      isWaitingForSync.value = true;
    }
  } else if (audioUrl.value && !isRecording.value) {
    // Если есть запись и не записываем - управляем воспроизведением и mute
    if (isPlaying.value) {
      // Если воспроизводится - переключаем mute
      isMuted.value = !isMuted.value;
      if (audioRef.value) {
        audioRef.value.volume = isMuted.value ? 0 : volume.value;
      }
    } else {
      // Если не воспроизводится - запускаем воспроизведение
      playAudio();
    }
  }
}

function startSyncedRecording() {
  console.log('startSyncedRecording called for loopId:', props.loopId, 'isWaitingForSync:', isWaitingForSync.value);
  if (isWaitingForSync.value) {
    isWaitingForSync.value = false;
    console.log('Starting synced recording for loopId:', props.loopId);
    void startRecording();
  }
}

function onRecordingComplete() {
  isRecording.value = false;
  if (mediaRecorder) {
    mediaRecorder = null;
  }

  // Для первого лупа обновляем длительность синхронизации
  if (props.loopId === 1 && audioDuration.value) {
    syncStore.startSync(audioDuration.value);
    console.log('Updated sync duration to:', audioDuration.value);
  }

  emit('first-recorded');
}

defineExpose({ playAudio, stopAudio, isPlaying, audioUrl, audioDuration, isInCycle, startSyncedRecording, isWaitingForSync: () => isWaitingForSync.value });

onUnmounted(() => {
  stopMicMonitor();
  stopProgressTimer();
});
</script>

<style scoped>
.loop-track-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  background: none;
  box-shadow: none;
  border: none;
  min-width: 250px;
  max-width: 350px;
}
.circle-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}
.reset-btn-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.reset-btn {
  background: rgba(80,80,80,0.12);
  color: #fff;
  border-radius: 24px;
  font-weight: 500;
  letter-spacing: 0.03em;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  margin-top: 18px;
  margin-bottom: 0;
  min-width: 120px;
  font-size: 1rem;
}
.reset-btn:hover {
  background: rgba(80,80,80,0.22);
  color: #fff;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}
.reset-btn:active {
  background: rgba(80,80,80,0.32);
  color: #eee;
}

.q-card {
  width: 100%;
}

.btn-fixed {
  min-width: 120px;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.btn-fixed:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-fixed:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

/* Специальные стили для кнопки записи */
.btn-fixed:has(.q-icon[name="mic"]) {
  background: linear-gradient(135deg, #1976d2, #42a5f5);
  border: none;
}

.btn-fixed:has(.q-icon[name="mic"]):hover {
  background: linear-gradient(135deg, #1565c0, #1976d2);
}

/* Анимация для кнопки записи во время записи */
.btn-fixed:has(.q-icon[name="mic"]):has(.text-red) {
  animation: recording-button-pulse 1.5s ease-in-out infinite;
}

@keyframes recording-button-pulse {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
  }
  50% {
    box-shadow: 0 4px 20px rgba(244, 67, 54, 0.6);
  }
}

.clickable {
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.clickable:hover {
  transform: scale(1.05);
  filter: brightness(1.1);
}

.clickable:active {
  transform: scale(0.95);
}

.empty-loop {
  position: relative;
}

.empty-loop::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #1976d2, #42a5f5, #1976d2, #42a5f5, #1976d2);
  background-size: 100% 100%;
  animation: shimmer-rotate 2s linear infinite;
  z-index: -1;
  opacity: 0.4;
}

.recording-pulse {
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

.empty-mic-icon {
  filter: drop-shadow(0 2px 4px rgba(25, 118, 210, 0.3));
  transition: all 0.3s ease;
}

.clickable:hover .empty-mic-icon {
  transform: scale(1.1);
  filter: drop-shadow(0 4px 8px rgba(25, 118, 210, 0.5));
}

.recording-icon {
  animation: recording-bounce 0.6s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(244, 67, 54, 0.5));
}

.waiting-icon {
  animation: waiting-rotate 2s linear infinite;
  filter: drop-shadow(0 2px 4px rgba(255, 152, 0, 0.5));
}

.playing-icon {
  animation: playing-pulse 1s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(76, 175, 80, 0.5));
}

.recorded-icon {
  filter: drop-shadow(0 2px 4px rgba(25, 118, 210, 0.5));
}

.waiting-sync-icon {
  animation: waiting-rotate 2s linear infinite;
  filter: drop-shadow(0 2px 4px rgba(255, 215, 0, 0.5));
}

@keyframes shimmer-rotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.7);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 0 10px rgba(244, 67, 54, 0);
  }
}

@keyframes recording-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

@keyframes waiting-rotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes playing-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Улучшенные стили для подсказки */
.text-caption {
  font-size: 0.75rem;
  line-height: 1.2;
  opacity: 0.8;
  transition: opacity 0.3s ease;
}

.clickable:hover + .text-caption {
  opacity: 1;
}

.volume-indicator {
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30,30,40,0.92);
  color: #fff;
  border-radius: 12px;
  padding: 2px 14px 2px 10px;
  font-size: 1.05rem;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0,0,0,0.13);
  z-index: 10;
  pointer-events: none;
  display: flex;
  align-items: center;
  opacity: 0.97;
  user-select: none;
}

@media (max-width: 600px) {
  .loop-track-wrapper {
    min-width: 0;
    max-width: 96vw;
    margin-bottom: 18px;
  }
  .circle-wrapper {
    width: auto;
    min-width: 0;
    max-width: none;
    margin-left: auto;
    margin-right: auto;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .reset-btn {
    min-width: 44vw;
    font-size: 0.98rem;
    margin-top: 10px;
  }
  .volume-indicator {
    font-size: 0.95rem;
    top: -22px;
    padding: 2px 10px 2px 8px;
  }
}
</style>
