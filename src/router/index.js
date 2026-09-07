import { createWebHistory, createRouter } from "vue-router";
import { useAuthStore } from "@/store/auth";

import authRoutes from "@/modules/auth/router.js";
import quinielasRoutes from "@/modules/quinielas/router.js";
import adminRoutes from "@/modules/admin/router.js";
import publicoRoutes from "@/modules/publico/router.js";

const routes = [
  ...authRoutes,
  ...quinielasRoutes,
  ...adminRoutes,
  ...publicoRoutes,
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  if (!authStore.listo) {
    await authStore.init();
  }

  const isAuthenticated = authStore.isLoggedIn;

  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({ name: 'login', replace: true });
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return next({ name: 'mis-quinielas', replace: true });
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return next({ name: 'mis-quinielas', replace: true });
  }

  next();
});

export default router;
