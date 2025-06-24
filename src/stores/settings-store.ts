import { ref, computed } from 'vue';

// Глобальный стейт для настроек приложения
export const useSettingsStore = () => {
  // Чувствительность микрофона (0.1 - 0.5)
  const soundThreshold = ref(0.1);

  // Точность поиска автокорреляции для первого лупа (1-10, где 1=максимум, 10=быстро)
  const autocorrAccuracy = ref(3);

  // Минимальная длительность лупа (секунды)
  const minLoopDuration = ref(4);

  // Максимальная длительность лупа = 2 * минимальная
  const maxLoopDuration = computed(() => minLoopDuration.value * 2);

  return {
    soundThreshold,
    autocorrAccuracy,
    minLoopDuration,
    maxLoopDuration
  };
};

// Создаём глобальный экземпляр
export const settingsStore = useSettingsStore();
