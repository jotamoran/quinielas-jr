export default [
    {
        path: '/principal',
        component: () => import('@/layouts/DashLayout.vue'),
        meta: { requiresAuth: true }, 
        children: [
            {
                path: '',
                name: 'principal',
                component: () => import('./views/Principal.vue'),
                meta: { requiresAuth: true }
            }
        ]
    }
];
