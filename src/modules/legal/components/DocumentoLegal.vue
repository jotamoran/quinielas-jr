<script setup>
import { LEGAL } from '@/config/legal';

defineProps({ titulo: { type: String, required: true }, resumen: { type: String, default: '' } });

const documentos = [
  { nombre: 'aviso-privacidad', texto: 'Aviso de privacidad' },
  { nombre: 'terminos', texto: 'Términos y condiciones' },
  { nombre: 'reglamento', texto: 'Reglamento' },
];
</script>

<template>
  <main class="page-shell max-w-3xl">
    <header>
      <p class="eyebrow">Legal</p>
      <h1 class="page-title">{{ titulo }}</h1>
      <p v-if="resumen" class="page-description">{{ resumen }}</p>
      <p class="mt-2 text-xs text-gray-500">Última actualización: {{ LEGAL.actualizacion }}</p>
    </header>
    <article class="documento-legal rounded-2xl bg-white p-5 shadow-sm sm:p-8">
      <slot />
    </article>
    <nav aria-label="Documentos legales" class="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
      <router-link v-for="documento in documentos" :key="documento.nombre" :to="{ name: documento.nombre }" class="font-semibold text-quiniela-verde underline-offset-2 hover:underline" active-class="text-gray-500 no-underline pointer-events-none">{{ documento.texto }}</router-link>
    </nav>
  </main>
</template>

<style scoped>
.documento-legal :deep(h2) { margin-top: 1.75rem; margin-bottom: 0.5rem; font-size: 1.125rem; font-weight: 700; color: #0a3622; }
.documento-legal :deep(h2:first-child) { margin-top: 0; }
.documento-legal :deep(h3) { margin-top: 1rem; margin-bottom: 0.25rem; font-weight: 700; color: #1f2937; }
.documento-legal :deep(p), .documento-legal :deep(li) { font-size: 0.95rem; line-height: 1.65; color: #374151; }
.documento-legal :deep(p) { margin-top: 0.5rem; }
.documento-legal :deep(ul), .documento-legal :deep(ol) { margin-top: 0.5rem; padding-left: 1.25rem; }
.documento-legal :deep(ul) { list-style: disc; }
.documento-legal :deep(ol) { list-style: decimal; }
.documento-legal :deep(li) { margin-top: 0.25rem; }
.documento-legal :deep(a) { color: #157a4a; text-decoration: underline; }
.documento-legal :deep(.aviso) { margin-top: 0.75rem; border-radius: 0.75rem; border: 1px solid #fde68a; background: #fffbeb; padding: 0.75rem 1rem; }
</style>
