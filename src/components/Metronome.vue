<template>
  <div class="metronome-container q-mb-md">
    <div class="metronome-controls row items-center justify-center q-gutter-sm">
      <!-- Кнопка вкл/выкл метронома -->
      <q-btn
        flat
        round
        :icon="isMetronomeOn ? 'music_note' : 'music_off'"
        :color="isMetronomeOn ? 'primary' : 'grey'"
        @click="toggleMetronome"
        class="metronome-toggle"
      />

      <!-- BPM контролы -->
      <div class="bpm-controls row items-center q-gutter-xs">
        <q-btn flat round icon="remove" @click="decreaseBpm" size="sm" />
        <q-input
          v-model.number="bpm"
          type="number"
          min="40"
          max="240"
          style="width: 70px;"
          dense
          outlined
          label="BPM"
          class="bpm-input"
        />
        <q-btn flat round icon="add" @click="increaseBpm" size="sm" />
      </div>

      <!-- Громкость метронома -->
      <div class="volume-controls row items-center q-gutter-xs">
        <q-icon name="volume_up" size="16px" color="amber" />
        <q-slider
          v-model="metronomeVolume"
          :min="0"
          :max="1"
          :step="0.01"
          color="amber"
          class="metronome-slider"
          style="width: 80px;"
        />
      </div>

      <!-- Чувствительность микрофона -->
      <div class="sensitivity-controls row items-center q-gutter-xs">
        <q-icon name="mic" size="16px" color="orange" />
        <q-slider
          :model-value="settingsStore.soundThreshold.value || 0.2"
          @update:model-value="val => settingsStore.soundThreshold.value = val || 0.2"
          :min="0.1"
          :max="0.5"
          :step="0.01"
          color="orange"
          class="sensitivity-slider"
          style="width: 80px;"
        />
        <span class="sensitivity-value text-caption">
          {{ Math.round((settingsStore.soundThreshold.value || 0.2) * 100) }}%
        </span>
      </div>

      <!-- Индикатор удара -->
      <div v-if="isMetronomeOn" class="metronome-indicator" :class="{ active: metronomeActive }">
        <div class="metronome-pulse" :class="{ active: metronomeActive }"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { settingsStore } from '../stores/settings-store';

// Определяем имя компонента для соответствия ESLint
defineOptions({
  name: 'MetronomeComponent'
});

// Состояние метронома
const bpm = ref(95);
const isMetronomeOn = ref(false);
const metronomeActive = ref(false);
const metronomeVolume = ref(0.7);

// Таймеры
let metronomeTimer: number | null = null;
let metronomeBeat = 0;
const beatsPerBar = 4; // можно сделать настраиваемым

// Функции управления BPM
function increaseBpm() {
  bpm.value = Math.min(240, bpm.value + 1);
}

function decreaseBpm() {
  bpm.value = Math.max(40, bpm.value - 1);
}

// Функция воспроизведения клика метронома
function playMetronomeClick(accent = false) {
  const ctx = new ((window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext))();
  const bufferSize = 2048;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Более яркий clicky звук: короче decay, выше громкость, более резкий
  for (let i = 0; i < bufferSize; i++) {
    const env = Math.exp(-i / (accent ? 12 : 20)); // короче decay для более резкого звука
    data[i] = (Math.random() * 2 - 1) * env * 1.5; // увеличиваем амплитуду
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = accent ? 3200 : 2200; // выше частота для более звонкого звука
  const gain = ctx.createGain();
  gain.gain.value = accent ? metronomeVolume.value * 1.3 : metronomeVolume.value * 1.2; // увеличиваем громкость

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();

  setTimeout(() => {
    source.stop();
    void ctx.close();
  }, accent ? 25 : 30); // короче длительность
}

// Запуск метронома
function startMetronome() {
  stopMetronome();
  const interval = 60000 / bpm.value;
  metronomeBeat = 0;

  function tick() {
    if (!isMetronomeOn.value) return;

    metronomeActive.value = true;
    playMetronomeClick(metronomeBeat === 0); // акцент на первый удар
    setTimeout(() => metronomeActive.value = false, 80);

    metronomeBeat = (metronomeBeat + 1) % beatsPerBar;
    metronomeTimer = window.setTimeout(tick, interval);
  }

  tick();
}

// Остановка метронома
function stopMetronome() {
  if (metronomeTimer) {
    clearTimeout(metronomeTimer);
    metronomeTimer = null;
  }
  metronomeActive.value = false;
}

// Переключение метронома
function toggleMetronome() {
  isMetronomeOn.value = !isMetronomeOn.value;
}

// Watchers
watch(isMetronomeOn, (on) => {
  if (on) startMetronome();
  else stopMetronome();
});

watch(bpm, () => {
  if (isMetronomeOn.value) startMetronome();
});

// Очистка при размонтировании
onUnmounted(() => {
  stopMetronome();
});

// Экспортируем функции для синхронизации
defineExpose({
  startMetronome,
  stopMetronome,
  isMetronomeOn: () => isMetronomeOn.value,
  bpm: () => bpm.value
});
</script>

<style scoped>
.metronome-container {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 12px 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.metronome-controls {
  gap: 16px;
}

.metronome-toggle {
  transition: all 0.2s ease;
}

.metronome-toggle:hover {
  transform: scale(1.1);
}

.bpm-controls {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 4px 8px;
}

.bpm-input {
  text-align: center;
}

.bpm-input :deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
}

.bpm-input :deep(.q-field__control:hover) {
  border-color: rgba(255, 255, 255, 0.3);
}

.volume-controls {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 4px 8px;
}

.metronome-slider {
  min-width: 60px;
  max-width: 90px;
}

.sensitivity-controls {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 4px 8px;
}

.sensitivity-slider {
  min-width: 60px;
  max-width: 90px;
}

.sensitivity-value {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  min-width: 30px;
  text-align: center;
}

.metronome-indicator {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffc107;
  opacity: 0.22;
  transition: opacity 0.12s, box-shadow 0.18s;
  box-shadow: 0 0 6px #ffc107;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metronome-indicator.active {
  opacity: 1;
  box-shadow: 0 0 18px #ffc107;
}

.metronome-pulse {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fffbe7;
  opacity: 0.5;
  transition: opacity 0.12s, transform 0.18s;
  transform: scale(1);
}

.metronome-indicator.active .metronome-pulse {
  opacity: 1;
  transform: scale(1.35);
  background: #fffde4;
}

/* Адаптивность */
@media (max-width: 600px) {
  .metronome-container {
    padding: 8px 12px;
  }

  .metronome-controls {
    gap: 8px;
  }

  .bpm-input {
    width: 60px !important;
  }

  .metronome-slider {
    width: 60px !important;
  }

  .sensitivity-slider {
    width: 60px !important;
  }

  .sensitivity-value {
    min-width: 25px;
    font-size: 0.75rem;
  }
}
</style>
