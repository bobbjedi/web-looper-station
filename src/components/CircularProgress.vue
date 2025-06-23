<template>
  <div class="circular-progress-container">
    <svg class="circular-progress" :width="size" :height="size" viewBox="0 0 100 100">
      <!-- Фоновый круг (заливка) -->
      <circle
        cx="50"
        cy="50"
        r="45"
        :fill="backgroundColor"
        stroke="none"
      />
      <!-- Фоновый круг (обводка) -->
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="#e0e0e0"
        stroke-width="4"
      />
      <!-- Прогресс круг -->
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        :stroke="progressColor"
        stroke-width="4"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="strokeDashoffset"
        transform="rotate(-90 50 50)"
        class="progress-circle"
      />
    </svg>
    <div class="progress-text" v-if="showText">
      <slot>{{ formattedTime }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  progress: number; // от 0 до 1
  duration: number; // общая длительность в секундах
  size?: number;
  color?: string;
  backgroundColor?: string;
  showText?: boolean;
}>();

const size = computed(() => props.size || 120);
const progressColor = computed(() => props.color || '#1976d2');
const backgroundColor = computed(() => props.backgroundColor || 'rgba(255,255,255,0.05)');
const showText = computed(() => props.showText !== false);

const circumference = 2 * Math.PI * 45; // 2πr, где r=45

const strokeDashoffset = computed(() => {
  return circumference * (1 - Math.max(0, Math.min(1, props.progress)));
});

const formattedTime = computed(() => {
  const currentTime = props.duration * props.progress;
  const minutes = Math.floor(currentTime / 60);
  const seconds = Math.floor(currentTime % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});
</script>

<style scoped>
.circular-progress-container {
  position: relative;
  display: inline-block;
}

.circular-progress {
  display: block;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}

.progress-circle {
  transition: stroke-dashoffset 0.1s ease;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  font-weight: bold;
  color: var(--q-primary);
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}
</style>
