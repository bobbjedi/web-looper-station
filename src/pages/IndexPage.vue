<template>
  <q-page class="column items-center q-pa-md q-gutter-md">
    <q-btn
      color="primary"
      class="q-mb-md"
      :label="isPlayingAll ? 'Стоп все лупы' : 'Старт все лупы'"
      icon="play_circle"
      @click="toggleAll"
      size="lg"
    />
    <q-btn
      color="secondary"
      class="q-mb-lg"
      label="Проверить задержку"
      icon="timer"
      @click="latencyCheck"
      size="md"
    />
    <div v-if="latencyMs !== null" class="q-mb-lg text-h6">
      Задержка: {{ latencyMs }} мс
    </div>
    <div class="row items-center justify-evenly q-gutter-md">
      <LoopTrack
        v-for="id in 3"
        :key="id"
        :loopId="id"
        ref="loopRefs"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LoopTrack from 'components/LoopTrack.vue';

const loopRefs = ref<InstanceType<typeof LoopTrack>[]>([]);
const isPlayingAll = ref(false);
const latencyMs = ref<number|null>(null);

function toggleAll() {
  if (!isPlayingAll.value) {
    // Стартуем все лупы, у которых есть запись
    loopRefs.value.forEach((comp) => {
      if (comp && comp.audioUrl) {
        comp.playAudio();
      }
    });
    isPlayingAll.value = true;
  } else {
    // Останавливаем все лупы
    loopRefs.value.forEach((comp) => {
      if (comp && comp.isPlaying) {
        comp.stopAudio();
      }
    });
    isPlayingAll.value = false;
  }
}

async function latencyCheck() {
  latencyMs.value = null;
  // 1. Создаём длинный чередующийся импульс
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const duration = 0.1; // 100 мс
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = i < 200 ? (i % 2 === 0 ? 1 : -1) : 0; // 200 сэмплов чередующегося сигнала
  }
  // 2. Готовим MediaRecorder
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const audioChunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
  // 3. Запускаем запись
  mediaRecorder.start();
  await new Promise((resolve) => setTimeout(resolve, 300)); // 300 мс буфер
  // 4. Воспроизводим импульс
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
  // 8. Находим первый пик (момент импульса)
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
  const latency = Math.round((peakTime + 0.3) * 1000); // +0.3s — учёт буфера
  latencyMs.value = latency;
}
</script>
