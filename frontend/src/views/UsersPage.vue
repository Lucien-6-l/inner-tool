<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { request, currentUser, colorForName } from '../api';

interface Member {
  id: string;
  email: string;
  name: string;
  phone: string;
  department: string;
  role: 'DEV' | 'ADMIN' | 'MEMBER';
  isActive: boolean;
  createdAt: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

const list = ref<Member[]>([]);
const loading = ref(false);
const error = ref('');
const busyId = ref<string | null>(null);
const editingId = ref<string | null>(null);
const editForm = ref({ name: '', phone: '', department: '' });
const maxAdmins = ref(5);
const adminCount = ref(0);

const roleLabel: Record<string, string> = { DEV: '开发者', ADMIN: '管理员', MEMBER: '成员' };
const isDev = currentUser.value?.role === 'DEV';
const isAdmin = currentUser.value?.role === 'ADMIN';

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await request<{ list: Member[]; maxAdmins: number; adminCount: number }>('/api/admin/users');
    list.value = data.list;
    maxAdmins.value = data.maxAdmins;
    adminCount.value = data.adminCount;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function setRole(m: Member, role: 'ADMIN' | 'MEMBER') {
  busyId.value = m.id;
  try {
    await request(`/api/admin/users/${m.id}/role`, { method: 'POST', body: JSON.stringify({ role }) });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败';
  } finally {
    busyId.value = null;
  }
}

function startEdit(m: Member) {
  editingId.value = m.id;
  editForm.value = { name: m.name, phone: m.phone, department: m.department };
}

async function saveEdit(m: Member) {
  busyId.value = m.id;
  try {
    await request(`/api/admin/users/${m.id}`, { method: 'PATCH', body: JSON.stringify(editForm.value) });
    editingId.value = null;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
  } finally {
    busyId.value = null;
  }
}

// 删除成员（开发者可删管理员/成员；管理员只能删成员）
function canDelete(m: Member): boolean {
  if (m.role === 'DEV') return false;
  if (isAdmin) return m.role === 'MEMBER';
  return true;
}

async function deleteMember(m: Member) {
  const msg = `确定删除成员「${m.name}」吗？\n\n删除后：\n· 该账号将无法登录\n· 好友关系、会话成员资格、其发起的抽奖将被移除\n· 聊天消息历史会保留（显示为"已注销"）\n\n此操作不可恢复！`;
  if (!window.confirm(msg)) return;
  busyId.value = m.id;
  error.value = '';
  try {
    await request(`/api/admin/users/${m.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败';
  } finally {
    busyId.value = null;
  }
}

onMounted(load);
</script>

<template>
  <main class="page">
    <h2>成员管理</h2>
    <p class="hint">{{ isDev ? '开发者可设置 / 撤销管理员、修改成员信息、删除成员；管理员可删除普通成员。' : '管理员可查看成员列表并删除普通成员；开发者账号不可被删除。' }}</p>
    <p class="hint strong">管理员：{{ adminCount }} / {{ maxAdmins }} 人</p>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="muted">加载中…</p>

    <section v-else class="card">
      <table>
        <thead>
          <tr>
            <th>成员</th>
            <th>邮箱</th>
            <th>手机号</th>
            <th>部门</th>
            <th>角色</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in list" :key="m.id">
            <template v-if="editingId === m.id">
              <td>
                <span class="avatar-c sm" :style="{ background: colorForName(m.name) }">
                  <img v-if="m.avatarUrl" :src="m.avatarUrl" alt="" />
                  <template v-else>{{ m.name.trim().slice(0, 1) }}</template>
                </span>
                <input v-model="editForm.name" class="cell-input" />
              </td>
              <td>{{ m.email }}</td>
              <td><input v-model="editForm.phone" class="cell-input" /></td>
              <td><input v-model="editForm.department" class="cell-input" /></td>
              <td>{{ roleLabel[m.role] }}</td>
              <td>
                <button class="btn btn-primary sm" :disabled="busyId === m.id" @click="saveEdit(m)">保存</button>
                <button class="btn btn-ghost sm" @click="editingId = null">取消</button>
              </td>
            </template>
            <template v-else>
              <td class="member-cell">
                <span class="avatar-c sm" :style="{ background: colorForName(m.name) }">
                  <img v-if="m.avatarUrl" :src="m.avatarUrl" alt="" />
                  <template v-else>{{ m.name.trim().slice(0, 1) }}</template>
                </span>
                <div class="member-meta">
                  <span class="m-name">{{ m.name }}</span>
                  <span v-if="m.bio" class="m-bio">{{ m.bio }}</span>
                </div>
              </td>
              <td>{{ m.email }}</td>
              <td>{{ m.phone }}</td>
              <td>{{ m.department }}</td>
              <td><span class="tag" :class="'role-' + m.role">{{ roleLabel[m.role] }}</span></td>
              <td>
                <template v-if="m.role !== 'DEV'">
                  <template v-if="isDev">
                    <button v-if="m.role === 'MEMBER'" class="btn btn-primary sm" :disabled="busyId === m.id || adminCount >= maxAdmins" :title="adminCount >= maxAdmins ? `管理员已达上限 ${maxAdmins} 人` : ''" @click="setRole(m, 'ADMIN')">设为管理员</button>
                    <button v-else class="btn btn-danger sm" :disabled="busyId === m.id" @click="setRole(m, 'MEMBER')">撤销管理员</button>
                    <button class="btn btn-ghost sm" :disabled="busyId === m.id" @click="startEdit(m)">编辑</button>
                  </template>
                  <button v-if="canDelete(m)" class="btn btn-danger sm" :disabled="busyId === m.id" @click="deleteMember(m)">删除</button>
                </template>
                <span v-else class="muted">—</span>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 1080px; margin: 0 auto; padding: 32px 24px; }
h2 { font-size: 22px; color: var(--text); }
.hint { color: var(--muted); font-size: 13px; margin: 6px 0 20px; }
.hint.strong { color: var(--primary-dark); font-weight: 700; margin-top: -14px; }
.card { background: var(--card); border-radius: 16px; padding: 20px 24px; box-shadow: var(--shadow); border: 1px solid var(--border); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: 600; }
.member-cell { display: flex; align-items: center; gap: 10px; }
.member-meta { display: flex; flex-direction: column; }
.m-name { font-weight: 600; }
.m-bio { color: var(--muted); font-size: 11px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.avatar-c.sm { width: 34px; height: 34px; font-size: 14px; }
.tag { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.role-DEV { background: #2d2a5c; color: #fff; }
.role-ADMIN { background: #e4dfff; color: #6c5ce7; }
.role-MEMBER { background: #eef5ff; color: #4a6fa5; }
.btn { height: 30px; padding: 0 12px; border-radius: 8px; margin-right: 6px; font-size: 13px; }
.btn.sm { height: 30px; padding: 0 12px; margin-right: 6px; }
button:disabled { opacity: 0.55; }
.cell-input { height: 30px; border: 1.5px solid var(--border); border-radius: 8px; padding: 0 8px; font-size: 13px; }
.error { color: var(--coral); font-size: 13px; margin-bottom: 10px; }
.muted { color: var(--muted); font-size: 13px; }
</style>
