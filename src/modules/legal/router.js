export default [
  { path: '/aviso-de-privacidad', name: 'aviso-privacidad', component: () => import('./views/AvisoPrivacidad.vue') },
  { path: '/terminos-y-condiciones', name: 'terminos', component: () => import('./views/Terminos.vue') },
  { path: '/reglamento', name: 'reglamento', component: () => import('./views/Reglamento.vue') },
];
