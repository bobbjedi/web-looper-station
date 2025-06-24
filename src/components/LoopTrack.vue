<template>
  <div class="loop-track-wrapper flex flex-column items-center q-mb-lg">
    <!-- Финальная длительность лупа -->
    <div v-if="audioDuration && !isRecording" class="final-duration q-mb-xs">
      Длительность лупа: {{ audioDuration.toFixed(2) }} сек
    </div>
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
          <span v-if="isRecording && props.loopId === 1" class="timer-in-circle">{{ currentTime.toFixed(1) }}</span>
          <q-icon
            v-else-if="isRecording"
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

    <!-- Кнопки редактирования -->
    <div v-if="audioUrl && !isEditing" class="edit-controls q-mt-sm">
      <q-btn
        color="orange"
        icon="edit"
        @click="startEditing"
        label="Редактировать"
        class="edit-btn"
        flat
        rounded
        size="sm"
      />
    </div>

    <!-- Всплывающая форма редактирования -->
    <q-dialog v-model="isEditing" persistent maximized>
      <q-card class="edit-dialog">
        <q-card-section class="edit-header">
          <div class="text-h6">Редактирование лупа {{ loopId }}</div>
          <q-btn
            icon="close"
            flat
            round
            dense
            @click="stopEditing"
            class="close-btn"
          />
        </q-card-section>

        <q-card-section class="edit-content">
          <!-- Информация о длительности -->
          <div class="duration-info q-mb-md">
            <div class="text-subtitle2">
              Длина: {{ (editEndTime - editStartTime).toFixed(2) }} сек
            </div>
          </div>

          <!-- Визуализация waveform -->
          <div class="waveform-section q-mb-lg">
            <div class="text-subtitle2 q-mb-sm">Визуализация звука</div>
            <AudioWaveform
              :audio-url="audioUrl"
              :start-time="editStartTime"
              :end-time="editEndTime"
              :duration="audioDuration || 0"
              :bpm="props.metronomeRef?.bpm() || 95"
              :is-metronome-on="props.metronomeRef?.isMetronomeOn() || false"
              @update:start-time="editStartTime = $event"
              @update:end-time="editEndTime = $event"
            />
          </div>

          <!-- Слайдеры управления -->
          <div class="sliders-section q-mb-lg">
            <div class="slider-group q-mb-md">
              <div class="slider-label text-subtitle2 q-mb-xs">Начало обрезки</div>
              <q-slider
                v-model="editStartTime"
                :min="0"
                :max="audioDuration ?? 1"
                :step="0.1"
                color="blue"
                class="edit-slider"
                label
                label-always
              />
            </div>

            <div class="slider-group">
              <div class="slider-label text-subtitle2 q-mb-xs">Конец обрезки</div>
              <q-slider
                v-model="editEndTime"
                :min="0"
                :max="audioDuration ?? 1"
                :step="0.1"
                color="red"
                class="edit-slider"
                label
                label-always
              />
            </div>
          </div>

          <!-- Контролы предварительного прослушивания -->
          <div class="preview-section q-mb-lg">
            <div class="text-subtitle2 q-mb-sm">Предварительное прослушивание</div>
            <div class="preview-controls row q-gutter-sm justify-center">
              <q-btn
                v-if="!isPreviewPlaying"
                color="primary"
                icon="play_arrow"
                @click="playPreview"
                label="Возобновить"
                class="preview-btn"
              />
              <q-btn
                v-if="isPreviewPlaying"
                color="orange"
                icon="stop"
                @click="stopPreview"
                label="Стоп"
                class="preview-btn"
              />
              <q-btn
                color="secondary"
                icon="volume_up"
                @click="togglePreviewMute"
                :label="isPreviewMuted ? 'Включить звук' : 'Выключить звук'"
                class="preview-btn"
              />
            </div>
            <div class="text-caption text-center q-mt-sm text-grey-4">
              Луп автоматически перезапускается при изменении обрезки
            </div>
          </div>
        </q-card-section>

        <q-card-actions class="edit-actions">
          <q-btn
            color="green"
            icon="check"
            @click="trimAudio"
            label="Применить обрезку"
            class="apply-btn"
            size="lg"
          />
          <q-btn
            color="grey"
            icon="close"
            @click="stopEditing"
            label="Отмена"
            class="cancel-btn"
            size="lg"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Скрытый аудио для предварительного прослушивания -->
    <audio v-if="previewAudioUrl" :src="previewAudioUrl" ref="previewAudioRef" style="display:none" />
    <audio v-if="audioUrl" :src="audioUrl" ref="audioRef" style="display:none" />
  </div>
</template>

