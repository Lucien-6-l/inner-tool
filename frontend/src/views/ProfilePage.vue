<script setup lang="ts">
import { ref, computed } from 'vue';
import { request, currentUser, patchLocalUser, colorForName, type UserInfo } from '../api';

const oldPassword = ref('');
const newPassword = ref('');
const confirm = ref('');
const loading = ref(false);
const error = ref('');
const ok = ref('');

// ===== 个人资料：头像 + 个性标签 =====
const avatarUrl = ref(currentUser.value?.avatarUrl ?? '');
const bio = ref(currentUser.value?.bio ?? '');
const avatarInput = ref<HTMLInputElement | null>(null);
const savingProfile = ref(false);
const profileError = ref('');
const profileOk = ref('');

const avatarText = computed(() => (currentUser.value?.name || '?').trim().slice(0, 1));
const avatarColor = computed(() => colorForName(currentUser.value?.name ?? '?'));

async function pickAvatar() {
  avatarInput.value?.click();
}

async function onAvatarChosen(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || savingProfile.value) return;
  if (!file.type.startsWith('image/')) {
    profileError.value = '请选择图片文件（jpg / png / gif / webp）';
    return;
  }
  savingProfile.value = true;
  profileError.value = '';
  try {
    const form = new FormData();
    form.append('file', file);
    const up = await request<{ url: string; name: string; size: number }>('/api/upload', {
      method: 'POST',
      body: form,
      form: true,
    });
    avatarUrl.value = up.url;
  } catch (e) {
    profileError.value = e instanceof Error ? e.message : '头像上传失败';
  } finally {
    savingProfile.value = false;
  }
}

function removeAvatar() {
  avatarUrl.value = '';
}

async function saveProfile() {
  savingProfile.value = true;
  profileError.value = '';
  profileOk.value = '';
  try {
    const data = await request<{ user: UserInfo }>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ avatarUrl: avatarUrl.value || null, bio: bio.value }),
    });
    patchLocalUser(data.user);
    profileOk.value = '资料已保存';
  } catch (e) {
    profileError.value = e instanceof Error ? e.message : '保存失败';
  } finally {
    savingProfile.value = false;
  }
}

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
      <h3>个人资料</h3>
      <div class="profile-row">
        <div class="avatar-wrap">
          <img v-if="avatarUrl" :src="avatarUrl" class="avatar-img" alt="头像" />
          <span v-else class="avatar-img text" :style="{ background: avatarColor }">{{ avatarText }}</span>
        </div>
        <div class="avatar-actions">
          <input ref="avatarInput" type="file" accept="image/*" class="hidden" @change="onAvatarChosen" />
          <button class="btn btn-ghost" :disabled="savingProfile" @click="pickAvatar">
            {{ savingProfile ? '上传中…' : '更换头像' }}
          </button>
          <button v-if="avatarUrl" class="btn btn-danger" :disabled="savingProfile" @click="removeAvatar">移除头像</button>
          <p class="tip">支持 jpg / png / gif / webp，建议正方形图片</p>
        </div>
      </div>
      <label>个性标签</label>
      <input v-model="bio" class="input" maxlength="30" placeholder="一句话介绍自己，如：前端工程师 / 咖啡爱好者" />
      <p class="tip">最多 30 个字，将展示在通讯录与群聊中</p>
      <p v-if="profileError" class="error">{{ profileError }}</p>
      <p v-if="profileOk" class="ok">{{ profileOk }}</p>
      <button class="btn btn-primary save-btn" :disabled="savingProfile" @click="saveProfile">
        {{ savingProfile ? '保存中…' : '保存资料' }}
      </button>
    </section>

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
        <input v-model="oldPassword" type="password" autocomplete="current-password" class="input" />
        <label>新密码</label>
        <input v-model="newPassword" type="password" placeholder="至少 8 位" autocomplete="new-password" class="input" />
        <label>确认新密码</label>
        <input v-model="confirm" type="password" autocomplete="new-password" class="input" />
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="ok" class="ok">{{ ok }}</p>
        <button type="submit" class="btn btn-primary save-btn" :disabled="loading">{{ loading ? '保存中…' : '保存' }}</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
h2 { font-size: 22px; color: var(--text); }
.card { background: var(--card); border-radius: 16px; padding: 22px 26px; margin-bottom: 20px; box-shadow: var(--shadow); border: 1px solid var(--border); }
h3 { font-size: 15px; margin-bottom: 16px; color: var(--primary-dark); }
.profile-row { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; }
.avatar-wrap { flex-shrink: 0; }
.avatar-img {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #fff;
  box-shadow: 0 4px 14px rgba(108, 92, 231, 0.25);
  display: block;
}
.avatar-img.text {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 34px;
  font-weight: 700;
}
.avatar-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.tip { color: var(--muted); font-size: 12px; margin-top: 4px; }
.input {
  width: 100%;
  height: 42px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 0 14px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.input:focus { border-color: var(--primary); }
label { display: block; font-size: 13px; color: var(--muted); margin: 14px 0 6px; }
.info div { display: flex; padding: 9px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.info dt { width: 80px; color: var(--muted); }
.info dd { flex: 1; }
.save-btn { height: 42px; padding: 0 26px; margin-top: 16px; }
.hidden { display: none; }
.error { color: var(--coral); font-size: 13px; margin-top: 10px; }
.ok { color: #0f9d6e; font-size: 13px; margin-top: 10px; }
</style>
