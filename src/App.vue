<template>
  <router-view />
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';

const $q = useQuasar();

// Включаем темную тему по умолчанию
$q.dark.set(true);
</script>
