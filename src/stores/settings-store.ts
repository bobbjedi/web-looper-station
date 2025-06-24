import { ref } from 'vue';

// Глобальный стейт для настроек приложения
export const useSettingsStore = () => {
  // Чувствительность микрофона (0.1 - 0.5)
  const soundThreshold = ref(0.1);

  // Точность поиска автокорреляции для первого лупа (1-10, где 1=максимум, 10=быстро)
  const autocorrAccuracy = ref(3);

  // Максимальная длительность лупа (секунды)
  const maxLoopDuration = ref(8);

  return {
    soundThreshold,
    autocorrAccuracy,
    maxLoopDuration
  };
};

// Создаём глобальный экземпляр
export const settingsStore = useSettingsStore();