<script setup lang="ts">
import { ref, defineExpose, watch, defineEmits, onUnmounted, computed, onMounted } from 'vue';
import CircularProgress from './CircularProgress.vue';
import AudioWaveform from './AudioWaveform.vue';
import { syncStore } from '../stores/sync-store';
import { settingsStore } from '../stores/settings-store';
import { processRecordedAudio, audioBufferToWav, detectLoopLengthByAutocorrelation } from '../utils/audio-utils';

const props = defineProps<{
  loopId: number,
  canRecord?: boolean,
  masterDuration?: number,
  masterDurationSec?: number,
  cycleStartTime?: number,
  metronomeRef?: { startMetronome: () => void; stopMetronome: () => void; isMetronomeOn: () => boolean; bpm: () => number } | null
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

// Состояние редактирования
const isEditing = ref(false);
const editStartTime = ref(0);
const editEndTime = ref(0);
const originalAudioUrl = ref<string | null>(null);

// Состояние предварительного прослушивания
const isPreviewPlaying = ref(false);
const isPreviewMuted = ref(false);
const hasStartedPreview = ref(false);
const previewAudioUrl = ref<string | null>(null);
const previewAudioRef = ref<HTMLAudioElement | null>(null);

// Громкость
const volume = ref(1); // от 0 до 1
const showVolume = ref(false);
const isTouching = ref(false);
let lastTouchY = 0;

// Универсальные computed свойства для всех состояний
const universalProgress = computed(() => {
  // Если луп воспроизводится или находится в цикле — используем глобальный прогресс
  if (isPlaying.value || isInCycle.value) {
    return syncStore.currentCycleProgress.value;
  }
  // Если идет запись (кроме первого лупа) — используем локальный прогресс
  if (isRecording.value && props.loopId > 1) {
    return progressValue.value;
  }
  // Остальные состояния (например, редактирование)
  return 0;
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
      waitForSoundStart();
    } else {
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
    // Запускаем таймер для отображения времени записи
    startProgressTimer();

    // СРАЗУ запускаем автоанализ для первого лупа во время записи
    console.log(`🚀 [Loop ${props.loopId}] Запускаем автоанализ во время записи`, {
      isAutoAnalysisActive: syncStore.isAutoAnalysisActive.value,
      timestamp: new Date().toISOString()
    });
    if (!syncStore.isAutoAnalysisActive.value) {
      syncStore.startAutoAnalysis();
    } else {
      console.log(`ℹ️ [Loop ${props.loopId}] Автоанализ уже активен, перезапускаем для надёжности`);
      // Принудительно перезапускаем автоанализ для надёжности
      syncStore.stopAutoAnalysis();
      syncStore.startAutoAnalysis();
    }
  }

  // Для последующих лупов проверяем синхронизацию
  if (props.loopId !== 1) {
    if (!syncStore.isSyncActive.value) {
      console.warn('Синхронизация не активна для лупа', props.loopId);
      return;
    }

    // Проверяем, близко ли мы к удару для точной синхронизации
    const timeToBeat = syncStore.getTimeToNextBeat();
    if (timeToBeat > 0.1 && timeToBeat < 0.9) {
      // Если мы не близко к удару, ждем до следующего удара
      console.log('Ожидание до следующего удара для точной синхронизации');
      setTimeout(() => {
        if (isWaitingForSync.value) {
          void startRecording();
        }
      }, timeToBeat * 1000);
      return;
    }

    // Запускаем прогресс для записи >1 лупа
    startProgressTimer();
  }

  console.log('startRecording', props.loopId, 'masterDuration:', props.masterDuration);
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  console.log(`🎙️ [Loop ${props.loopId}] MediaRecorder создан:`, {
    state: mediaRecorder.state,
    timestamp: new Date().toISOString()
  });

  mediaRecorder.ondataavailable = (e) => {
    console.log('ondataavailable', props.loopId, e.data.size);
    if (e.data && e.data.size > 0) {
      audioChunks.push(e.data);
      console.log(`📦 [Loop ${props.loopId}] audioChunks обновлен:`, {
        chunksLength: audioChunks.length,
        totalSize: audioChunks.reduce((sum, chunk) => sum + chunk.size, 0),
        timestamp: new Date().toISOString()
      });
    }
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
    void onRecordingComplete();
  };

  // Настраиваем MediaRecorder для генерации событий каждые 1 секунду
  mediaRecorder.start(1000); // Генерируем ondataavailable каждые 1000мс (1 секунда)
  console.log(`▶️ [Loop ${props.loopId}] MediaRecorder.start(1000) вызван:`, {
    state: mediaRecorder.state,
    timestamp: new Date().toISOString()
  });
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

  // Для первого лупа обновляем длительность синхронизации и автоматически включаем метроном
  if (props.loopId === 1 && audioDuration.value) {
    syncStore.startSync(audioDuration.value);

    // Автоматически включаем метроном после записи первого лупа
    if (!syncStore.isMetronomeOn.value) {
      syncStore.toggleMetronome();
    }

    console.log('Updated sync duration to:', audioDuration.value, 'BPM:', syncStore.bpm.value);
  }

  emit('first-recorded');
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
    // Проверяем, готово ли аудио к воспроизведению
    if (audioRef.value.readyState < 2) { // HAVE_CURRENT_DATA
      console.log('Audio not ready, waiting for load...');
      audioRef.value.addEventListener('canplay', () => {
        // Повторно вызываем playAudio когда аудио готово
        if (isInCycle.value && audioRef.value) {
          playAudio();
        }
      }, { once: true });
      return;
    }

    // Синхронизируем воспроизведение с метрономом
    if (syncStore.isSyncActive.value && syncStore.isMetronomeOn.value) {
      const timeToBeat = syncStore.getTimeToNextBeat();
      const beatInterval = 60 / syncStore.bpm.value;

      // Если мы не близко к удару, ждем до следующего удара
      if (timeToBeat > 0.05 && timeToBeat < beatInterval - 0.05) {
        setTimeout(() => {
          if (isInCycle.value) {
            playAudio();
          }
        }, timeToBeat * 1000);
        return;
      }
    }

    audioRef.value.currentTime = 0;
    audioRef.value.loop = true; // Включаем зацикливание для всех лупов

    // Добавляем обработку ошибок воспроизведения
    const playPromise = audioRef.value.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (audioRef.value) {
            isPlaying.value = true;
            isInCycle.value = true;
            startProgressTimer();

            // Убираем обработчик onended, так как теперь луп зацикливается
            audioRef.value.onended = null;

            // Устанавливаем громкость в зависимости от mute
            audioRef.value.volume = isMuted.value ? 0 : volume.value;
          }
        })
        .catch((error) => {
          console.error('Error playing audio for loop', props.loopId, ':', error);
          // Не устанавливаем флаги воспроизведения при ошибке
          isPlaying.value = false;
          isInCycle.value = false;
          stopProgressTimer();
        });
    }
  }
}

