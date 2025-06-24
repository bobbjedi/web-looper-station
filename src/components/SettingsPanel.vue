<template>
  <div class="settings-panel">
    <q-expansion-item
      icon="settings"
      label="Настройки"
      header-class="settings-header"
      class="settings-expansion"
    >
      <q-card class="settings-card">
        <q-card-section class="settings-content">
          <!-- Настройка чувствительности микрофона -->
          <div class="setting-group q-mb-lg">
            <div class="setting-label text-subtitle2 q-mb-sm">
              Чувствительность микрофона
            </div>
            <div class="setting-description text-caption q-mb-md">
              Настройте чувствительность для начала записи первого лупа
            </div>
            <q-slider
              v-model="soundThreshold"
              :min="0.1"
              :max="0.5"
              :step="0.05"
              color="blue"
              class="setting-slider"
              label
              label-always
            />
            <div class="setting-value text-center text-caption">
              {{ (soundThreshold * 100).toFixed(0) }}%
            </div>
          </div>

          <!-- Настройка точности автокорреляции -->
          <div class="setting-group">
            <div class="setting-label text-subtitle2 q-mb-sm">
              Точность автонарезки
            </div>
            <div class="setting-description text-caption q-mb-md">
              Настройте точность поиска повторяющегося риффа в первом лупе
            </div>
            <q-slider
              v-model="autocorrAccuracy"
              :min="1"
              :max="10"
              :step="1"
              color="green"
              class="setting-slider"
              label
              label-always
            />
            <div class="setting-value text-center text-caption">
              {{ getAccuracyDescription(autocorrAccuracy) }}
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-expansion-item>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { settingsStore } from '../stores/settings-store';

// Связанные значения с store
const soundThreshold = computed({
  get: () => settingsStore.soundThreshold.value,
  set: (value: number) => { settingsStore.soundThreshold.value = value; }
});

const autocorrAccuracy = computed({
  get: () => settingsStore.autocorrAccuracy.value,
  set: (value: number) => { settingsStore.autocorrAccuracy.value = value; }
});

// Функция для получения описания точности
function getAccuracyDescription(accuracy: number): string {
  if (accuracy <= 2) return 'Максимальная точность (медленно)';
  if (accuracy <= 4) return 'Высокая точность';
  if (accuracy <= 6) return 'Средняя точность';
  if (accuracy <= 8) return 'Быстрая обработка';
  return 'Очень быстро (менее точно)';
}
</script>

<style scoped>
.settings-panel {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.settings-expansion {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.settings-header {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  color: white;
  border-radius: 12px 12px 0 0;
  font-weight: 600;
}

.settings-card {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0 0 12px 12px;
  border: none;
}

.settings-content {
  padding: 24px;
}

.setting-group {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.setting-label {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.setting-description {
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
}

.setting-slider {
  margin: 16px 0;
}

.setting-value {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
}

/* Адаптивность */
@media (max-width: 600px) {
  .settings-content {
    padding: 16px;
  }

  .setting-group {
    padding: 12px;
  }
}
</style>
