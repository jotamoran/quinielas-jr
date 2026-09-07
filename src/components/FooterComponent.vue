<script setup>
import { ref } from "vue";

const avisoVisible = ref(false);

const toggleAviso = () => {
  avisoVisible.value = !avisoVisible.value;
};
</script>

<template>
  <footer class="shrink-0 w-full bg-tracsa-principal text-white text-sm shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
    <div class="text-center py-2 bg-white/10">
      © {{ new Date().getFullYear() }} Grupo TRACSA - Todos los derechos reservados
    </div>

    <div class="text-center py-2">
      <button
        @click="toggleAviso"
        class="flex items-center justify-center gap-2 mx-auto hover:underline"
      >
        Aviso de privacidad
        <v-icon :icon="avisoVisible ? 'mdi-chevron-down' : 'mdi-chevron-up'" />
      </button>
    </div>

    <div
      v-show="avisoVisible"
      class="px-6 pb-4 text-justify leading-relaxed max-w-4xl mx-auto"
    >
      AVISO DE PRIVACIDAD SIMPLIFICADO TRACSA S.A.P.I. DE C.V., con domicilio en
      Periférico Sur número 7800 en la Colonia Santa María Tequepexpan en
      Tlaquepaque, Jalisco, utilizará sus datos personales para ventas y servicio
      al cliente.

      <br /><br />

      Para más información sobre el tratamiento de sus datos, visite:

      <a
        href="https://tracsa.com.mx/"
        target="_blank"
        rel="noopener noreferrer"
        class="underline"
      >
        https://tracsa.com.mx/
      </a>
    </div>
  </footer>
</template>