function stopAudio() {
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value.currentTime = 0;
    audioRef.value.loop = false; // Отключаем зацикливание
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
  // Сброс состояния редактирования
  isEditing.value = false;
  originalAudioUrl.value = null;
}

// Функции редактирования
function startEditing() {
  if (!audioUrl.value || !audioDuration.value) return;

  editStartTime.value = 0;
  editEndTime.value = audioDuration.value ?? 0;
  isEditing.value = true;
  originalAudioUrl.value = audioUrl.value;

  // Создаем предварительное аудио и автоматически запускаем прослушивание
  void createPreviewAudio().then(() => {
    // Автоматически запускаем прослушивание при открытии редактирования
    setTimeout(() => {
      playPreview();
    }, 100);
  });

  console.log('Started editing loop', props.loopId, 'duration:', audioDuration.value);
}

function stopEditing() {
  isEditing.value = false;
  isPreviewPlaying.value = false;
  hasStartedPreview.value = false;

  // Очищаем таймер обновления
  if (previewUpdateTimer) {
    clearTimeout(previewUpdateTimer);
    previewUpdateTimer = null;
  }

  // Очищаем предварительное аудио
  if (previewAudioUrl.value) {
    URL.revokeObjectURL(previewAudioUrl.value);
    previewAudioUrl.value = null;
  }

  // Восстанавливаем основное воспроизведение если нужно
  if (audioRef.value && isPlaying.value) {
    const playPromise = audioRef.value.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.error('Error resuming audio after editing:', error);
      });
    }
  }
}

async function trimAudio() {
  if (!originalAudioUrl.value || !audioDuration.value) return;

  try {
    console.log('Trimming audio for loop', props.loopId, 'from', editStartTime.value, 'to', editEndTime.value);

    // Создаём AudioContext для обработки
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();

    // Загружаем оригинальное аудио
    const response = await fetch(originalAudioUrl.value);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Вычисляем параметры обрезки
    const startSample = Math.floor(editStartTime.value * audioCtx.sampleRate);
    const endSample = Math.floor(editEndTime.value * audioCtx.sampleRate);
    const newLength = endSample - startSample;

    // Создаём новый буфер с обрезанным аудио
    const numberOfChannels = typeof audioBuffer.numberOfChannels === 'number' && isFinite(audioBuffer.numberOfChannels)
      ? audioBuffer.numberOfChannels
      : 1;
    const newBuffer = audioCtx.createBuffer(
      numberOfChannels,
      newLength,
      audioCtx.sampleRate
    );

    // Копируем данные из оригинального буфера
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const src = audioBuffer.getChannelData(ch);
      const dst = newBuffer.getChannelData(ch);
      for (let i = 0; i < newLength; i++) {
        const sampleIndex = startSample + i;
        const sample = src[sampleIndex];
        dst[i] = typeof sample === 'number' ? sample : 0;
      }
    }

    // Конвертируем обратно в Blob
    const offlineCtx = new OfflineAudioContext(
      numberOfChannels,
      newBuffer.length,
      newBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = newBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();

    // Конвертируем в WAV
    const wavBlob = audioBufferToWav(renderedBuffer);

    // Обновляем URL и длительность
    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value);
    }
    audioUrl.value = URL.createObjectURL(wavBlob);
    audioDuration.value = (editEndTime.value ?? 0) - (editStartTime.value ?? 0);

    // Очистка
    void audioCtx.close();

    console.log('Audio trimmed successfully, new duration:', audioDuration.value);
    stopEditing();

  } catch (error) {
    console.error('Error trimming audio:', error);
    stopEditing();
  }
}

