<template>
  <q-card class="q-pa-md q-mb-md flex flex-column items-center" style="min-width: 250px; max-width: 350px;">
    <div class="text-h6 flex items-center">
      Луп {{ props.loopId }}
      <q-badge class="q-ml-sm" :color="audioUrl ? 'green' : 'grey'">
        {{ audioUrl ? 'Есть запись' : 'Пусто' }}
      </q-badge>
    </div>
    <div class="q-mt-md column items-stretch">
      <q-btn :color="isRecording ? 'red' : 'primary'" icon="mic" @click="toggleRecording" :label="isRecording ? 'Стоп' : isWaitingForSound ? 'Жду звук...' : 'Запись'" class="btn-fixed q-mb-sm" :disable="props.canRecord === false || (isWaitingForSound && !isRecording)" />
      <q-btn :color="isPlaying ? 'green' : 'primary'" icon="play_arrow" @click="togglePlayback" :label="isPlaying ? 'Стоп' : 'Воспроизвести'" :disable="!audioUrl" class="btn-fixed q-mb-sm" />
      <q-btn :color="isMuted ? 'grey' : 'primary'" :icon="isMuted ? 'volume_off' : 'volume_up'" @click="toggleMute" :label="isMuted ? 'Заглушен' : 'Mute'" :disable="!audioUrl" class="btn-fixed q-mb-sm" />
      <q-btn color="negative" icon="delete" @click="resetLoop" label="Сброс" class="btn-fixed" />
    </div>
    <div class="q-mt-md">
      <q-badge v-if="isWaitingForSound" color="orange">Жду звук для старта...</q-badge>
      <q-badge v-else-if="isRecording" color="red">Запись...</q-badge>
      <q-badge v-else-if="isPlaying || isInCycle" color="green">Воспроизведение</q-badge>
      <q-badge v-else color="grey">Ожидание</q-badge>
    </div>
    <audio v-if="audioUrl" :src="audioUrl" ref="audioRef" style="display:none" />
  </q-card>
</template>

<script setup lang="ts">
import { ref, defineExpose, watch, defineEmits, onUnmounted } from 'vue';

const props = defineProps<{ loopId: number, canRecord?: boolean, masterDuration?: number }>();

const emit = defineEmits(['ended']);

const isRecording = ref(false);
const isPlaying = ref(false);
const isMuted = ref(false);
const isWaitingForSound = ref(false);
const isInCycle = ref(false);
const audioUrl = ref<string | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null);
const audioDuration = ref<number | null>(null);
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let micStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array = new Uint8Array(0);
let waitSoundTimer: number | null = null;
let autoStopTimer: number | null = null;

function toggleRecording() {
  if (!isRecording.value) {
    if (props.loopId === 1) {
      waitForSoundStart();
    } else {
      startRecording().catch(console.error);
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
  if (peak > 0.2) {
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
  // Проверка masterDuration для не первого лупа
  if (props.loopId !== 1) {
    const md = Number(props.masterDuration);
    if (!md || !isFinite(md) || md <= 0) {
      console.warn('Некорректный masterDuration для loopId', props.loopId, ':', props.masterDuration);
      return;
    }
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
    isRecording.value = false;
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
}

function togglePlayback() {
  if (!isPlaying.value) {
    playAudio();
  } else {
    stopAudio();
  }
}

function playAudio() {
  if (audioRef.value) {
    audioRef.value.currentTime = 0;
    void audioRef.value.play();
    isPlaying.value = true;
    isInCycle.value = true;
    audioRef.value.onended = () => {
      isPlaying.value = false;
      emit('ended');
    };
    // Устанавливаем громкость в зависимости от mute
    audioRef.value.volume = isMuted.value ? 0 : 1;
    // Все лупы обрезаются по masterDuration для синхронизации
    if (props.masterDuration && props.masterDuration > 0) {
      setTimeout(() => {
        if (isPlaying.value) {
          isPlaying.value = false;
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
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value;
  if (audioRef.value) {
    audioRef.value.volume = isMuted.value ? 0 : 1;
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
}

// Если mute меняется во время воспроизведения
watch(isMuted, (val) => {
  if (audioRef.value) {
    audioRef.value.volume = val ? 0 : 1;
  }
});

defineExpose({ playAudio, stopAudio, isPlaying, audioUrl, audioDuration, isInCycle });

onUnmounted(() => {
  stopMicMonitor();
});
</script>

<style scoped>
.q-card {
  width: 100%;
}

.btn-fixed {
  min-width: 120px;
  justify-content: center;
}
</style>
