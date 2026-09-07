<template>
  <v-container class="mb-6 py-10">

    <v-row
      v-if="loading"
      justify="center"
      class="mt-10"
    >
      <v-col cols="12" class="text-center">
        <v-progress-circular
          indeterminate
          size="64"
          color="tracsa-secundario"
          width="6"
        />

        <p class="mt-4 text-grey-darken-1 font-medium">
          Cargando sistemas...
        </p>
      </v-col>
    </v-row>

    <v-row
      v-else-if="sistemas.length > 0"
      justify="center"
      class="ga-y-6"
    >
      <v-col
        v-for="sistema in sistemas"
        :key="sistema.id"
        cols="12"
        sm="6"
        md="4"
        lg="3"
        class="d-flex justify-center"
      >
        <v-card
          hover
          variant="outlined"
          role="link"
          tabindex="0"
          :aria-label="`Abrir ${sistema.nombre}`"
          class="sistema-card group rounded-2xl border border-gray-200 px-5 py-6 text-center transition-all duration-300 hover:bg-tracsa-secundario hover:shadow-2xl flex flex-col items-center justify-center md:pa-8"
          width="100%"
          max-width="320"
          @click="irSistema(sistema)"
          @keydown.enter="irSistema(sistema)"
          @keydown.space.prevent="irSistema(sistema)"
        >
          <div class="mb-6 flex justify-center">
            <div
              class="flex h-20 w-20 items-center justify-center rounded-2xl bg-tracsa-secundario/20 text-tracsa-secundario transition-colors duration-300 group-hover:bg-white group-hover:text-tracsa-principal"
            >
              <v-icon size="40">
                {{ sistema.icono || "mdi-application-cog" }}
              </v-icon>
            </div>
          </div>

          <h4
            class="mb-4 font-bold text-2xl text-gray-900 transition-colors duration-300 group-hover:text-tracsa-principal"
          >
            {{ sistema.nombre }}
          </h4>

          <p
            class="line-clamp-3 hidden text-lg leading-relaxed text-gray-500 transition-colors duration-300 group-hover:text-tracsa-principal md:block"
          >
            {{
              sistema.descripcion ||
              "Accede a las herramientas y funciones de este módulo."
            }}
          </p>
        </v-card>
      </v-col>
    </v-row>

    <v-row
      v-else
      align="center"
      justify="center"
      class="mt-10 text-center"
    >
      <v-col cols="12" md="6">
        <v-icon size="80" color="grey-lighten-1">
          mdi-lock-alert-outline
        </v-icon>

        <h4 class="mt-4 font-bold text-h5 text-grey-darken-1">
          {{
            $t
              ? $t("sistemas.no-permisos")
              : "No tienes sistemas asignados"
          }}
        </h4>

        <p class="mt-2 text-grey">
          Contacta al administrador si crees que esto es un error.
        </p>
      </v-col>
    </v-row>

  </v-container>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";

import { obtenerSistemas } from "../services/dashboardService";
import { useAuthStore } from "@/store/auth";
import { notify } from "@/utils/funciones";

const router = useRouter();
const authStore = useAuthStore();

const sistemas = ref([]);
const loading = ref(false);

const cargarSistemas = async () => {
  try {
    loading.value = true;

    const data = await obtenerSistemas();

    sistemas.value = data || [];

    authStore.setSistemas(data || []);

  } catch (error) {
    notify(
      "No fue posible cargar los sistemas",
      "Intenta nuevamente en unos momentos.",
      "error"
    );
    console.error(
      "Error al obtener los sistemas del usuario:",
      error
    );
  } finally {
    loading.value = false;
  }
};

const irSistema = (sistema) => {
  if (!sistema?.slug) return;

  router.push(`/${sistema.slug}`);
};

onMounted(() => {
  cargarSistemas();
});
</script>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.v-card--hover:hover {
  transform: translateY(-8px);
}

.sistema-card {
  min-height: 210px;
}

.sistema-card:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

@media (min-width: 960px) {
  .sistema-card {
    min-height: 350px;
  }
}

@media (hover: none) {
  .v-card--hover:hover {
    transform: none;
  }
}
</style>