// Watchers для валидации слайдеров
watch(editStartTime, (newStart) => {
  if (newStart >= editEndTime.value) {
    editStartTime.value = Math.max(0, editEndTime.value - 0.1);
  }
});

watch(editEndTime, (newEnd) => {
  if (newEnd <= editStartTime.value) {
    editEndTime.value = Math.min(audioDuration.value ?? 1, editStartTime.value + 0.1);
  }
});

// Таймер для debounce обновления предварительного аудио
let previewUpdateTimer: number | null = null;

watch([editStartTime, editEndTime], () => {
  if (previewUpdateTimer) {
    clearTimeout(previewUpdateTimer);
  }
  previewUpdateTimer = window.setTimeout(() => {
    void createPreviewAudio().then(() => {
      if (isPreviewPlaying.value) {
        stopPreview();
        setTimeout(() => {
          playPreview();
        }, 100);
      }
    });
  }, 300);
});

function startSyncedRecording() {
  console.log('startSyncedRecording called for loopId:', props.loopId, 'isWaitingForSync:', isWaitingForSync.value);
  if (isWaitingForSync.value) {
    isWaitingForSync.value = false;
    console.log('Starting synced recording for loopId:', props.loopId);
    void startRecording();
  }
}

async function onRecordingComplete() {
  isRecording.value = false;
  if (mediaRecorder) {
    mediaRecorder = null;
  }

  // Обрабатываем записанное аудио: дополняем пустотой если нужно
  if (audioUrl.value && audioDuration.value) {
    try {
      // Получаем оригинальный blob из URL
      const response = await fetch(audioUrl.value);
      const originalBlob = await response.blob();

      // Определяем целевую длительность
      let targetDuration = audioDuration.value;
      let cutBuffer: AudioBuffer | null = null;
      let usedAutocorr = false;

      // Для первого лупа — пробуем найти повторяющийся рифф
      if (props.loopId === 1) {
        // Проверяем, не был ли уже найден рифф во время записи
        // Если audioDuration уже установлена и находится в разумных пределах,
        // значит автоанализ уже сработал
        const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const arrayBuffer = await originalBlob.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const fullDuration = audioBuffer.duration;

        // Проверяем, что текущая длительность значительно меньше полной записи
        // и находится в пределах настроек (minLoopDuration - maxLoopDuration)
        const minExpectedDuration = settingsStore.minLoopDuration.value ?? 4; // минимальная длительность
        const maxExpectedDuration = settingsStore.maxLoopDuration.value ?? 8; // максимальная длительность (2 * min)
        const hasAutoAnalysisAlreadyWorked = audioDuration.value >= minExpectedDuration &&
                                           audioDuration.value <= maxExpectedDuration &&
                                           audioDuration.value < fullDuration * 0.8; // меньше 80% от полной записи

        if (hasAutoAnalysisAlreadyWorked) {
          console.log('[Looper] Автоанализ уже сработал во время записи, пропускаем повторный анализ', {
            currentDuration: audioDuration.value,
            fullDuration: fullDuration,
            minExpected: minExpectedDuration,
            maxExpected: maxExpectedDuration
          });
          // Используем текущую длительность без повторного анализа
          targetDuration = audioDuration.value;
          void audioCtx.close();
        } else {
          // Выполняем анализ только если автоанализ не сработал
          const samples = audioBuffer.getChannelData(0);
          const sampleRate = typeof audioBuffer.sampleRate === 'number' && isFinite(audioBuffer.sampleRate)
            ? audioBuffer.sampleRate
            : 44100;
          const duration = typeof audioBuffer.duration === 'number' && isFinite(audioBuffer.duration)
            ? audioBuffer.duration
            : samples.length / sampleRate;
          const numberOfChannels = typeof audioBuffer.numberOfChannels === 'number' && isFinite(audioBuffer.numberOfChannels)
            ? audioBuffer.numberOfChannels
            : 1;
          const maxSec = settingsStore.maxLoopDuration.value ?? 8;
          const minSec = settingsStore.minLoopDuration.value ?? 4;
          console.log(`📊 [Loop ${props.loopId}] Анализ текущей записи: sampleRate=${sampleRate}, duration=${duration.toFixed(2)}, minSec=${minSec}, maxSec=${maxSec}`);
          const bestLag = detectLoopLengthByAutocorrelation(samples, sampleRate, minSec, maxSec, settingsStore.autocorrAccuracy.value);
          console.log(`🎵 [Loop ${props.loopId}] Результат анализа текущей записи: bestLag=${bestLag}, новая длительность=${bestLag / sampleRate}с`);
          if (bestLag > sampleRate * 0.5 && bestLag < samples.length * 0.9) {
            // Берём второй кусок длиной bestLag (а не первый)
            const startIdx = bestLag;
            const endIdx = Math.min(bestLag * 2, samples.length);
            const actualLen = endIdx - startIdx;
            cutBuffer = audioCtx.createBuffer(numberOfChannels, actualLen, sampleRate);
            const src = audioBuffer.getChannelData(0);
            const dst = cutBuffer.getChannelData(0);
            for (let i = 0; i < actualLen; i++) {
              const sample = src[startIdx + i];
              dst[i] = typeof sample === 'number' ? sample : 0;
            }
            targetDuration = actualLen / sampleRate;
            usedAutocorr = true;
            console.log(`🎯 [Loop ${props.loopId}] Автонарезка сработала! Новый цикл (2-й кусок): ${targetDuration.toFixed(3)} секунд`);
          } else {
            console.log('[Looper] Автонарезка не сработала, используем всю запись.');
          }
          void audioCtx.close();
        }
      } else {
        // Для остальных лупов - используем длительность из syncStore
        if (syncStore.cycleDuration.value > 0) {
          targetDuration = syncStore.cycleDuration.value;
        }
      }

      // Если был найден повтор — используем обрезанный буфер
      let processedAudio;
      if (cutBuffer) {
        processedAudio = { blob: audioBufferToWav(cutBuffer), duration: targetDuration };
      } else {
        // Обрабатываем аудио: дополняем пустотой если нужно
        processedAudio = await processRecordedAudio(originalBlob, targetDuration);
      }

      // Обновляем URL и длительность
      if (audioUrl.value) {
        URL.revokeObjectURL(audioUrl.value);
      }
      audioUrl.value = URL.createObjectURL(processedAudio.blob);
      audioDuration.value = processedAudio.duration;

      console.log(`Loop ${props.loopId} processed: original=${originalBlob.size} bytes, processed=${processedAudio.blob.size} bytes, duration=${processedAudio.duration}s, autocorr=${usedAutocorr}`);

      // Даем браузеру время на загрузку нового аудио URL
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error('Error processing recorded audio for loop', props.loopId, ':', error);
    }
  }

  // Для первого лупа обновляем длительность синхронизации и автоматически включаем метроном
  if (props.loopId === 1 && audioDuration.value) {
    syncStore.startSync(audioDuration.value);

    // Автоматически включаем метроном после записи первого лупа
    if (!syncStore.isMetronomeOn.value) {
      syncStore.toggleMetronome();
    }

    console.log('Updated sync duration to:', audioDuration.value, 'BPM:', syncStore.bpm.value);
  }

  emit('first-recorded');
}

