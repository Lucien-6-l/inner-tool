<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { request, currentUser } from '../api';

interface Registration {
  id: string;
  email: string;
  phone: string;
  name: string;
  department: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  source: 'DEV' | 'ADMIN';
  rejectReason: string | null;
  createdAt: string;
  createdBy?: { name: string; email: string };
}

const list = ref<Registration[]>([]);
const loading = ref(false);
const error = ref('');

// 录入表单
const form = ref({ email: '', phone: '', name: '', department: '' });
const submitting = ref(false);
const formError = ref('');
const formOk = ref('');

// 审批
const reviewingId = ref<string | null>(null);
const rejectReason = ref('');

// 重发/删除
const actionId = ref<string | null>(null);
const actionMsg = ref('');

const isDev = computed(() => currentUser.value?.role === 'DEV');
const isAdmin = computed(() => currentUser.value?.role === 'ADMIN');

// 判断当前用户是否可以操作该记录
function canOperate(r: Registration): boolean {
  if (isDev.value) return true;
  // 管理员只能操作自己提交的记录
  return r.createdBy?.email === currentUser.value?.email;
}

const statusLabel: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
};
const statusClass: Record<string, string> = {
  PENDING: 'st-pending',
  APPROVED: 'st-approved',
  REJECTED: 'st-rejected',
};
const sourceLabel: Record<string, string> = { DEV: '开发者录入', ADMIN: '管理员提交' };

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await request<{ list: Registration[] }>('/api/admin/registrations');
    list.value = data.list;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function submitReg() {
  formError.value = '';
  formOk.value = '';
  const f = form.value;
  if (!f.email || !f.phone || !f.name || !f.department) {
    formError.value = '请完整填写邮箱、手机号、姓名、部门';
    return;
  }
  submitting.value = true;
  try {
    const data = await request<{ registration: Registration; note: string }>('/api/admin/registrations', {
      method: 'POST',
      body: JSON.stringify(f),
    });
    formOk.value = data.note;
    form.value = { email: '', phone: '', name: '', department: '' };
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '录入失败';
  } finally {
    submitting.value = false;
  }
}

async function review(id: string, action: 'approve' | 'reject') {
  reviewingId.value = id;
  try {
    await request(`/api/admin/registrations/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(action === 'reject' ? { action, rejectReason: rejectReason.value } : { action }),
    });
    rejectReason.value = '';
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败';
  } finally {
    reviewingId.value = null;
  }
}

async function resend(id: string) {
  actionId.value = id;
  actionMsg.value = '';
  try {
    const data = await request<{ delivered: boolean; message: string }>(`/api/admin/registrations/${id}/resend`, {
      method: 'POST',
    });
    actionMsg.value = data.message;
    setTimeout(() => { actionMsg.value = ''; }, 3000);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '重发失败';
  } finally {
    actionId.value = null;
  }
}

async function remove(id: string, name: string) {
  if (!confirm(`确定要删除预注册记录「${name}」吗？此操作不可恢复。`)) return;
  actionId.value = id;
  try {
    await request(`/api/admin/registrations/${id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败';
  } finally {
    actionId.value = null;
  }
}

onMounted(load);
</script>

<template>
  <main class="page">
    <h2>预注册名单管理</h2>
    <p class="hint">
      {{ isDev ? '开发者可直接录入（自动通过并发送激活邮件），也可审批管理员提交的名单。' : '管理员可提交名单，等待开发者审批。' }}
    </p>

    <section class="card">
      <h3>录入 / 提交名单</h3>
      <div class="form-grid">
        <input v-model="form.email" placeholder="邮箱（QQ 邮箱为主）" />
        <input v-model="form.phone" placeholder="手机号" />
        <input v-model="form.name" placeholder="真实姓名" />
        <input v-model="form.department" placeholder="部门（如：研发部）" />
        <button class="btn btn-primary" :disabled="submitting" @click="submitReg">
          {{ isDev ? '录入并发送激活' : '提交等待审批' }}
        </button>
      </div>
      <p v-if="formError" class="error">{{ formError }}</p>
      <p v-if="formOk" class="ok">{{ formOk }}</p>
    </section>

    <section class="card">
      <h3>名单列表</h3>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="loading" class="muted">加载中…</p>
      <p v-else-if="list.length === 0" class="muted">暂无名单记录</p>
      <table v-else>
        <thead>
          <tr>
            <th>姓名</th>
            <th>邮箱</th>
            <th>部门</th>
            <th>来源</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in list" :key="r.id">
            <td>{{ r.name }}</td>
            <td>{{ r.email }}</td>
            <td>{{ r.department }}</td>
            <td>{{ sourceLabel[r.source] }}</td>
            <td>
              <span class="tag" :class="statusClass[r.status]">{{ statusLabel[r.status] }}</span>
              <span v-if="r.status === 'REJECTED' && r.rejectReason" class="reason">：{{ r.rejectReason }}</span>
            </td>
            <td>
              <template v-if="canOperate(r)">
                <!-- 开发者：待审批记录显示通过/拒绝 -->
                <template v-if="isDev && r.status === 'PENDING'">
                  <button class="btn btn-primary sm" :disabled="reviewingId === r.id" @click="review(r.id, 'approve')">通过</button>
                  <button class="btn btn-danger sm" :disabled="reviewingId === r.id" @click="review(r.id, 'reject')">拒绝</button>
                  <input v-if="r.status === 'PENDING'" v-model="rejectReason" class="inline-input" placeholder="拒绝原因（可选）" />
                </template>
                <!-- 已通过且未激活：显示重发按钮 -->
                <button v-if="r.status === 'APPROVED'" class="btn btn-primary sm" :disabled="actionId === r.id" @click="resend(r.id)">
                  {{ actionId === r.id ? '发送中…' : '重发激活' }}
                </button>
                <!-- 删除按钮 -->
                <button class="btn btn-danger sm" :disabled="actionId === r.id" @click="remove(r.id, r.name)">删除</button>
              </template>
              <span v-else class="muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="actionMsg" class="ok">{{ actionMsg }}</p>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 1000px; margin: 0 auto; padding: 32px 24px; }
h2 { font-size: 22px; color: var(--text); }
.hint { color: var(--muted); font-size: 13px; margin: 6px 0 20px; }
.card {
  background: var(--card);
  border-radius: 16px;
  padding: 20px 24px;
  margin-bottom: 20px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
}
h3 { font-size: 15px; margin-bottom: 14px; color: var(--primary-dark); }
.form-grid { display: grid; grid-template-columns: repeat(4, 1fr) auto; gap: 10px; }
input {
  height: 40px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 0 10px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
input:focus { border-color: var(--primary); }
.inline-input { width: 160px; height: 32px; margin-left: 8px; }
.btn { height: 40px; padding: 0 18px; border-radius: 10px; }
.btn.sm { height: 30px; padding: 0 12px; margin-right: 6px; }
button:disabled { opacity: 0.55; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: 600; }
.tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
}
.st-pending { background: #fff3d6; color: #8a6100; }
.st-approved { background: #d8f3e3; color: #0f9d6e; }
.st-rejected { background: #fde3e3; color: #ff7675; }
.reason { color: #ff7675; font-size: 12px; }
.error { color: #ff7675; font-size: 13px; margin-top: 10px; }
.ok { color: #0f9d6e; font-size: 13px; margin-top: 10px; }
.muted { color: var(--muted); font-size: 13px; }
</style>
