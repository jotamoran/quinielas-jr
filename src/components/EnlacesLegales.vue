<template>
  <nav aria-label="Información legal" class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-semibold">
    <router-link :to="{ name: 'aviso-privacidad' }" class="text-quiniela-verde underline-offset-2 hover:underline">Aviso de privacidad</router-link>
    <router-link :to="{ name: 'terminos' }" class="text-quiniela-verde underline-offset-2 hover:underline">Términos y condiciones</router-link>
    <router-link :to="{ name: 'reglamento' }" class="text-quiniela-verde underline-offset-2 hover:underline">Reglamento</router-link>
  </nav>
</template>