// Функции предварительного прослушивания
async function createPreviewAudio() {
  if (!originalAudioUrl.value || !audioDuration.value) return;

  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();

    // Загружаем оригинальное аудио
    const response = await fetch(originalAudioUrl.value);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Валидируем границы обрезки
    const startTime = Math.max(0, Math.min(editStartTime.value, audioDuration.value));
    const endTime = Math.max(startTime + 0.1, Math.min(editEndTime.value, audioDuration.value));

    console.log('Creating preview audio:', { startTime, endTime, duration: audioDuration.value });

    // Создаем обрезанное аудио
    const startSample = Math.floor(startTime * audioBuffer.sampleRate);
    const endSample = Math.floor(endTime * audioBuffer.sampleRate);
    const newLength = endSample - startSample;

    if (newLength <= 0) {
      console.error('Invalid trim range:', { startSample, endSample, newLength });
      return;
    }

    const newBuffer = audioCtx.createBuffer(
      audioBuffer.numberOfChannels,
      newLength,
      audioBuffer.sampleRate
    );

    // Копируем данные
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const src = audioBuffer.getChannelData(ch);
      const dst = newBuffer.getChannelData(ch);

      for (let i = 0; i < newLength; i++) {
        const sampleIndex = startSample + i;
        const sample = src[sampleIndex];
        dst[i] = typeof sample === 'number' ? sample : 0;
      }
    }

    // Конвертируем в Blob
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      newBuffer.length,
      newBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = newBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWav(renderedBuffer);

    // Создаем URL для предварительного прослушивания
    if (previewAudioUrl.value) {
      URL.revokeObjectURL(previewAudioUrl.value);
    }
    previewAudioUrl.value = URL.createObjectURL(wavBlob);

    console.log('Preview audio created successfully, length:', newLength / audioBuffer.sampleRate);

    void audioCtx.close();

  } catch (error) {
    console.error('Error creating preview audio:', error);
  }
}

