<script setup>
import { computed, onMounted } from "vue";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "vue-router";
import { useDisplay } from "vuetify";

const authStore = useAuthStore();
const router = useRouter();
const { mdAndUp } = useDisplay();

const lcNombre = computed(() => authStore.user?.nombre || "Usuario");

const cerrarSesion = () => {
  authStore.logout();
  router.push("/");
};

const redirectInicio = () => router.push("/principal");

onMounted(() => {
  if (!authStore.token) {
    router.push("/");
  }
});
</script>

<template>
  <v-app-bar app flat class="!bg-tracsa-principal text-white px-2" border="b">
    <img
      v-if="mdAndUp"
      src="@/assets/logo.jpg"
      class="ml-3 h-10 w-auto cursor-pointer object-contain"
      alt="Grupo TRACSA"
      @click="redirectInicio"
    />

    <v-toolbar-title class="ml-2 min-w-0 truncate text-base font-bold sm:ml-4 sm:text-h6">
      {{ mdAndUp ? "Aplicaciones - Operaciones y Logística" : "Apps OyL" }}
    </v-toolbar-title>

    <v-spacer></v-spacer>

    <div class="d-flex align-center">
      <v-menu min-width="200px" rounded border>
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" variant="text" class="text-none px-1 px-sm-4">
            <v-icon :start="mdAndUp">mdi-account-circle</v-icon>
            <span v-if="mdAndUp" class="ml-2 max-w-48 truncate">{{ lcNombre }}</span>
            <v-icon end size="small">mdi-chevron-down</v-icon>
          </v-btn>
        </template>

        <v-list density="compact" nav>
          <v-list-item
            prepend-icon="mdi-account-outline"
            :title="lcNombre"
            class="mb-2"
          >
          </v-list-item>

          <v-divider></v-divider>

          <v-list-item
            prepend-icon="mdi-logout"
            title="Cerrar sesión"
            base-color="error"
            @click="cerrarSesion"
            class="mt-2"
          >
          </v-list-item>
        </v-list>
      </v-menu>
    </div>
  </v-app-bar>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
