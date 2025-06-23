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
      <q-btn color="negative" icon="delete" @click="resetLoop" label="Сброс" :disable="!audioUrl" class="btn-fixed" />
    </div>
    <div class="q-mt-md">
      <q-badge v-if="isWaitingForSound" color="orange">Жду звук для старта...</q-badge>
      <q-badge v-else-if="isRecording" color="red">Запись...</q-badge>
      <q-badge v-else-if="isPlaying" color="green">Воспроизведение</q-badge>
      <q-badge v-else color="grey">Ожидание</q-badge>
    </div>
    <audio v-if="audioUrl" :src="audioUrl" ref="audioRef" style="display:none" />
  </q-card>
</template>

<script setup lang="ts">
import { ref, defineExpose, watch, defineEmits, onUnmounted } from 'vue';

const props = defineProps<{ loopId: number, canRecord?: boolean }>();

const emit = defineEmits(['ended']);

const isRecording = ref(false);
const isPlaying = ref(false);
const isMuted = ref(false);
const isWaitingForSound = ref(false);
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
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];
  mediaRecorder.ondataavailable = (e) => {
    audioChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    audioUrl.value = URL.createObjectURL(audioBlob);
    // Получаем длительность аудио
    const tempAudio = new Audio(audioUrl.value);
    tempAudio.onloadedmetadata = () => {
      audioDuration.value = tempAudio.duration;
    };
  };
  mediaRecorder.start();
  isRecording.value = true;
}

function stopRecording() {
  stopMicMonitor();
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
    audioRef.value.onended = () => {
      isPlaying.value = false;
      emit('ended');
    };
    // Устанавливаем громкость в зависимости от mute
    audioRef.value.volume = isMuted.value ? 0 : 1;
  }
}

function stopAudio() {
  if (audioRef.value) {
    audioRef.value.currentTime = 0;
    isPlaying.value = false;
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value;
  if (audioRef.value) {
    audioRef.value.volume = isMuted.value ? 0 : 1;
  }
}

function resetLoop() {
  stopAudio();
  audioUrl.value = null;
  audioDuration.value = null;
  isMuted.value = false;
  isPlaying.value = false;
}

// Если mute меняется во время воспроизведения
watch(isMuted, (val) => {
  if (audioRef.value) {
    audioRef.value.volume = val ? 0 : 1;
  }
});

defineExpose({ playAudio, stopAudio, isPlaying, audioUrl, audioDuration });

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