function playPreview() {
  if (!previewAudioRef.value || !previewAudioUrl.value) return;

  // Останавливаем основное воспроизведение
  if (isPlaying.value) {
    stopAudio();
  }

  // Синхронизируем с новой системой метронома
  if (syncStore.isSyncActive.value && syncStore.isMetronomeOn.value) {
    // Перезапускаем метроном для синхронизации с предварительным прослушиванием
    syncStore.toggleMetronome();
    setTimeout(() => {
      syncStore.toggleMetronome();
    }, 50);
  }

  // Запускаем предварительное прослушивание
  previewAudioRef.value.currentTime = 0;
  previewAudioRef.value.volume = isPreviewMuted.value ? 0 : volume.value;
  previewAudioRef.value.loop = true; // Включаем зацикливание

  const playPromise = previewAudioRef.value.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        isPreviewPlaying.value = true;
        hasStartedPreview.value = true; // Отмечаем, что пользователь запускал прослушивание

        // Убираем обработчик окончания, так как теперь луп зацикливается
        if (previewAudioRef.value) {
          previewAudioRef.value.onended = null;
        }
      })
      .catch((error) => {
        console.error('Error playing preview audio:', error);
        isPreviewPlaying.value = false;
        hasStartedPreview.value = false;
      });
  }
}

function stopPreview() {
  if (!previewAudioRef.value) return;

  previewAudioRef.value.pause();
  previewAudioRef.value.currentTime = 0;
  previewAudioRef.value.loop = false; // Отключаем зацикливание
  isPreviewPlaying.value = false;

  // Останавливаем метроном при остановке прослушивания только если он был включен для предварительного прослушивания
  if (syncStore.isMetronomeOn.value && !syncStore.isSyncActive.value) {
    syncStore.toggleMetronome();
  }
}

function togglePreviewMute() {
  isPreviewMuted.value = !isPreviewMuted.value;
  if (previewAudioRef.value) {
    previewAudioRef.value.volume = isPreviewMuted.value ? 0 : volume.value;
  }
}

defineExpose({ playAudio, stopAudio, isPlaying, audioUrl, audioDuration, isInCycle, startSyncedRecording, isWaitingForSync: () => isWaitingForSync.value, handleCircleClick });

onUnmounted(() => {
  stopMicMonitor();
  stopProgressTimer();

  // Удаляем обработчики событий
  window.removeEventListener('auto-analysis-request', handleAutoAnalysisRequest as EventListener);
});

// Обработчик события автоматического анализа
function handleAutoAnalysisRequest() {
  console.log(`🎯 [Loop ${props.loopId}] handleAutoAnalysisRequest вызван:`, {
    hasAudioUrl: !!audioUrl.value,
    hasAudioDuration: !!audioDuration.value,
    isFirstLoop: props.loopId === 1,
    isRecording: isRecording.value,
    autoAnalysisActive: syncStore.isAutoAnalysisActive.value,
    audioChunksLength: audioChunks.length,
    hasMediaRecorder: !!mediaRecorder,
    mediaRecorderState: mediaRecorder?.state,
    timestamp: new Date().toISOString()
  });

  // Для первого лупа во время записи разрешаем анализ даже если нет audioUrl/audioDuration
  if (props.loopId !== 1) {
    console.log(`❌ [Loop ${props.loopId}] handleAutoAnalysisRequest: не первый луп`);
    return;
  }

  if (!isRecording.value) {
    console.log(`❌ [Loop ${props.loopId}] handleAutoAnalysisRequest: не записывается`);
    return;
  }

  if (audioChunks.length === 0) {
    console.log(`❌ [Loop ${props.loopId}] handleAutoAnalysisRequest: audioChunks пустой`, {
      mediaRecorderState: mediaRecorder?.state,
      hasMediaRecorder: !!mediaRecorder
    });
    return;
  }

  console.log(`✅ [Loop ${props.loopId}] Получен запрос на автоматический анализ - выполняем анализ`);

  // Выполняем анализ только для первого лупа
  void performRealTimeAnalysis();
}

