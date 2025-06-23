<template>
  <div class="audio-waveform-container">
    <canvas
      ref="canvasRef"
      class="waveform-canvas"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    ></canvas>

    <!-- Маркеры обрезки -->
    <div
      v-if="startMarker > 0"
      class="trim-marker start-marker"
      :style="{ left: `${startMarker}%` }"
    >
      <div class="marker-line"></div>
      <div class="marker-label">Начало</div>
    </div>

    <div
      v-if="endMarker < 100"
      class="trim-marker end-marker"
      :style="{ left: `${endMarker}%` }"
    >
      <div class="marker-line"></div>
      <div class="marker-label">Конец</div>
    </div>

    <!-- Область выделения -->
    <div
      v-if="startMarker > 0 || endMarker < 100"
      class="selection-area"
      :style="{
        left: `${startMarker}%`,
        width: `${endMarker - startMarker}%`
      }"
    ></div>

    <!-- Легенда метронома -->
    <div v-if="props.isMetronomeOn && props.bpm" class="metronome-legend">
      <div class="legend-item">
        <div class="legend-line accent-line"></div>
        <span class="legend-text">Акцент (1-й удар)</span>
      </div>
      <div class="legend-item">
        <div class="legend-line beat-line"></div>
        <span class="legend-text">Удар ({{ props.bpm }} BPM)</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue';

// Определяем имя компонента для соответствия ESLint
defineOptions({
  name: 'AudioWaveformComponent'
});

const props = defineProps<{
  audioUrl: string | null;
  duration: number | null;
  startTime: number;
  endTime: number;
  bpm?: number;
  isMetronomeOn?: boolean;
}>();

const emit = defineEmits<{
  'update:startTime': [value: number];
  'update:endTime': [value: number];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const waveformData = ref<number[]>([]);
const isDragging = ref(false);
const dragType = ref<'start' | 'end' | null>(null);
const dragStartX = ref(0);

// Вычисляем позиции маркеров в процентах
const startMarker = computed(() => {
  if (!props.duration) return 0;
  return (props.startTime / props.duration) * 100;
});

const endMarker = computed(() => {
  if (!props.duration) return 100;
  return (props.endTime / props.duration) * 100;
});

// Загрузка и анализ аудио для создания waveform
async function loadWaveform() {
  if (!props.audioUrl || !canvasRef.value) return;

  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();

    // Загружаем аудио
    const response = await fetch(props.audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Анализируем амплитуду
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.floor(channelData.length / 200); // 200 пикселей ширины
    const waveform: number[] = [];

    for (let i = 0; i < 200; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, channelData.length);
      let sum = 0;
      let count = 0;

      for (let j = start; j < end; j++) {
        const sample = channelData[j];
        if (sample !== undefined) {
          sum += Math.abs(sample);
          count++;
        }
      }

      waveform.push(count > 0 ? sum / count : 0);
    }

    waveformData.value = waveform;
    drawWaveform();

    void audioCtx.close();
  } catch (error) {
    console.error('Error loading waveform:', error);
  }
}

