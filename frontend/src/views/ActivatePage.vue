<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { request, saveSession, type UserInfo } from '../api';

const route = useRoute();
const router = useRouter();

const token = (route.query.token as string) ?? '';
const password = ref('');
const confirm = ref('');
const loading = ref(false);
const error = ref('');
const done = ref(false);

async function submit() {
  error.value = '';
  if (password.value.length < 8) {
    error.value = '密码至少 8 位';
    return;
  }
  if (password.value !== confirm.value) {
    error.value = '两次输入的密码不一致';
    return;
  }
  loading.value = true;
  try {
    const data = await request<{ token: string; user: UserInfo }>('/api/auth/activate', {
      method: 'POST',
      body: JSON.stringify({ token, password: password.value }),
    });
    saveSession(data.token, data.user);
    done.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '激活失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="auth-wrap">
    <div class="card">
      <template v-if="!done">
        <h1>激活账号</h1>
        <p class="sub">设置登录密码，激活后即可使用</p>
        <form @submit.prevent="submit">
          <label>新密码</label>
          <input v-model="password" type="password" placeholder="至少 8 位" autocomplete="new-password" />
          <label>确认密码</label>
          <input v-model="confirm" type="password" placeholder="再输入一次" autocomplete="new-password" />
          <p v-if="error" class="error">{{ error }}</p>
          <button type="submit" :disabled="loading">{{ loading ? '激活中…' : '激活并登录' }}</button>
        </form>
      </template>
      <template v-else>
        <h1>激活成功 🎉</h1>
        <p class="sub">账号已开通，正在进入系统…</p>
        <button @click="router.replace('/chat')">进入系统</button>
      </template>
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
