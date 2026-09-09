<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { computed } from 'vue';
import { currentUser, clearSession } from './api';

const route = useRoute();
const router = useRouter();
const isLogin = computed(() => route.path === '/login' || route.path === '/activate');
const isDev = computed(() => currentUser.value?.role === 'DEV');
const isStaff = computed(() => currentUser.value?.role === 'DEV' || currentUser.value?.role === 'ADMIN');
const roleName = computed(() => {
  const map: Record<string, string> = { DEV: '开发者', ADMIN: '管理员', MEMBER: '成员' };
  return map[currentUser.value?.role ?? ''] ?? '';
});

function logout() {
  clearSession();
  location.href = '/login';
}
</script>

<template>
  <div class="layout">
    <header v-if="currentUser && !isLogin" class="topbar">
      <div class="brand">内部沟通工具</div>
      <nav class="nav">
        <router-link to="/chat" :class="{ active: route.path.startsWith('/chat') }">消息</router-link>
        <router-link to="/friends" :class="{ active: route.path.startsWith('/friends') }">通讯录</router-link>
        <router-link v-if="isStaff" to="/admin/registrations" :class="{ active: route.path.startsWith('/admin/registrations') }">预注册管理</router-link>
        <router-link v-if="isDev" to="/admin/users" :class="{ active: route.path.startsWith('/admin/users') }">成员管理</router-link>
        <router-link to="/profile" :class="{ active: route.path === '/profile' }">我的</router-link>
      </nav>
      <div class="user">
        <span class="name">{{ currentUser.name }}</span>
        <span class="role">{{ roleName }}</span>
        <button class="logout" @click="logout">退出</button>
      </div>
    </header>
    <router-view />
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  background: #f2f4f8;
  color: #0d1326;
  min-height: 100vh;
}
.layout { min-height: 100vh; }
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 24px;
  background: #0d1326;
  color: #fff;
}
.brand { font-weight: 700; font-size: 16px; }
.nav { display: flex; gap: 20px; }
.nav a { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 14px; padding: 4px 2px; }
.nav a.active { color: #fff; border-bottom: 2px solid #bfd7ff; }
.user { display: flex; align-items: center; gap: 12px; font-size: 14px; }
.role { color: #bfd7ff; font-size: 12px; }
.logout {
  border: 1px solid rgba(255,255,255,0.35);
  background: transparent;
  color: #fff;
  padding: 4px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
}
.logout:hover { background: rgba(255,255,255,0.12); }
</style>
