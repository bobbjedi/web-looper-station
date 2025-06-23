<template>
  <div class="metronome-container q-mb-md">
    <div class="metronome-controls row items-center justify-center q-gutter-sm">
      <!-- Кнопка вкл/выкл метронома -->
      <q-btn
        flat
        round
        :icon="syncStore.isMetronomeOn ? 'music_note' : 'music_off'"
        :color="syncStore.isMetronomeOn ? 'primary' : 'grey'"
        @click="syncStore.toggleMetronome()"
        class="metronome-toggle"
      />

      <!-- BPM контролы -->
      <div class="bpm-controls row items-center q-gutter-xs">
        <q-btn flat round icon="remove" @click="decreaseBpm" size="sm" />
        <q-input
          v-model.number="localBpm"
          type="number"
          min="40"
          max="240"
          style="width: 70px;"
          dense
          outlined
          label="BPM"
          class="bpm-input"
          @update:model-value="(val: string | number | null) => {
            if (typeof val === 'number') syncStore.setBpm(val);
          }"
        />
        <q-btn flat round icon="add" @click="increaseBpm" size="sm" />
      </div>

      <!-- Громкость метронома -->
      <div class="volume-controls row items-center q-gutter-xs">
        <q-icon name="volume_up" size="16px" color="amber" />
        <q-slider
          :model-value="syncStore.metronomeVolume.value"
          @update:model-value="(val: number | null) => val !== null && syncStore.setMetronomeVolume(val)"
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
      <div v-if="syncStore.isMetronomeOn" class="metronome-indicator" :class="{ active: metronomeActive }">
        <div class="metronome-pulse" :class="{ active: metronomeActive }"></div>
      </div>

      <!-- Индикатор синхронизации -->
      <div v-if="syncStore.isSyncActive" class="sync-indicator">
        <q-icon name="sync" size="16px" color="green" />
        <span class="sync-text text-caption">{{ syncStore.totalBeats }} ударов</span>
      </div>
    </div>

    <!-- Дополнительная информация о синхронизации -->
    <div v-if="syncStore.isSyncActive" class="sync-info q-mt-sm">
      <div class="row items-center justify-center q-gutter-md">
        <div class="text-caption">
          Цикл: {{ cycleDurationFormatted }}с
        </div>
        <div class="text-caption">
          Удар: {{ currentBeatFormatted }}/{{ syncStore.totalBeats }}
        </div>
        <div class="text-caption">
          До удара: {{ timeToNextBeatFormatted }}мс
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue';
import { settingsStore } from '../stores/settings-store';
import { syncStore } from '../stores/sync-store';

// Определяем имя компонента для соответствия ESLint
defineOptions({
  name: 'MetronomeComponent'
});

// Локальное состояние для BPM (для двусторонней привязки)
const localBpm = ref(syncStore.bpm.value);
const metronomeActive = ref(false);

// Таймер для анимации индикатора
let indicatorTimer: number | null = null;

// Функции управления BPM
function increaseBpm() {
  const newBpm = Math.min(240, localBpm.value + 1);
  localBpm.value = newBpm;
  syncStore.setBpm(newBpm);
}

function decreaseBpm() {
  const newBpm = Math.max(40, localBpm.value - 1);
  localBpm.value = newBpm;
  syncStore.setBpm(newBpm);
}

// Функция анимации индикатора удара
function animateBeatIndicator() {
  if (!syncStore.isMetronomeOn.value || !syncStore.isSyncActive.value) return;

  metronomeActive.value = true;

  if (indicatorTimer) {
    clearTimeout(indicatorTimer);
  }

  indicatorTimer = window.setTimeout(() => {
    metronomeActive.value = false;
  }, 80);
}

// Watchers для синхронизации
watch(() => syncStore.bpm.value, (newBpm) => {
  localBpm.value = newBpm;
});

watch(() => syncStore.currentBeat, () => {
  // Анимируем индикатор при каждом ударе
  animateBeatIndicator();
});

// Очистка при размонтировании
onUnmounted(() => {
  if (indicatorTimer) {
    clearTimeout(indicatorTimer);
  }
});

// Экспортируем функции для обратной совместимости
defineExpose({
  startMetronome: () => syncStore.toggleMetronome(),
  stopMetronome: () => {
    if (syncStore.isMetronomeOn.value) {
      syncStore.toggleMetronome();
    }
  },
  isMetronomeOn: () => syncStore.isMetronomeOn.value,
  bpm: () => syncStore.bpm.value
});

// Вычисляемые свойства
const cycleDurationFormatted = computed(() => syncStore.cycleDuration.value.toFixed(1));
const currentBeatFormatted = computed(() => syncStore.currentBeat.value + 1);
const timeToNextBeatFormatted = computed(() => (syncStore.timeToNextBeat.value * 1000).toFixed(0));
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

.sync-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(76, 175, 80, 0.1);
  border-radius: 8px;
  padding: 4px 8px;
}

.sync-text {
  color: rgba(76, 175, 80, 0.9);
  font-weight: 500;
}

.sync-info {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.sync-info .text-caption {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
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
