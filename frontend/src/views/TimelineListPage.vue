<template>
  <div class="page">
    <div class="header">
      <h2>项目时间线</h2>
      <button class="btn btn-primary" @click="showCreate = true">＋ 新建项目</button>
    </div>
    <p class="hint">每个项目有一条共有的主线和每人的个人分支，文件汇入主线需全体参与者超过 2/3 赞成。</p>

    <div v-if="loading" class="muted">加载中…</div>
    <div v-else-if="!list.length" class="empty">
      <p>还没有项目时间线</p>
      <button class="btn btn-primary" @click="showCreate = true">创建第一个项目</button>
    </div>
    <div v-else class="grid">
      <router-link v-for="tl in list" :key="tl.id" :to="`/timelines/${tl.id}`" class="card">
        <div class="card-head">
          <span class="avatar-c" :style="{ background: colorForName(tl.name) }">{{ tl.name.trim().slice(0, 1) }}</span>
          <div class="card-title">
            <div class="name">{{ tl.name }}</div>
            <div class="sub">发起人：{{ tl.creator?.name }}</div>
          </div>
        </div>
        <div v-if="tl.description" class="desc">{{ tl.description }}</div>
        <div class="stats">
          <span>👥 {{ tl._count?.participants || 0 }} 参与者</span>
          <span>🌿 {{ tl._count?.branches || 0 }} 分支</span>
          <span>📥 {{ tl._count?.mergeRequests || 0 }} 汇入</span>
        </div>
      </router-link>
    </div>

    <!-- 创建弹窗 -->
    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="modal">
        <h3>新建项目时间线</h3>
        <label>项目名称 *</label>
        <input v-model="form.name" placeholder="例如：新产品研发" />
        <label>项目描述</label>
        <textarea v-model="form.description" placeholder="可选，简要说明项目目标" rows="3"></textarea>
        <label>添加参与者（可后续添加）</label>
        <div class="user-picker">
          <label v-for="u in allUsers" :key="u.id" class="user-check">
            <input type="checkbox" :value="u.id" v-model="form.participantIds" />
            <span class="avatar-c sm" :style="{ background: colorForName(u.name) }">{{ u.name.trim().slice(0,1) }}</span>
            <span>{{ u.name }}</span>
          </label>
        </div>
        <div v-if="error" class="error">{{ error }}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showCreate = false">取消</button>
          <button class="btn btn-primary" :disabled="creating" @click="doCreate">{{ creating ? '创建中…' : '创建' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getTimelines, createTimeline, type Timeline } from '../timelineApi';
import { request, currentUser, colorForName } from '../api';

const list = ref<Timeline[]>([]);
const loading = ref(true);
const showCreate = ref(false);
const creating = ref(false);
const error = ref('');
const allUsers = ref<{ id: string; name: string; email: string }[]>([]);
const form = ref({ name: '', description: '', participantIds: [] as string[] });

async function load() {
  loading.value = true;
  try {
    const d = await getTimelines();
    list.value = d.list;
  } finally {
    loading.value = false;
  }
}

async function loadUsers() {
  try {
    // 开发者可见全部成员；普通成员通过通讯录接口获取好友列表
    if (currentUser.value?.role === 'DEV') {
      const d = await request<{ list: { id: string; name: string; email: string }[] }>('/api/admin/users');
      allUsers.value = d.list.filter((u) => u.id !== currentUser.value?.id);
    } else {
      const d = await request<{ friends: { id: string; name: string; email: string }[] }>('/api/friends');
      allUsers.value = d.friends;
    }
  } catch { /* 忽略，用户可后续添加 */ }
}

async function doCreate() {
  if (!form.value.name.trim()) { error.value = '请输入项目名称'; return; }
  creating.value = true;
  error.value = '';
  try {
    await createTimeline({ name: form.value.name, description: form.value.description, participantIds: form.value.participantIds });
    showCreate.value = false;
    form.value = { name: '', description: '', participantIds: [] };
    await load();
  } catch (e: any) {
    error.value = e.message || '创建失败';
  } finally {
    creating.value = false;
  }
}

onMounted(() => { load(); loadUsers(); });
</script>

<style scoped>
.page { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
.header { display: flex; justify-content: space-between; align-items: center; }
h2 { font-size: 22px; color: var(--text); }
.hint { color: var(--muted); font-size: 13px; margin: 6px 0 20px; }
.btn { height: 38px; padding: 0 16px; border-radius: 10px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.card {
  background: var(--card); border-radius: 16px; padding: 18px;
  box-shadow: var(--shadow); border: 1px solid var(--border);
  text-decoration: none; color: inherit; transition: transform 0.15s, box-shadow 0.15s;
}
.card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(108,92,231,0.15); }
.card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.avatar-c { width: 42px; height: 42px; font-size: 17px; }
.avatar-c.sm { width: 26px; height: 26px; font-size: 12px; }
.card-title .name { font-size: 16px; font-weight: 600; }
.card-title .sub { font-size: 12px; color: var(--muted); }
.desc { font-size: 13px; color: var(--muted); margin-bottom: 12px; line-height: 1.5; }
.stats { display: flex; gap: 14px; font-size: 12px; color: var(--muted); flex-wrap: wrap; }
.empty { text-align: center; padding: 60px 20px; color: var(--muted); }
.empty p { margin-bottom: 16px; }
.muted { color: var(--muted); }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: var(--card); border-radius: 16px; padding: 24px; width: 440px; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
.modal h3 { font-size: 18px; margin-bottom: 16px; color: var(--primary-dark); }
.modal label { display: block; font-size: 13px; color: var(--muted); margin: 12px 0 6px; }
.modal input, .modal textarea {
  width: 100%; box-sizing: border-box; border: 1.5px solid var(--border); border-radius: 10px;
  padding: 8px 12px; font-size: 14px; outline: none; font-family: inherit;
}
.modal input:focus, .modal textarea:focus { border-color: var(--primary); }
.user-picker { max-height: 160px; overflow-y: auto; border: 1px solid var(--border); border-radius: 10px; padding: 8px; }
.user-check { display: flex; align-items: center; gap: 8px; padding: 6px 4px; cursor: pointer; font-size: 13px; }
.user-check:hover { background: var(--bg); border-radius: 6px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.error { color: var(--coral); font-size: 13px; margin-top: 10px; }
</style>
