<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { computed } from 'vue';
import { currentUser, clearSession, colorForName } from './api';

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
      <div class="brand">💬 内部沟通工具</div>
      <nav class="nav">
        <router-link to="/chat" :class="{ active: route.path.startsWith('/chat') }">消息</router-link>
        <router-link to="/friends" :class="{ active: route.path.startsWith('/friends') }">通讯录</router-link>
        <router-link to="/timelines" :class="{ active: route.path.startsWith('/timelines') }">时间线</router-link>
        <router-link v-if="isStaff" to="/admin/registrations" :class="{ active: route.path.startsWith('/admin/registrations') }">预注册管理</router-link>
        <router-link v-if="isStaff" to="/admin/users" :class="{ active: route.path.startsWith('/admin/users') }">成员管理</router-link>
        <router-link to="/profile" :class="{ active: route.path === '/profile' }">我的</router-link>
      </nav>
      <div class="user">
        <img v-if="currentUser.avatarUrl" :src="currentUser.avatarUrl" class="top-avatar" alt="头像" />
        <span v-else class="top-avatar text" :style="{ background: colorForName(currentUser.name) }">{{ (currentUser.name || '?').trim().slice(0, 1) }}</span>
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
:root {
  --primary: #6c5ce7;
  --primary-dark: #5a4bd1;
  --primary-2: #a29bfe;
  --accent: #00cec9;
  --pink: #ff6b9d;
  --coral: #ff7675;
  --sun: #fdcb6e;
  --bg: #f6f5ff;
  --card: #ffffff;
  --border: #e6e3fb;
  --text: #2d2a5c;
  --muted: #8b87b8;
  --grad-main: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 60%, #00cec9 130%);
  --grad-pink: linear-gradient(135deg, #ff6b9d, #ff7675);
  --grad-sun: linear-gradient(135deg, #fdcb6e, #ff9f43);
  --shadow: 0 8px 24px rgba(108, 92, 231, 0.12);
  --shadow-sm: 0 2px 10px rgba(108, 92, 231, 0.08);
}
body {
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  background: linear-gradient(160deg, #f3f1ff 0%, #eff9ff 55%, #fff3f8 100%);
  background-attachment: fixed;
  color: var(--text);
  min-height: 100vh;
}
.layout { min-height: 100vh; }
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 58px;
  padding: 0 24px;
  background: var(--grad-main);
  color: #fff;
  box-shadow: 0 2px 12px rgba(108, 92, 231, 0.25);
}
.brand { font-weight: 700; font-size: 16px; letter-spacing: 0.5px; }
.nav { display: flex; gap: 22px; }
.nav a {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  font-size: 14px;
  padding: 6px 2px;
  border-radius: 999px;
  transition: all 0.2s;
}
.nav a:hover { color: #fff; background: rgba(255, 255, 255, 0.15); padding: 6px 10px; }
.nav a.active { color: #fff; font-weight: 700; background: rgba(255, 255, 255, 0.22); padding: 6px 10px; }
.user { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.top-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
}
.top-avatar.text {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}
.name { font-weight: 600; }
.role {
  background: rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
}
.logout {
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: transparent;
  color: #fff;
  padding: 4px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.logout:hover { background: rgba(255, 255, 255, 0.2); }

/* 全局通用：彩色首字母头像 */
.avatar-c {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-weight: 700;
  flex-shrink: 0;
  object-fit: cover;
  overflow: hidden;
}
.avatar-c img { width: 100%; height: 100%; object-fit: cover; }

/* 全局通用：主按钮 / 幽灵按钮 / 危险按钮 */
.btn { border: none; border-radius: 10px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
.btn-primary { background: var(--grad-main); color: #fff; box-shadow: 0 4px 12px rgba(108, 92, 231, 0.3); }
.btn-primary:hover { filter: brightness(1.08); }
.btn-primary:disabled { opacity: 0.55; }
.btn-ghost { background: #fff; color: var(--primary); border: 1.5px solid var(--primary-2); }
.btn-ghost:hover { border-color: var(--primary); background: #f4f1ff; }
.btn-danger { background: #fff; color: var(--coral); border: 1.5px solid #ffd4d2; }
.btn-danger:hover { background: #fff0f0; border-color: var(--coral); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
</style>
