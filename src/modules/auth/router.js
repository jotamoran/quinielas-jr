export default [
  { path: '/login', name: 'login', component: () => import('./views/Login.vue'), meta: { guestOnly: true } },
  { path: '/registro', name: 'registro', component: () => import('./views/Registro.vue'), meta: { guestOnly: true } },
  { path: '/verificar-codigo', name: 'verificar-codigo', component: () => import('./views/VerificarCodigo.vue'), meta: { guestOnly: true } },
  { path: '/recuperar-password', name: 'recuperar-password', component: () => import('./views/RecuperarPassword.vue'), meta: { guestOnly: true } },
  { path: '/mi-cuenta', name: 'mi-cuenta', component: () => import('./views/MiCuenta.vue'), meta: { requiresAuth: true } },
];
