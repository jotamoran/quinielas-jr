<template>
  <section class="p-4 md:p-8">
    <div class="mx-auto max-w-5xl">
      <v-card class="overflow-hidden rounded-2xl border border-gray-200 shadow-xl">
        <div class="bg-tracsa-principal px-6 py-8 text-white md:px-10">
          <div class="flex flex-col gap-5 md:flex-row md:items-center">
            <div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-tracsa-secundario text-tracsa-principal shadow-lg">
              <v-icon size="46">
                {{ datosSistema.icono }}
              </v-icon>
            </div>

            <div>
              <p class="mb-1 text-sm font-semibold uppercase tracking-wide text-tracsa-secundario">
                Sistema
              </p>

              <h1 class="font-bold text-3xl md:text-4xl">
                {{ datosSistema.nombre }}
              </h1>

              <p class="mt-3 max-w-3xl text-sm leading-6 text-gray-300 md:text-base">
                {{ datosSistema.descripcion }}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white px-6 py-8 md:px-10">
          <div class="rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <h2 class="font-semibold text-xl text-gray-900">
              Bienvenido
            </h2>

            <p class="mt-2 text-sm leading-6 text-gray-600 md:text-base">
              Selecciona una opción del menú de la izquierda para comenzar a trabajar dentro de este sistema.
            </p>
          </div>
        </div>
      </v-card>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  sistema: {
    type: Object,
    default: null
  }
});

const datosSistema = computed(() => {
  return {
    nombre: props.sistema?.nombre || 'Sistema',
    descripcion: props.sistema?.descripcion || 'Bienvenido al sistema seleccionado.',
    icono: props.sistema?.icono || 'mdi-apps'
  };
});
</script>