// Отрисовка waveform
function drawWaveform() {
  if (!canvasRef.value || waveformData.value.length === 0) return;

  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Устанавливаем размер canvas
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const width = canvas.width;
  const height = canvas.height;

  // Очищаем canvas
  ctx.clearRect(0, 0, width, height);

  // Рисуем фон
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, width, height);

  // Рисуем waveform
  const barWidth = width / waveformData.value.length;
  const maxAmplitude = Math.max(...waveformData.value);

  // Градиент для waveform
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');

  ctx.fillStyle = gradient;

  waveformData.value.forEach((amplitude, index) => {
    const barHeight = (amplitude / maxAmplitude) * height * 0.9;
    const x = index * barWidth;
    const y = (height - barHeight) / 2;

    // Добавляем тень для лучшей видимости
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 2;
    ctx.fillRect(x, y, barWidth - 1, barHeight);
    ctx.shadowBlur = 0;
  });

  // Рисуем сетку
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;

  // Вертикальные линии каждую секунду
  if (props.duration) {
    const secondsPerLine = Math.max(1, Math.floor(props.duration / 10));
    for (let i = 0; i <= props.duration; i += secondsPerLine) {
      const x = (i / props.duration) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  // Рисуем линии метронома
  if (props.isMetronomeOn && props.bpm && props.duration) {
    const beatInterval = 60 / props.bpm; // интервал между ударами в секундах
    const beatsPerBar = 4; // 4/4 размер

    ctx.strokeStyle = 'rgba(255, 193, 7, 0.6)'; // желтый цвет для метронома
    ctx.lineWidth = 2;

    for (let time = 0; time <= props.duration; time += beatInterval) {
      const x = (time / props.duration) * width;
      const isAccent = Math.floor(time / (beatInterval * beatsPerBar)) % beatsPerBar === 0;

      // Более яркая линия для акцентного удара
      if (isAccent) {
        ctx.strokeStyle = 'rgba(255, 193, 7, 0.9)';
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = 'rgba(255, 193, 7, 0.4)';
        ctx.lineWidth = 1;
      }

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  // Горизонтальные линии
  for (let i = 0; i <= 4; i++) {
    const y = (height / 4) * i;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

// Обработчики мыши
function onMouseDown(e: MouseEvent) {
  if (!canvasRef.value) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const percent = (x / rect.width) * 100;

  // Определяем что перетаскиваем
  if (Math.abs(percent - startMarker.value) < 5) {
    dragType.value = 'start';
  } else if (Math.abs(percent - endMarker.value) < 5) {
    dragType.value = 'end';
  } else {
    dragType.value = null;
  }

  if (dragType.value) {
    isDragging.value = true;
    dragStartX.value = x;
  }
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value || !dragType.value || !canvasRef.value || !props.duration) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
  const time = (percent / 100) * props.duration;

  if (dragType.value === 'start') {
    const newStartTime = Math.min(time, props.endTime - 0.1);
    emit('update:startTime', newStartTime);
  } else if (dragType.value === 'end') {
    const newEndTime = Math.max(time, props.startTime + 0.1);
    emit('update:endTime', newEndTime);
  }
}

function onMouseUp() {
  isDragging.value = false;
  dragType.value = null;
}

// Обработчики touch
function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    if (touch) {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      onMouseDown(mouseEvent);
    }
  }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    if (touch) {
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      onMouseMove(mouseEvent);
    }
  }
}

function onTouchEnd() {
  onMouseUp();
}

// Watchers
watch(() => props.audioUrl, () => {
  if (props.audioUrl) {
    void loadWaveform();
  }
});

watch(() => props.duration, () => {
  if (props.duration) {
    drawWaveform();
  }
});

watch([() => props.bpm, () => props.isMetronomeOn], () => {
  if (props.duration) {
    drawWaveform();
  }
});

// Инициализация
onMounted(() => {
  if (props.audioUrl) {
    void nextTick(() => {
      void loadWaveform().catch(console.error);
    });
  }
});
</script>

<style scoped>
.audio-waveform-container {
  position: relative;
  width: 100%;
  height: 120px;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.6) 100%);
  border-radius: 12px;
  overflow: hidden;
  cursor: crosshair;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.waveform-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.trim-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  z-index: 10;
  border-radius: 2px;
}

.start-marker {
  background: linear-gradient(to bottom, #2196f3, #1976d2);
  box-shadow: 0 0 8px rgba(33, 150, 243, 0.6);
}

.end-marker {
  background: linear-gradient(to bottom, #f44336, #d32f2f);
  box-shadow: 0 0 8px rgba(244, 67, 54, 0.6);
}

.marker-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  background: currentColor;
  opacity: 0.9;
}

.marker-label {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  background: currentColor;
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0.95;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.selection-area {
  position: absolute;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg,
    rgba(76, 175, 80, 0.3) 0%,
    rgba(76, 175, 80, 0.2) 50%,
    rgba(76, 175, 80, 0.3) 100%);
  border-left: 3px solid #4caf50;
  border-right: 3px solid #4caf50;
  pointer-events: none;
  z-index: 5;
  box-shadow: inset 0 0 10px rgba(76, 175, 80, 0.2);
}

/* Адаптивность */
@media (max-width: 600px) {
  .audio-waveform-container {
    height: 80px;
  }

  .marker-label {
    font-size: 9px;
    padding: 2px 6px;
    top: -20px;
  }
}

.metronome-legend {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.5);
  padding: 8px;
  border-radius: 0 0 12px 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.legend-line {
  width: 20px;
  height: 2px;
  margin-right: 8px;
}

.accent-line {
  background: rgba(255, 193, 7, 0.9);
}

.beat-line {
  background: rgba(255, 193, 7, 0.4);
}

.legend-text {
  color: white;
  font-size: 12px;
  font-weight: 600;
}
</style>
