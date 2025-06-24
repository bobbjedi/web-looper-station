// Утилиты для работы с аудио в looper

/**
 * Дополняет короткое аудио пустотой до указанной длительности
 * @param audioBuffer - исходный аудио буфер
 * @param targetDuration - целевая длительность в секундах
 * @returns новый аудио буфер с дополненной пустотой
 */
export function padAudioWithSilence(audioBuffer: AudioBuffer, targetDuration: number): AudioBuffer {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();

  const targetSamples = Math.floor(targetDuration * audioCtx.sampleRate);
  const currentSamples = audioBuffer.length;

  // Если аудио уже нужной длины или длиннее, возвращаем как есть
  if (currentSamples >= targetSamples) {
    return audioBuffer;
  }

  // Создаем новый буфер с нужной длиной
  const newBuffer = audioCtx.createBuffer(
    audioBuffer.numberOfChannels,
    targetSamples,
    audioCtx.sampleRate
  );

  // Копируем исходные данные
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    // Копируем исходные данные
    for (let i = 0; i < currentSamples; i++) {
      newData[i] = originalData[i] ?? 0;
    }

    // Остальная часть остается пустой (нули)
    for (let i = currentSamples; i < targetSamples; i++) {
      newData[i] = 0;
    }
  }

  return newBuffer;
}

/**
 * Конвертирует AudioBuffer в WAV Blob
 * @param buffer - аудио буфер для конвертации
 * @returns Blob с WAV данными
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numberOfChannels * 2, true);

  // Audio data
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      const normalizedSample = Math.max(-1, Math.min(1, sample ?? 0));
      view.setInt16(offset, normalizedSample < 0 ? normalizedSample * 0x8000 : normalizedSample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Создает пустой аудио буфер заданной длительности
 * @param duration - длительность в секундах
 * @param sampleRate - частота дискретизации (по умолчанию 44100)
 * @returns пустой аудио буфер
 */
export function createSilentBuffer(duration: number, sampleRate: number = 44100): AudioBuffer {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();

  const samples = Math.floor(duration * sampleRate);
  const buffer = audioCtx.createBuffer(1, samples, sampleRate);

  // Заполняем нулями (тишина)
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) {
    data[i] = 0;
  }

  return buffer;
}

/**
 * Получает длительность аудио из Blob
 * @param audioBlob - аудио blob
 * @returns Promise с длительностью в секундах
 */
export async function getAudioDuration(audioBlob: Blob): Promise<number> {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    void audioCtx.close();
    return duration;
  } catch (error) {
    console.error('Ошибка получения длительности аудио:', error);
    throw error;
  }
}

/**
 * Обрабатывает записанное аудио: дополняет пустотой до целевой длительности
 * @param audioBlob - исходный аудио blob
 * @param targetDuration - целевая длительность в секундах
 * @returns Promise с новым аудио blob
 */
export async function processRecordedAudio(audioBlob: Blob, targetDuration: number): Promise<{ blob: Blob; duration: number }> {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();

    // Декодируем исходное аудио
    const arrayBuffer = await audioBlob.arrayBuffer();
    const originalBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Дополняем пустотой если нужно
    const paddedBuffer = padAudioWithSilence(originalBuffer, targetDuration);

    // Конвертируем обратно в WAV
    const wavBlob = audioBufferToWav(paddedBuffer);

    void audioCtx.close();

    return {
      blob: wavBlob,
      duration: paddedBuffer.duration
    };
  } catch (error) {
    console.error('Ошибка обработки записанного аудио:', error);
    throw error;
  }
}

/**
 * Быстрая автокорреляция с downsampling и регулируемой точностью
 * @param samples - массив сэмплов (моно)
 * @param sampleRate - частота дискретизации
 * @param minSec - минимальная длина цикла (сек)
 * @param maxSec - максимальная длина цикла (сек)
 * @param accuracy - точность поиска (1=максимум, 10=очень быстро)
 * @returns длина цикла в сэмплах
 */
export function detectLoopLengthByAutocorrelation(
  samples: Float32Array,
  sampleRate: number,
  minSec = 0.5,
  maxSec = 8,
  accuracy = 1 // 1 — максимум, 10 — быстро
): number {
  // Чем выше accuracy, тем быстрее (и чуть менее точно)
  const downsampleFactor = Math.max(1, Math.min(accuracy, 10));
  const lagStep = Math.max(1, Math.round(accuracy * 5));
  // Downsample
  const dsSamples = new Float32Array(Math.floor(samples.length / downsampleFactor));
  for (let i = 0; i < dsSamples.length; i++) {
    const idx = i * downsampleFactor;
    dsSamples[i] = (idx < samples.length && typeof samples[idx] === 'number') ? samples[idx] : 0;
  }
  const dsRate = sampleRate / downsampleFactor;
  const minLag = Math.floor(minSec * dsRate);
  const maxLag = Math.min(Math.floor(maxSec * dsRate), dsSamples.length - 1);

  let bestLag = minLag;
  let bestCorr = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag += lagStep) {
    let sum = 0, sumSq1 = 0, sumSq2 = 0;
    for (let i = 0; i < dsSamples.length - lag; i++) {
      const sample1 = dsSamples[i];
      const sample2 = dsSamples[i + lag];
      const val1 = typeof sample1 === 'number' ? sample1 : 0;
      const val2 = typeof sample2 === 'number' ? sample2 : 0;
      sum += val1 * val2;
      sumSq1 += val1 * val1;
      sumSq2 += val2 * val2;
    }
    const normCorr = sum / Math.sqrt(sumSq1 * sumSq2 + 1e-10);
    if (lag % Math.floor(dsRate / 10) === 0) {
      console.log(`[Looper][autocorr-fast] lag=${lag} (${(lag/dsRate).toFixed(2)}s) corr=${normCorr.toFixed(4)}`);
    }
    if (normCorr > bestCorr) {
      bestCorr = normCorr;
      bestLag = lag;
    }
  }
  console.log(`[Looper][autocorr-fast] BEST: lag=${bestLag} (${(bestLag/dsRate).toFixed(3)}s) corr=${bestCorr.toFixed(4)}`);
  // Переводим lag обратно в sampleRate оригинала
  return bestLag * downsampleFactor;
}
