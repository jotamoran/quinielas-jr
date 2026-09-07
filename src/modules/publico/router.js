export default [
  {
    path: '/publico/:jornadaId',
    name: 'tabla-publica',
    component: () => import('./views/TablaPublica.vue'),
  },
];
