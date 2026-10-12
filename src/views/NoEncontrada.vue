<template>
  <main class="page-shell max-w-xl text-center">
    <p class="eyebrow">Error 404</p>
    <h1 class="page-title">No encontramos esta página</h1>
    <p class="page-description">La dirección no existe o ya no está disponible.</p>
    <router-link :to="{ name: 'inicio' }" class="mt-6 inline-block rounded-xl bg-quiniela-verde px-5 py-3 font-bold text-white">Ir al inicio</router-link>
  </main>
</template>