// Функция анализа в реальном времени
async function performRealTimeAnalysis() {
  // Если идёт запись первого лупа, анализируем текущие audioChunks
  if (isRecording.value && props.loopId === 1 && audioChunks.length > 0) {
    try {
      console.log(`🔍 [Loop ${props.loopId}] Анализ текущей записи в реальном времени`, {
        audioChunksLength: audioChunks.length,
        timestamp: new Date().toISOString()
      });

      // Создаём временный blob из текущих chunks
      const tempBlob = new Blob(audioChunks, { type: 'audio/webm' });

      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const arrayBuffer = await tempBlob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const samples = audioBuffer.getChannelData(0);
      const sampleRate = typeof audioBuffer.sampleRate === 'number' && isFinite(audioBuffer.sampleRate)
        ? audioBuffer.sampleRate
        : 44100;
      const duration = typeof audioBuffer.duration === 'number' && isFinite(audioBuffer.duration)
        ? audioBuffer.duration
        : samples.length / sampleRate;

      const maxSec = settingsStore.maxLoopDuration.value ?? 8;
      const minSec = settingsStore.minLoopDuration.value ?? 4;

      console.log(`📊 [Loop ${props.loopId}] Анализ текущей записи: sampleRate=${sampleRate}, duration=${duration.toFixed(2)}, minSec=${minSec}, maxSec=${maxSec}`);

      const bestLag = detectLoopLengthByAutocorrelation(samples, sampleRate, minSec, maxSec, settingsStore.autocorrAccuracy.value);
      const newDuration = bestLag / sampleRate;

      console.log(`🎵 [Loop ${props.loopId}] Результат анализа текущей записи: bestLag=${bestLag}, новая длительность=${newDuration.toFixed(3)}с`);

      // Проверяем, значительно ли изменилась длительность (более чем на 10%)
      const currentDuration = duration;
      const durationDiff = Math.abs(newDuration - currentDuration);
      const durationChangePercent = (durationDiff / currentDuration) * 100;

      if (durationChangePercent > 10 && bestLag > sampleRate * 0.5 && bestLag < samples.length * 0.9) {
        console.log(`🎯 [Loop ${props.loopId}] Обнаружено значительное изменение длительности: ${currentDuration.toFixed(3)}с → ${newDuration.toFixed(3)}с (${durationChangePercent.toFixed(1)}%)`);

        // Если идёт запись — останавливаем её и запускаем воспроизведение
        if (isRecording.value) {
          console.log(`🛑 [Loop ${props.loopId}] Останавливаем запись и запускаем воспроизведение`);
          stopRecording();
          // Ждём завершения обработки, затем запускаем воспроизведение
          setTimeout(() => {
            playAudio();
          }, 400); // 400мс — чтобы успела обработаться запись
        }
      } else {
        console.log(`ℹ️ [Loop ${props.loopId}] Изменение длительности незначительно (${durationChangePercent.toFixed(1)}%), обновление не требуется`);
      }

      void audioCtx.close();

    } catch (error) {
      console.error(`❌ [Loop ${props.loopId}] Ошибка при анализе текущей записи:`, error);
    }
  } else if (!audioUrl.value || !audioDuration.value) {
    console.log(`⏭️ [Loop ${props.loopId}] Пропуск анализа - нет аудио или длительности`);
    return;
  } else {
    // Если запись завершена, анализируем готовый луп (старая логика)
    try {
      console.log(`🔍 [Loop ${props.loopId}] Анализ готового лупа в реальном времени`);

      // Получаем оригинальный blob из URL
      const response = await fetch(audioUrl.value);
      const originalBlob = await response.blob();

      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const arrayBuffer = await originalBlob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const samples = audioBuffer.getChannelData(0);
      const sampleRate = typeof audioBuffer.sampleRate === 'number' && isFinite(audioBuffer.sampleRate)
        ? audioBuffer.sampleRate
        : 44100;
      const duration = typeof audioBuffer.duration === 'number' && isFinite(audioBuffer.duration)
        ? audioBuffer.duration
        : samples.length / sampleRate;
      const numberOfChannels = typeof audioBuffer.numberOfChannels === 'number' && isFinite(audioBuffer.numberOfChannels)
        ? audioBuffer.numberOfChannels
        : 1;

      const minSec = settingsStore.minLoopDuration.value ?? 4;
      const maxSec = settingsStore.maxLoopDuration.value ?? 8;

      console.log(`📊 [Loop ${props.loopId}] Анализ готового лупа: sampleRate=${sampleRate}, duration=${duration}, minSec=${minSec}, maxSec=${maxSec}`);

      const bestLag = detectLoopLengthByAutocorrelation(samples, sampleRate, minSec, maxSec, settingsStore.autocorrAccuracy.value);
      const newDuration = bestLag / sampleRate;

      console.log(`🎵 [Loop ${props.loopId}] Результат анализа готового лупа: bestLag=${bestLag}, новая длительность=${newDuration.toFixed(3)}с`);

      // Проверяем, значительно ли изменилась длительность (более чем на 10%)
      const currentDuration = audioDuration.value;
      const durationDiff = Math.abs(newDuration - currentDuration);
      const durationChangePercent = (durationDiff / currentDuration) * 100;

      if (durationChangePercent > 10 && bestLag > sampleRate * 0.5 && bestLag < samples.length * 0.9) {
        console.log(`🎯 [Loop ${props.loopId}] Обнаружено значительное изменение длительности: ${currentDuration.toFixed(3)}с → ${newDuration.toFixed(3)}с (${durationChangePercent.toFixed(1)}%)`);

        // Создаем новый обрезанный буфер
        const startIdx = bestLag;
        const endIdx = Math.min(bestLag * 2, samples.length);
        const actualLen = endIdx - startIdx;
        const cutBuffer = audioCtx.createBuffer(numberOfChannels, actualLen, sampleRate);

        const src = audioBuffer.getChannelData(0);
        const dst = cutBuffer.getChannelData(0);
        for (let i = 0; i < actualLen; i++) {
          const sample = src[startIdx + i];
          dst[i] = typeof sample === 'number' ? sample : 0;
        }

        // Создаем новый blob
        const newBlob = audioBufferToWav(cutBuffer);

        // Обновляем URL и длительность
        if (audioUrl.value) {
          URL.revokeObjectURL(audioUrl.value);
        }
        audioUrl.value = URL.createObjectURL(newBlob);
        audioDuration.value = newDuration;

        // Обновляем синхронизацию
        if (syncStore.isSyncActive.value) {
          syncStore.startSync(newDuration);
          console.log(`🔄 [Loop ${props.loopId}] Синхронизация обновлена на новую длительность: ${newDuration.toFixed(3)}с`);
        }

        console.log(`✅ [Loop ${props.loopId}] Луп успешно обновлен в реальном времени`);
      } else {
        console.log(`ℹ️ [Loop ${props.loopId}] Изменение длительности незначительно (${durationChangePercent.toFixed(1)}%), обновление не требуется`);
      }

      void audioCtx.close();

    } catch (error) {
      console.error(`❌ [Loop ${props.loopId}] Ошибка при анализе готового лупа:`, error);
    }
  }
}

