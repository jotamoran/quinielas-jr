export default [
  { path: '/', name: 'inicio', component: () => import('./views/Inicio.vue') },
  { path: '/mis-quinielas', name: 'mis-quinielas', component: () => import('./views/MisQuinielas.vue'), meta: { requiresAuth: true } },
  { path: '/llenar-quiniela/:jornadaId?', name: 'llenar-quiniela', component: () => import('./views/LlenarQuiniela.vue') },
  { path: '/editar-quiniela/:quinielaId', name: 'editar-quiniela', component: () => import('./views/EditarQuiniela.vue'), meta: { requiresAuth: true } },
];
