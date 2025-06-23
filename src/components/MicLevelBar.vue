<template>
  <div class="mic-bar-outer">
    <div class="mic-bar-inner" :style="{ width: (level * 100) + '%' }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const delayMs = 50;

const level = ref(0);
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array = new Uint8Array(0);
let timerId: number | null = null;
let stream: MediaStream | null = null;

function updateLevel() {
  if (analyser && dataArray.length > 0) {
    analyser.getByteTimeDomainData(dataArray);
    let peak = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = Math.abs(((dataArray[i] ?? 0) - 128) / 128);
      if (val > peak) peak = val;
    }
    level.value = peak;
  }
  timerId = window.setTimeout(updateLevel, delayMs);
}

onMounted(async () => {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  audioContext = new AudioCtx();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 64;
  dataArray = new Uint8Array(analyser.fftSize);
  source.connect(analyser);
  updateLevel();
});

onUnmounted(() => {
  if (timerId) clearTimeout(timerId);
  if (audioContext) void audioContext.close();
  if (stream) stream.getTracks().forEach(track => track.stop());
});
</script>

<style scoped>
.mic-bar-outer {
  width: 100vw;
  max-width: 480px;
  height: 18px;
  background: #222;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
}
@media (max-width: 600px) {
  .mic-bar-outer {
    width: 90vw;
    max-width: 90vw;
    margin-left: auto;
    margin-right: auto;
    margin: 12px auto 16px auto;
    box-sizing: border-box;
  }
}
.mic-bar-inner {
  height: 100%;
  background: linear-gradient(90deg, #00e676, #ffeb3b, #ff1744);
  transition: none;
}
</style>
