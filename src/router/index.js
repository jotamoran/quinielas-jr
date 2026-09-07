import { createWebHashHistory, createRouter } from "vue-router";
import { useAuthStore } from "@/store/auth";
import { jwtDecode } from "jwt-decode";
import { obtenerSistemas } from "@/modules/principal/services/dashboardService";

import authRoutes from "@/modules/auth/router.js";
import dashboardRoutes from "@/modules/principal/router.js";
import dashboardPermisosRoutes from '@/modules/dashboard_permisos/router.js';
import almacenRoutes from '@/modules/almacen/router.js';
import trackerProyectosRoutes from '@/modules/tracker_proyectos/router'
import cotizadorIaRoutes from '@/modules/cotizador_ia/router.js'

const routes = [
  ...authRoutes,
  ...dashboardRoutes,
  ...dashboardPermisosRoutes,
  ...almacenRoutes,
  ...trackerProyectosRoutes,
  ...cotizadorIaRoutes,
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  let tokenPayload = null;

  try {
    if (authStore.token) {
      tokenPayload = jwtDecode(authStore.token);
      const tiempoActual = Math.floor(Date.now() / 1000);

      if (!tokenPayload.exp || tokenPayload.exp <= tiempoActual) {
        authStore.logout();
        return next({ name: 'login', replace: true });
      }
    }
  } catch (error) {
    authStore.logout();
    return next({ name: 'login', replace: true });
  }

  const isAuthenticated = authStore.isLoggedIn;

  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({ name: 'login', replace: true });
  }

  if (to.meta.requiresSuperuser && tokenPayload?.role_id !== 4) {
    return next({ name: 'principal', replace: true });
  }

  if (to.meta.sistema && isAuthenticated) {
    try {
      if (!authStore.sistemas?.length) {
        authStore.setSistemas(await obtenerSistemas(false));
      }

      const normalizarSistema = (valor) => String(valor || '').replaceAll('_', '-').toLowerCase();
      const sistemaEsperado = normalizarSistema(to.meta.sistema);
      const tieneAcceso = authStore.sistemas.some((sistema) => (
        normalizarSistema(sistema.slug) === sistemaEsperado
      ));

      if (!tieneAcceso) {
        return next({ name: 'principal', replace: true });
      }
    } catch {
      return next({ name: 'principal', replace: true });
    }
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return next({ name: 'principal', replace: true });
  }

  next();
});

export default router;
