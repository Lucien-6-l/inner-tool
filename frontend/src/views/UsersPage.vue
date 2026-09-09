<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { request } from '../api';

interface Member {
  id: string;
  email: string;
  name: string;
  phone: string;
  department: string;
  role: 'DEV' | 'ADMIN' | 'MEMBER';
  isActive: boolean;
  createdAt: string;
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

onMounted(load);
</script>

<template>
  <main class="page">
    <h2>成员管理</h2>
    <p class="hint">开发者可设置 / 撤销管理员，并可修改成员信息。开发者账号本身不可被修改。</p>
    <p class="hint strong">管理员：{{ adminCount }} / {{ maxAdmins }} 人</p>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="muted">加载中…</p>

    <section v-else class="card">
      <table>
        <thead>
          <tr>
            <th>姓名</th>
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
              <td><input v-model="editForm.name" class="cell-input" /></td>
              <td>{{ m.email }}</td>
              <td><input v-model="editForm.phone" class="cell-input" /></td>
              <td><input v-model="editForm.department" class="cell-input" /></td>
              <td>{{ roleLabel[m.role] }}</td>
              <td>
                <button class="primary small" :disabled="busyId === m.id" @click="saveEdit(m)">保存</button>
                <button class="ghost small" @click="editingId = null">取消</button>
              </td>
            </template>
            <template v-else>
              <td>{{ m.name }}</td>
              <td>{{ m.email }}</td>
              <td>{{ m.phone }}</td>
              <td>{{ m.department }}</td>
              <td><span class="tag" :class="'role-' + m.role">{{ roleLabel[m.role] }}</span></td>
              <td>
                <template v-if="m.role !== 'DEV'">
                  <button v-if="m.role === 'MEMBER'" class="primary small" :disabled="busyId === m.id || adminCount >= maxAdmins" :title="adminCount >= maxAdmins ? `管理员已达上限 ${maxAdmins} 人` : ''" @click="setRole(m, 'ADMIN')">设为管理员</button>
                  <button v-else class="danger small" :disabled="busyId === m.id" @click="setRole(m, 'MEMBER')">撤销管理员</button>
                  <button class="ghost small" @click="startEdit(m)">编辑</button>
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
.page { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
h2 { font-size: 22px; }
.hint { color: #536174; font-size: 13px; margin: 6px 0 20px; }
.hint.strong { color: #0d1326; font-weight: 700; margin-top: -14px; }
.card { background: #fff; border-radius: 12px; padding: 20px 24px; box-shadow: 0 4px 16px rgba(13,19,38,0.06); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #eef1f6; }
th { color: #536174; font-weight: 600; }
.tag { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.role-DEV { background: #0d1326; color: #fff; }
.role-ADMIN { background: #bfd7ff; color: #1e4bb3; }
.role-MEMBER { background: #e5e9f0; color: #536174; }
.primary { background: #2563eb; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; }
.primary.small, .ghost.small, .danger.small { height: 30px; padding: 0 12px; margin-right: 6px; }
.ghost { background: #fff; color: #536174; border: 1px solid #d3dae6; border-radius: 8px; cursor: pointer; font-size: 13px; }
.danger { background: #fff; color: #b3343a; border: 1px solid #f0c9cb; border-radius: 8px; cursor: pointer; font-size: 13px; }
button:disabled { opacity: 0.6; }
.cell-input { height: 30px; border: 1px solid #d3dae6; border-radius: 6px; padding: 0 8px; font-size: 13px; }
.error { color: #b3343a; font-size: 13px; margin-bottom: 10px; }
.muted { color: #8a93a6; font-size: 13px; }
</style>
