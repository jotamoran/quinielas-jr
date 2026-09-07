<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/auth';
import { useRouter, useRoute } from 'vue-router';
import { useDisplay } from 'vuetify';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const { mdAndUp } = useDisplay();

const drawer = ref(true);
const menuExpandido = ref(true);
const open = ref([]);

const menu = computed(() => authStore.menu || []);
const sistemaActual = computed(() => authStore.sistemaActual);
const nombreUsuario = computed(() => authStore.user?.nombre || 'Usuario');

const tituloSistema = computed(() => {
  return sistemaActual.value?.nombre || 'Sistema';
});

const rutaActual = computed(() => route.path);

const normalizarRuta = (ruta) => {
  if (!ruta || ruta === '/') return ruta;
  return ruta.replace(/\/+$/, '');
};

const obtenerRutaCompleta = (url) => {
  if (!url) return '';

  if (url.startsWith('http')) return url;

  const base = sistemaActual.value?.slug
    ? `/${sistemaActual.value.slug}`
    : '';

  return url.startsWith('/')
    ? `${base}${url}`
    : `${base}/${url}`;
};

const esRutaActiva = (url) => {
  const rutaFinal = obtenerRutaCompleta(url);

  if (!rutaFinal || rutaFinal.startsWith('http')) return false;

  return normalizarRuta(rutaActual.value) === normalizarRuta(rutaFinal);
};

const itemTieneActivo = (item) => {
  if (esRutaActiva(item.ruta)) return true;

  if (!item.children || item.children.length === 0) return false;

  return item.children.some((sub) => itemTieneActivo(sub));
};

const redirigir = (url) => {
  if (!url) return;

  if (url.startsWith('http')) {
    window.location.href = url;
    return;
  }

  router.push(obtenerRutaCompleta(url));
};

const cerrarSesion = () => {
  authStore.logout();
  router.push('/');
};

const irPrincipal = () => {
  router.push('/principal');
};

const irInicioSistema = () => {
  if (sistemaActual.value?.slug) {
    router.push(`/${sistemaActual.value.slug}`);
    return;
  }

  router.push('/principal');
};

const alternarMenu = () => {
  menuExpandido.value = !menuExpandido.value;

  if (!menuExpandido.value) {
    open.value = [];
  }
};

watch(
  () => menu.value,
  () => {
    const abiertos = menu.value
      .filter((item) => itemTieneActivo(item))
      .map((item) => item.id);

    if (menuExpandido.value) {
      open.value = abiertos;
    }
  },
  { immediate: true, deep: true }
);

watch(
  () => route.path,
  () => {
    if (!menuExpandido.value) return;

    const abiertos = menu.value
      .filter((item) => itemTieneActivo(item))
      .map((item) => item.id);

    open.value = abiertos;
  }
);

onMounted(() => {
  if (!authStore.token) {
    router.push('/');
    return;
  }

  drawer.value = mdAndUp.value;
  menuExpandido.value = true;
});

watch(mdAndUp, (valor) => {
  drawer.value = valor;
  menuExpandido.value = true;
});
</script>

