<template>
  <q-card class="q-pa-md q-mb-md flex flex-column items-center" style="min-width: 250px; max-width: 350px;">
    <div class="text-h6">Луп {{ props.loopId }}</div>
    <div class="q-mt-md">
      <q-btn :color="isRecording ? 'red' : 'primary'" icon="mic" @click="toggleRecording" :label="isRecording ? 'Стоп' : 'Запись'" class="q-mr-sm" />
      <q-btn :color="isPlaying ? 'green' : 'primary'" icon="play_arrow" @click="togglePlayback" :label="isPlaying ? 'Стоп' : 'Воспроизвести'" :disable="!audioUrl" />
    </div>
    <div class="q-mt-md">
      <q-badge v-if="isRecording" color="red">Запись...</q-badge>
      <q-badge v-else-if="isPlaying" color="green">Воспроизведение</q-badge>
      <q-badge v-else color="grey">Ожидание</q-badge>
    </div>
    <audio v-if="audioUrl" :src="audioUrl" ref="audioRef" style="display:none" />
  </q-card>
</template>

<script setup lang="ts">
import { ref, defineExpose } from 'vue';

const props = defineProps<{ loopId: number }>();

const isRecording = ref(false);
const isPlaying = ref(false);
const audioUrl = ref<string | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null);
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

function toggleRecording() {
  if (!isRecording.value) {
    startRecording().catch(console.error);
  } else {
    stopRecording();
  }
}

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];
  mediaRecorder.ondataavailable = (e) => {
    audioChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    audioUrl.value = URL.createObjectURL(audioBlob);
  };
  mediaRecorder.start();
  isRecording.value = true;
}

function stopRecording() {
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
    };
  }
}

function stopAudio() {
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value.currentTime = 0;
    isPlaying.value = false;
  }
}

defineExpose({ playAudio, stopAudio, isPlaying, audioUrl });
</script>

<style scoped>
.q-card {
  width: 100%;
}
</style>
