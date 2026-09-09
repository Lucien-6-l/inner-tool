<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { request, currentUser } from '../api';

interface Friend {
  id: string;
  email: string;
  name: string;
  phone: string;
  department: string;
  role: 'DEV' | 'ADMIN' | 'MEMBER';
}

const list = ref<Friend[]>([]);
const loading = ref(false);
const error = ref('');
const keyword = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await request<{ list: Friend[] }>('/api/friends');
    list.value = data.list;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

const grouped = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  const filtered = kw
    ? list.value.filter((f) => f.name.toLowerCase().includes(kw) || f.email.toLowerCase().includes(kw))
    : list.value;
  const map = new Map<string, Friend[]>();
  for (const f of filtered) {
    const arr = map.get(f.department) ?? [];
    arr.push(f);
    map.set(f.department, arr);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh'));
});

function initials(name: string): string {
  return name.trim().slice(0, 1) || '?';
}

onMounted(load);
</script>

<template>
  <main class="page">
    <h2>通讯录</h2>
    <p class="hint">同部门同事自动互为好友。当前部门：{{ currentUser?.department }}，共 {{ list.length }} 位同事</p>

    <input v-model="keyword" class="search" placeholder="搜索姓名或邮箱…" />

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="list.length === 0" class="muted">暂无好友</p>

    <section v-for="[dept, members] in grouped" :key="dept" class="group">
      <h3>{{ dept }} <span class="count">{{ members.length }}</span></h3>
      <div class="member" v-for="m in members" :key="m.id">
        <span class="avatar">{{ initials(m.name) }}</span>
        <div class="meta">
          <div class="name-line">
            <span class="name">{{ m.name }}</span>
            <span v-if="m.role !== 'MEMBER'" class="tag">{{ m.role === 'DEV' ? '开发者' : '管理员' }}</span>
          </div>
          <div class="sub">{{ m.email }}</div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
h2 { font-size: 22px; }
.hint { color: #536174; font-size: 13px; margin: 6px 0 16px; }
.search {
  width: 100%;
  height: 38px;
  border: 1px solid #d3dae6;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  margin-bottom: 20px;
}
.search:focus { border-color: #2563eb; }
.group { margin-bottom: 22px; }
.group h3 { font-size: 14px; color: #536174; margin-bottom: 10px; }
.count { color: #8a93a6; font-weight: 400; }
.member {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #fff;
  border-radius: 10px;
  margin-bottom: 8px;
  box-shadow: 0 2px 8px rgba(13,19,38,0.05);
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #0d1326;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.meta { min-width: 0; }
.name-line { display: flex; align-items: center; gap: 8px; }
.name { font-size: 15px; font-weight: 600; }
.tag { background: #bfd7ff; color: #1e4bb3; font-size: 11px; padding: 1px 8px; border-radius: 999px; }
.sub { color: #8a93a6; font-size: 12px; margin-top: 2px; }
.error { color: #b3343a; font-size: 13px; }
.muted { color: #8a93a6; font-size: 13px; }
</style>
