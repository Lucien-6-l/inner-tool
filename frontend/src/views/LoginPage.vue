<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { request, saveSession, type UserInfo } from '../api';

const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  if (!email.value || !password.value) {
    error.value = '请输入邮箱和密码';
    return;
  }
  loading.value = true;
  try {
    const data = await request<{ token: string; user: UserInfo }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.value, password: password.value }),
    });
    saveSession(data.token, data.user);
    const redirect = (route.query.redirect as string) || '/chat';
    router.replace(redirect);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="auth-wrap">
    <div class="card">
      <h1>💬 公司内部沟通工具</h1>
      <p class="sub">使用公司邮箱登录</p>
      <form @submit.prevent="submit">
        <label>邮箱</label>
        <input v-model="email" type="email" placeholder="name@qq.com" autocomplete="username" />
        <label>密码</label>
        <input v-model="password" type="password" placeholder="请输入密码" autocomplete="current-password" />
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button>
      </form>
    </div>
  </main>
</template>

<style scoped>
.auth-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 40%, #00cec9 100%);
}
.card {
  width: 380px;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 20px;
  padding: 36px 30px;
  box-shadow: 0 20px 60px rgba(45, 42, 92, 0.3);
  backdrop-filter: blur(8px);
}
h1 { font-size: 20px; text-align: center; color: var(--primary-dark); }
.sub { color: var(--muted); font-size: 13px; text-align: center; margin: 6px 0 24px; }
label { display: block; font-size: 13px; color: var(--muted); margin: 14px 0 6px; }
input {
  width: 100%;
  height: 42px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
input:focus { border-color: var(--primary); }
button {
  width: 100%;
  height: 44px;
  margin-top: 22px;
  border: none;
  border-radius: 12px;
  background: var(--grad-main);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(108, 92, 231, 0.35);
  transition: filter 0.2s;
}
button:hover { filter: brightness(1.06); }
button:disabled { opacity: 0.55; }
.error { color: var(--coral); font-size: 13px; margin-top: 10px; }
</style>
