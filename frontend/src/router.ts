import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from './api';

function defaultHome(): string {
  return '/chat';
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', component: () => import('./views/LoginPage.vue'), meta: { public: true } },
    { path: '/activate', component: () => import('./views/ActivatePage.vue'), meta: { public: true } },
    { path: '/profile', component: () => import('./views/ProfilePage.vue') },
    { path: '/friends', component: () => import('./views/FriendsPage.vue') },
    { path: '/chat', component: () => import('./views/ChatPage.vue') },
    { path: '/admin/registrations', component: () => import('./views/AdminRegistrations.vue') },
    { path: '/admin/users', component: () => import('./views/UsersPage.vue') },
    { path: '/timelines', component: () => import('./views/TimelineListPage.vue') },
    { path: '/timelines/:id', component: () => import('./views/TimelineDetailPage.vue') },
    { path: '/timelines/:id/mr/:mrId', component: () => import('./views/MergeRequestPage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
});

router.beforeEach((to) => {
  const authed = Boolean(getToken());
  if (!to.meta.public && !authed) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  if (to.path === '/login' && authed) {
    return defaultHome();
  }
  return true;
});

export default router;
