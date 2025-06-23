<template>
  <q-page class="column items-center q-pa-md q-gutter-md">
    <MicLevelBar />
    <div class="looper-grid q-mb-md">
      <LoopTrack
        v-for="id in 4"
        :key="id"
        :loopId="id"
        ref="loopRefs"
        @ended="onLoopEnded(id)"
        @first-recorded="onFirstRecorded"
        :canRecord="id === 1 || (masterDuration > 0)"
        :masterDuration="masterDuration || 0"
      />
    </div>
    <q-btn
      color="secondary"
      class="latency-btn q-mt-xl"
      label="Проверить задержку"
      icon="timer"
      @click="latencyCheck"
      size="md"
    />
    <div v-if="latencyMs !== null" class="q-mb-lg text-h6">
      Задержка: {{ latencyMs }} мс
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import LoopTrack from 'components/LoopTrack.vue';
import MicLevelBar from 'components/MicLevelBar.vue';

const loopRefs = ref<InstanceType<typeof LoopTrack>[]>([]);
const latencyMs = ref<number|null>(null);
const playingLoops = ref<Set<number>>(new Set());

const masterDuration = computed(() => {
  const first = loopRefs.value[0];
  const dur = Number(first && first.audioDuration ? first.audioDuration : 0);
  return isFinite(dur) && dur > 0 ? dur : 0;
});

function getActiveLoopIds() {
  return loopRefs.value
    .map((comp, idx) => (comp && comp.audioUrl ? idx + 1 : null))
    .filter((id): id is number => id !== null);
}

function startLoopCycle() {
  console.log('startLoopCycle');
  const activeIds = getActiveLoopIds();
  if (activeIds.length === 0) return;
  playingLoops.value = new Set(activeIds);
  loopRefs.value.forEach((comp) => {
    if (comp && comp.audioUrl) {
      comp.playAudio();
    }
  });
}

function onLoopEnded(id: number) {
  playingLoops.value.delete(id);
  if (playingLoops.value.size === 0) {
    // Все лупы закончили — запускаем следующий цикл
    setTimeout(() => startLoopCycle(), 0);
  }
}

function onFirstRecorded() {
  startLoopCycle();
}

async function latencyCheck() {
  latencyMs.value = null;
  // 1. Создаём чистый тон 1000 Гц длительностью 300 мс
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const duration = 0.3; // 300 мс
  const freq = 1000; // 1000 Гц
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate));
  }
  // 2. Готовим MediaRecorder
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const audioChunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
  // 3. Запускаем запись
  mediaRecorder.start();
  await new Promise((resolve) => setTimeout(resolve, 500)); // 500 мс буфер
  // 4. Воспроизводим тон
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  // 5. Ждём окончания воспроизведения
  await new Promise((resolve) => {
    source.onended = resolve;
  });
  // 6. Ждём ещё немного и останавливаем запись
  await new Promise((resolve) => setTimeout(resolve, 200));
  mediaRecorder.stop();
  await new Promise((resolve) => {
    mediaRecorder.onstop = resolve;
  });
  // 7. Анализируем запись
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  const arrayBuffer = await audioBlob.arrayBuffer();
  const recordedBuffer = await ctx.decodeAudioData(arrayBuffer);
  // 8. Находим первый пик (момент сигнала)
  const recData = recordedBuffer.getChannelData(0);
  let peakIndex = -1;
  const threshold = 0.05;
  for (let i = 0; i < recData.length; i++) {
    if (Math.abs(recData[i] as number) > threshold) {
      peakIndex = i;
      break;
    }
  }
  if (peakIndex === -1) {
    latencyMs.value = -1; // не найден пик
    return;
  }
  const peakTime = peakIndex / recordedBuffer.sampleRate;
  // 9. Вычисляем задержку
  const latency = Math.round((peakTime + 0.5) * 1000); // +0.5s — учёт буфера
  latencyMs.value = latency;
}
</script>

<style scoped>
.looper-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 40px 20px;
  justify-items: center;
  align-items: center;
  margin-top: 24px;
  margin-bottom: 24px;
}
.latency-btn {
  display: block;
  margin: 0 auto;
  min-width: 220px;
  font-size: 1.1rem;
  font-weight: 500;
  letter-spacing: 0.04em;
}
@media (max-width: 600px) {
  .looper-grid {
    gap: 28px 8px;
    margin-top: 10px;
    margin-bottom: 10px;
  }
  .latency-btn {
    min-width: 90vw;
    font-size: 1rem;
    margin-top: 24px;
    margin-bottom: 10px;
  }
}
</style>
