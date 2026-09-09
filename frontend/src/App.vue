<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import { currentUser, clearSession } from './api';

const route = useRoute();
const isLogin = computed(() => route.path === '/login');
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
