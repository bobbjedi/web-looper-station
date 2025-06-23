import { ref } from 'vue';

// Глобальный стейт для настроек приложения
export const useSettingsStore = () => {
  // Чувствительность микрофона (0.1 - 0.5)
  const soundThreshold = ref(0.2);

  return {
    soundThreshold
  };
};

// Создаём глобальный экземпляр
export const settingsStore = useSettingsStore();
