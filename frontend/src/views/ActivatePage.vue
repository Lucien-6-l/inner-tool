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
        <button @click="router.replace('/admin/registrations')">进入系统</button>
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
