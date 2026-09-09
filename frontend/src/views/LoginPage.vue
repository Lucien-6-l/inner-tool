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
    const redirect = (route.query.redirect as string) || '/admin/registrations';
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
      <h1>公司内部沟通工具</h1>
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
  min-height: calc(100vh - 56px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.card {
  width: 360px;
  background: #fff;
  border-radius: 12px;
  padding: 32px 28px;
  box-shadow: 0 8px 30px rgba(13,19,38,0.08);
}
h1 { font-size: 20px; text-align: center; }
.sub { color: #536174; font-size: 13px; text-align: center; margin: 6px 0 22px; }
label { display: block; font-size: 13px; color: #536174; margin: 12px 0 4px; }
input {
  width: 100%;
  height: 40px;
  border: 1px solid #d3dae6;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
}
input:focus { border-color: #2563eb; }
button {
  width: 100%;
  height: 42px;
  margin-top: 20px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-size: 15px;
  cursor: pointer;
}
button:disabled { opacity: 0.6; }
.error { color: #b3343a; font-size: 13px; margin-top: 10px; }
</style>
