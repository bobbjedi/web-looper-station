# LooperStation

**LooperStation** — это современный web-лупер для музыкантов и экспериментов с ритмом, написанный на Vue 3 + TypeScript + Quasar.

## Возможности
- Несколько независимых лупов (дорожек)
- Запись с микрофона
- Синхронизированное зацикленное воспроизведение всех лупов
- Mute/Unmute и сброс для каждой дорожки
- Индикация уровня микрофона
- Адаптивный интерфейс для мобильных устройств
- Умный старт записи первого лупа по звуку (clap/струна)

## Стек
- [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- [Quasar Framework](https://quasar.dev/) (UI и адаптивность)
- Web Audio API, MediaRecorder API

## Быстрый старт
```bash
npm install
npm run dev
```
Приложение будет доступно на http://localhost:9000

## Скрипты
- `npm run dev` — запуск dev-сервера
- `npm run build` — сборка production-версии
- `npm run lint` — проверка кода

## TODO/Планы
- Экспорт/импорт лупов
- Визуализация прогресса
- Микшер громкости
- Sample-accurate sync через Web Audio API

---

**LooperStation** — твой персональный web-лупер!