// Добавляем обработчики событий при монтировании компонента
onMounted(() => {
  // Слушаем события автоматического анализа
  window.addEventListener('auto-analysis-request', handleAutoAnalysisRequest as EventListener);
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

/* Стили для редактирования */
.edit-controls {
  display: flex;
  justify-content: center;
}

.edit-interface {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.edit-info {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.waveform-container {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 8px;
}

.edit-sliders {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-slider {
  width: 100%;
}

.edit-actions {
  margin-top: 8px;
}

.apply-btn, .cancel-btn, .edit-btn {
  min-width: 80px;
}

/* Адаптивность */
@media (max-width: 600px) {
  .edit-interface {
    padding: 8px;
  }

  .waveform-container {
    padding: 4px;
  }

  .apply-btn, .cancel-btn {
    min-width: 60px;
    font-size: 12px;
  }
}

.edit-dialog {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  color: white;
}

.edit-header {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
}

.close-btn {
  color: white;
}

.edit-content {
  padding: 24px;
  max-height: 70vh;
  overflow-y: auto;
}

.duration-info {
  background: rgba(255, 255, 255, 0.1);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.waveform-section {
  background: rgba(0, 0, 0, 0.3);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.sliders-section {
  background: rgba(255, 255, 255, 0.05);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.slider-group {
  margin-bottom: 16px;
}

.slider-label {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.edit-slider {
  margin-top: 8px;
}

.preview-section {
  background: rgba(255, 255, 255, 0.05);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.preview-controls {
  justify-content: center;
}

.preview-btn {
  min-width: 120px;
  font-weight: 500;
}

.edit-actions {
  background: rgba(0, 0, 0, 0.2);
  padding: 16px 24px;
  justify-content: center;
  gap: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.apply-btn, .cancel-btn {
  min-width: 160px;
  font-weight: 600;
  border-radius: 8px;
}

/* Адаптивность */
@media (max-width: 768px) {
  .edit-content {
    padding: 16px;
  }

  .edit-header {
    padding: 12px 16px;
  }

  .preview-btn {
    min-width: 100px;
    font-size: 12px;
  }

  .apply-btn, .cancel-btn {
    min-width: 120px;
    font-size: 14px;
  }
}

.final-duration {
  font-size: 1.15rem;
  font-weight: 600;
  color: #1976d2;
  text-align: center;
  margin-bottom: 6px;
  letter-spacing: 0.03em;
  text-shadow: 0 2px 8px rgba(25,118,210,0.10);
}
</style>
