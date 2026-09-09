<script setup lang="ts">
import { ref } from 'vue';
import { request, currentUser } from '../api';

const oldPassword = ref('');
const newPassword = ref('');
const confirm = ref('');
const loading = ref(false);
const error = ref('');
const ok = ref('');

async function submit() {
  error.value = '';
  ok.value = '';
  if (!oldPassword.value || !newPassword.value) {
    error.value = '请填写原密码和新密码';
    return;
  }
  if (newPassword.value.length < 8) {
    error.value = '新密码至少 8 位';
    return;
  }
  if (newPassword.value !== confirm.value) {
    error.value = '两次输入的新密码不一致';
    return;
  }
  loading.value = true;
  try {
    await request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword: oldPassword.value, newPassword: newPassword.value }),
    });
    ok.value = '密码已更新';
    oldPassword.value = '';
    newPassword.value = '';
    confirm.value = '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : '修改失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="page">
    <h2>我的</h2>
    <section class="card">
      <h3>账号信息</h3>
      <dl class="info">
        <div><dt>姓名</dt><dd>{{ currentUser?.name }}</dd></div>
        <div><dt>邮箱</dt><dd>{{ currentUser?.email }}</dd></div>
        <div><dt>手机号</dt><dd>{{ currentUser?.phone }}</dd></div>
        <div><dt>部门</dt><dd>{{ currentUser?.department }}</dd></div>
        <div><dt>角色</dt><dd>{{ currentUser?.role === 'DEV' ? '开发者' : currentUser?.role === 'ADMIN' ? '管理员' : '成员' }}</dd></div>
      </dl>
    </section>

    <section class="card">
      <h3>修改密码</h3>
      <form @submit.prevent="submit">
        <label>原密码</label>
        <input v-model="oldPassword" type="password" autocomplete="current-password" />
        <label>新密码</label>
        <input v-model="newPassword" type="password" placeholder="至少 8 位" autocomplete="new-password" />
        <label>确认新密码</label>
        <input v-model="confirm" type="password" autocomplete="new-password" />
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="ok" class="ok">{{ ok }}</p>
        <button type="submit" :disabled="loading">{{ loading ? '保存中…' : '保存' }}</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
h2 { font-size: 22px; }
.card { background: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(13,19,38,0.06); }
h3 { font-size: 15px; margin-bottom: 14px; }
.info div { display: flex; padding: 8px 0; border-bottom: 1px solid #eef1f6; font-size: 14px; }
.info dt { width: 80px; color: #536174; }
.info dd { flex: 1; }
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
  height: 42px;
  padding: 0 24px;
  margin-top: 18px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
button:disabled { opacity: 0.6; }
.error { color: #b3343a; font-size: 13px; margin-top: 10px; }
.ok { color: #0f6b3a; font-size: 13px; margin-top: 10px; }
</style>
