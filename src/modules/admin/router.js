export default [
  { path: '/admin/jornadas', name: 'admin-jornadas', component: () => import('./views/GestionJornadas.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/pagos', name: 'admin-pagos', component: () => import('./views/AutorizacionPagos.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/sincronizar', name: 'admin-sincronizar', component: () => import('./views/SincronizarResultados.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/cerrar-jornada', name: 'admin-cerrar-jornada', component: () => import('./views/CerrarJornada.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/edicion-manual', name: 'admin-edicion-manual', component: () => import('./views/EdicionManual.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
];
