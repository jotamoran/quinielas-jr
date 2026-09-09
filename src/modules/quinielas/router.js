export default [
  { path: '/', redirect: { name: 'mis-quinielas' } },
  { path: '/mis-quinielas', name: 'mis-quinielas', component: () => import('./views/MisQuinielas.vue'), meta: { requiresAuth: true } },
  { path: '/llenar-quiniela', name: 'llenar-quiniela', component: () => import('./views/LlenarQuiniela.vue') },
];
