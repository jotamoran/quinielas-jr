export default [
    {
        path: '/',
        component: () => import('@/layouts/AuthLayout.vue'),
        children: [
            {
                path: '',
                name: 'login',
                component: () => import('./views/Login.vue'),
                meta: { guestOnly: true }
            }
        ]
    }
];