<template>
  <v-navigation-drawer v-model="drawer" :rail="!menuExpandido" rail-width="64" :permanent="mdAndUp"
    :temporary="!mdAndUp" app elevation="4" class="!bg-tracsa-principal text-white"
    :class="{ 'menu-contraido': !menuExpandido }">
    <v-list>
      <v-list-item class="px-2">
        <template #prepend>
          <v-avatar class="menu-toggle cursor-pointer bg-tracsa-secundario text-tracsa-principal"
            :size="menuExpandido ? 45 : 38"
            role="button" tabindex="0" title="Expandir o contraer menú" aria-label="Expandir o contraer menú"
            @click.stop="alternarMenu" @keydown.enter.stop="alternarMenu" @keydown.space.prevent.stop="alternarMenu">
            <v-icon>
              mdi-apps
            </v-icon>
          </v-avatar>
        </template>

        <v-list-item-title v-if="menuExpandido" @click="irPrincipal"
          class="ml-3 font-bold text-white d-flex align-center cursor-pointer">
          <span>APPS - OYL</span>

          <v-btn icon density="compact" size="small" class="ml-2 text-black" :title="'Ir a inicio del sistema'">
            <v-icon size="small">mdi-home</v-icon>

            <v-tooltip activator="parent" location="bottom">
              Inicio
            </v-tooltip>
          </v-btn>
        </v-list-item-title>
      </v-list-item>
    </v-list>

    <v-divider color="white" />

    <v-list density="compact" nav v-model:opened="open">
      <template v-for="item in menu" :key="item.id">
        <v-list-group v-if="item.children && item.children.length > 0" :value="item.id">
          <template #activator="{ props }">
            <v-list-item v-bind="props" :prepend-icon="item.icono || 'mdi-folder-outline'" :title="item.titulo"
              class="menu-item" :class="{ 'menu-activo': itemTieneActivo(item) || open.includes(item.id) }">
              <v-tooltip v-if="!menuExpandido" activator="parent" location="right">
                {{ item.titulo }}
              </v-tooltip>
            </v-list-item>
          </template>

          <v-list-item v-for="sub in item.children" :key="sub.id" :title="sub.titulo"
            :prepend-icon="sub.icono || 'mdi-chevron-right'" class="sub-item"
            :class="{ 'menu-activo': itemTieneActivo(sub) }" @click="redirigir(sub.ruta)">
            <v-tooltip v-if="!menuExpandido" activator="parent" location="right">
              {{ sub.titulo }}
            </v-tooltip>
          </v-list-item>
        </v-list-group>

        <v-list-item v-else :prepend-icon="item.icono || 'mdi-chevron-right'" :title="item.titulo" class="menu-item"
          :class="{ 'menu-activo': esRutaActiva(item.ruta) }" @click="redirigir(item.ruta)">
          <v-tooltip v-if="!menuExpandido" activator="parent" location="right">
            {{ item.titulo }}
          </v-tooltip>
        </v-list-item>
      </template>
    </v-list>

    <template #append>
      <v-list density="compact" nav>
        <v-list-item prepend-icon="mdi-home" title="Inicio" class="menu-item"
          :class="{ 'menu-activo': route.path === '/principal' }" @click="irPrincipal">
          <v-tooltip v-if="!menuExpandido" activator="parent" location="right">
            Inicio
          </v-tooltip>
        </v-list-item>
      </v-list>
    </template>
  </v-navigation-drawer>

  <v-app-bar app flat class="!bg-tracsa-principal px-2 text-white" border="b">
    <v-app-bar-nav-icon v-if="!mdAndUp" @click.stop="drawer = !drawer" />

    <div class="relative flex w-full items-center">
      <div class="min-w-0 flex-1">
        <v-toolbar-title class="truncate font-bold text-base md:text-lg">
          {{ mdAndUp ? tituloSistema : 'Apps OyL' }}
        </v-toolbar-title>
      </div>

      <div class="absolute left-1/2 hidden -translate-x-1/2 cursor-pointer md:block" @click="irPrincipal" role="button"
        tabindex="0">
        <img src="@/assets/logo.jpg" class="h-10 object-contain" alt="Logo" />
      </div>

      <div class="flex flex-1 items-center justify-end gap-2">


        <v-menu min-width="220px" rounded border>
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="text" class="text-none px-1 px-sm-4">
              <v-icon :start="mdAndUp">
                mdi-account-circle
              </v-icon>

              <span v-if="mdAndUp" class="ml-2 max-w-48 truncate">
                {{ nombreUsuario }}
              </span>

              <v-icon end size="small">
                mdi-chevron-down
              </v-icon>
            </v-btn>
          </template>

          <v-list density="compact" nav>
            <v-list-item prepend-icon="mdi-account-outline" :title="nombreUsuario" class="mb-2" />

            <v-divider />

            <v-list-item prepend-icon="mdi-logout" title="Cerrar sesión" base-color="error" class="mt-2"
              @click="cerrarSesion" />
          </v-list>
        </v-menu>
      </div>
    </div>
  </v-app-bar>
</template>

<style scoped>
.menu-item {
  color: white;
  height: 44px;
  max-height: 44px;
  min-height: 44px !important;
}

.menu-item:hover {
  background-color: rgba(255, 255, 255, 0.12) !important;
}

.sub-item {
  background-color: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 0.85rem;
  height: 40px;
  max-height: 40px;
  min-height: 40px !important;
  padding-left: 18px;
}

.sub-item:hover {
  background-color: rgba(255, 255, 255, 0.12) !important;
}

.menu-activo {
  background-color: rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-secondary)) !important;
  font-weight: 700;
}

.menu-activo :deep(.v-icon) {
  color: rgb(var(--v-theme-secondary)) !important;
}

.menu-contraido .menu-item {
  border-radius: 8px;
}

.menu-contraido .menu-item :deep(.v-icon) {
  font-size: 20px !important;
}

.menu-contraido .menu-toggle {
  --v-avatar-height: 38px !important;
  height: 38px !important;
  width: 38px !important;
}

.menu-contraido .menu-toggle :deep(.v-icon) {
  font-size: 20px !important;
}

.menu-item :deep(.v-list-item-title) {
  white-space: normal;
  word-break: break-word;
}

.sub-item :deep(.v-list-item-title) {
  white-space: normal;
  word-break: break-word;
}
</style>
