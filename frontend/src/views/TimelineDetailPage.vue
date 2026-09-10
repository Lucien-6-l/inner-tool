<template>
  <div class="page">
    <div class="header">
      <div>
        <router-link to="/timelines" class="back">← 返回列表</router-link>
        <h2>{{ timeline?.name }}</h2>
        <p class="sub" v-if="timeline?.description">{{ timeline.description }}</p>
      </div>
      <div class="meta">
        <span class="tag">发起人：{{ timeline?.creator?.name }}</span>
        <span class="tag">👥 {{ timeline?.participants?.length || 0 }} 参与者</span>
      </div>
    </div>

    <div class="tabs">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: activeTab === t.key }" @click="activeTab = t.key">
        {{ t.label }}
      </button>
    </div>

    <!-- 主线文件 -->
    <div v-if="activeTab === 'main'" class="panel">
      <h3>主线文件（全体共有）</h3>
      <div v-if="mainLoading" class="muted">加载中…</div>
      <div v-else-if="!mainFiles.length" class="empty-sm">主线暂无文件，等待汇入</div>
      <div v-else class="file-list">
        <div v-for="f in mainFiles" :key="f.id" class="file-item">
          <span class="file-icon">📄</span>
          <div class="file-info">
            <a :href="f.filePath" target="_blank" class="file-name">{{ f.filename }}</a>
            <div class="file-meta">v{{ f.version }} · {{ formatSize(f.fileSize) }} · {{ f.uploadedBy?.name }} · {{ formatTime(f.uploadedAt) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 我的分支 -->
    <div v-if="activeTab === 'mine'" class="panel">
      <div class="panel-head">
        <h3>我的个人分支</h3>
        <div>
          <label class="btn btn-primary file-upload">
            ＋ 上传文件
            <input type="file" @change="onUpload" style="display:none" :disabled="uploading" />
          </label>
          <button class="btn btn-ghost" :disabled="!myBranch || myFileCount === 0" @click="showMr = true">发起汇入请求</button>
        </div>
      </div>
      <div v-if="myLoading" class="muted">加载中…</div>
      <div v-else-if="!myFiles.length" class="empty-sm">分支为空，上传文件开始工作</div>
      <div v-else class="file-list">
        <div v-for="f in myFiles" :key="f.id" class="file-item">
          <span class="file-icon">📄</span>
          <div class="file-info">
            <a :href="f.filePath" target="_blank" class="file-name">{{ f.filename }}</a>
            <div class="file-meta">v{{ f.version }} · {{ formatSize(f.fileSize) }} · {{ formatTime(f.uploadedAt) }}</div>
          </div>
          <button class="btn btn-danger sm" @click="onDeleteFile(f)">删除</button>
        </div>
      </div>
    </div>

    <!-- 汇入请求 -->
    <div v-if="activeTab === 'mr'" class="panel">
      <h3>汇入请求</h3>
      <div v-if="mrLoading" class="muted">加载中…</div>
      <div v-else-if="!mrList.length" class="empty-sm">暂无汇入请求</div>
      <div v-else class="mr-list">
        <router-link v-for="mr in mrList" :key="mr.id" :to="`/timelines/${id}/mr/${mr.id}`" class="mr-item">
          <div class="mr-title">{{ mr.title }}</div>
          <div class="mr-meta">
            <span :class="['mr-status', mr.status]">{{ statusLabel(mr.status) }}</span>
            <span>来自：{{ mr.sourceBranch?.owner?.name || '?' }}</span>
            <span>👍 {{ mr._count?.votes || 0 }} 票</span>
            <span>{{ formatTime(mr.createdAt) }}</span>
          </div>
        </router-link>
      </div>
      <div v-if="mrInfo" class="mr-threshold">
        汇入条件：全体参与者（{{ mrInfo.participantCount }} 人）中超过 2/3 赞成，即需 <b>{{ mrInfo.requiredApprovals }}</b> 票
      </div>
    </div>

    <!-- 活动记录 -->
    <div v-if="activeTab === 'activity'" class="panel">
      <h3>版本链 · 操作记录</h3>
      <div v-if="actLoading" class="muted">加载中…</div>
      <div v-else-if="!activity.length" class="empty-sm">暂无记录</div>
      <div v-else class="timeline">
        <div v-for="a in activity" :key="a.id" class="tl-item">
          <div class="tl-dot"></div>
          <div class="tl-content">
            <div class="tl-text"><b>{{ a.user?.name }}</b> {{ actionLabel(a.actionType) }}</div>
            <div class="tl-time">{{ formatTime(a.createdAt) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 发起汇入请求弹窗 -->
    <div v-if="showMr" class="modal-mask" @click.self="showMr = false">
      <div class="modal">
        <h3>发起汇入主线请求</h3>
        <label>请求标题 *</label>
        <input v-model="mrForm.title" placeholder="例如：完成初版设计稿" />
        <label>附带说明</label>
        <textarea v-model="mrForm.description" placeholder="简要说明本次汇入内容" rows="3"></textarea>
        <p class="hint-sm">发起后全体参与者可投票，超过 2/3 赞成后汇入主线。</p>
        <div v-if="mrError" class="error">{{ mrError }}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showMr = false">取消</button>
          <button class="btn btn-primary" :disabled="mrCreating" @click="doCreateMr">{{ mrCreating ? '提交中…' : '发起请求' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  getTimeline, getMyBranch, getBranchFiles, uploadBranchFile, deleteBranchFile,
  getMergeRequests, createMergeRequest, getTimelineActivity,
  type Timeline, type TimelineFile, type MergeRequest, type TimelineActivity,
} from '../timelineApi';
import { colorForName } from '../api';

const route = useRoute();
const id = route.params.id as string;

const tabs = [
  { key: 'main', label: '主线' },
  { key: 'mine', label: '我的分支' },
  { key: 'mr', label: '汇入请求' },
  { key: 'activity', label: '活动记录' },
];
const activeTab = ref('main');

const timeline = ref<Timeline | null>(null);
const mainBranch = ref<string | null>(null);
const mainFiles = ref<TimelineFile[]>([]);
const mainLoading = ref(false);
const myBranch = ref<{ id: string } | null>(null);
const myFiles = ref<TimelineFile[]>([]);
const myFileCount = computed(() => myFiles.value.length);
const myLoading = ref(false);
const uploading = ref(false);
const mrList = ref<MergeRequest[]>([]);
const mrInfo = ref<{ participantCount: number; requiredApprovals: number } | null>(null);
const mrLoading = ref(false);
const activity = ref<TimelineActivity[]>([]);
const actLoading = ref(false);

const showMr = ref(false);
const mrCreating = ref(false);
const mrError = ref('');
const mrForm = ref({ title: '', description: '' });

async function loadDetail() {
  timeline.value = await getTimeline(id);
  const main = timeline.value?.branches?.find((b) => b.isMain);
  mainBranch.value = main?.id || null;
}

async function loadMainFiles() {
  if (!mainBranch.value) return;
  mainLoading.value = true;
  try {
    const d = await getBranchFiles(mainBranch.value);
    mainFiles.value = d.files;
  } finally { mainLoading.value = false; }
}

async function loadMyBranch() {
  myLoading.value = true;
  try {
    myBranch.value = await getMyBranch(id);
    const d = await getBranchFiles(myBranch.value.id);
    myFiles.value = d.files;
  } finally { myLoading.value = false; }
}

async function loadMR() {
  mrLoading.value = true;
  try {
    const d = await getMergeRequests(id);
    mrList.value = d.list;
    mrInfo.value = { participantCount: d.participantCount, requiredApprovals: d.requiredApprovals };
  } finally { mrLoading.value = false; }
}

async function loadActivity() {
  actLoading.value = true;
  try {
    const d = await getTimelineActivity(id);
    activity.value = d.list;
  } finally { actLoading.value = false; }
}

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    await uploadBranchFile(id, file);
    await loadMyBranch();
  } catch (err: any) {
    alert(err.message || '上传失败');
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

async function onDeleteFile(f: TimelineFile) {
  if (!confirm(`确定删除文件「${f.filename}」v${f.version}？`)) return;
  if (!myBranch.value) return;
  await deleteBranchFile(myBranch.value.id, f.id);
  await loadMyBranch();
}

async function doCreateMr() {
  if (!mrForm.value.title.trim()) { mrError.value = '请输入标题'; return; }
  mrCreating.value = true;
  mrError.value = '';
  try {
    await createMergeRequest(id, { title: mrForm.value.title, description: mrForm.value.description });
    showMr.value = false;
    mrForm.value = { title: '', description: '' };
    activeTab.value = 'mr';
    await loadMR();
  } catch (e: any) {
    mrError.value = e.message || '创建失败';
  } finally { mrCreating.value = false; }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function statusLabel(s: string): string {
  return { pending: '投票中', approved: '已通过', rejected: '已驳回', merged: '已汇入' }[s] || s;
}
function actionLabel(t: string): string {
  const map: Record<string, string> = {
    timeline_created: '创建了项目',
    participant_added: '添加了参与者',
    participant_removed: '移除了参与者',
    branch_created: '创建了个人分支',
    file_uploaded: '上传了文件',
    file_deleted: '删除了文件',
    mr_created: '发起了汇入请求',
    mr_voted: '进行了投票',
    mr_approved: '请求通过投票',
    mr_rejected: '请求被驳回',
    mr_merged: '执行了汇入主线',
    mr_resubmitted: '重新提交了请求',
    mr_commented: '发表了评论',
  };
  return map[t] || t;
}

watch(activeTab, (t) => {
  if (t === 'main') loadMainFiles();
  if (t === 'mine') loadMyBranch();
  if (t === 'mr') loadMR();
  if (t === 'activity') loadActivity();
});

onMounted(async () => {
  await loadDetail();
  await loadMainFiles();
});
</script>

<style scoped>
.page { max-width: 960px; margin: 0 auto; padding: 24px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.back { font-size: 13px; color: var(--primary); text-decoration: none; }
h2 { font-size: 22px; color: var(--text); margin: 4px 0; }
.sub { color: var(--muted); font-size: 13px; }
.meta { display: flex; gap: 8px; flex-wrap: wrap; }
.tag { background: var(--bg); padding: 4px 12px; border-radius: 999px; font-size: 12px; color: var(--muted); }
.tabs { display: flex; gap: 4px; border-bottom: 2px solid var(--border); margin-bottom: 20px; }
.tab { padding: 10px 18px; border: none; background: none; font-size: 14px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.panel { background: var(--card); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); border: 1px solid var(--border); }
.panel h3 { font-size: 15px; color: var(--primary-dark); margin-bottom: 14px; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.panel-head h3 { margin-bottom: 0; }
.panel-head > div { display: flex; gap: 8px; }
.btn { height: 36px; padding: 0 14px; border-radius: 10px; font-size: 13px; }
.btn.sm { height: 28px; padding: 0 10px; font-size: 12px; }
.file-upload { display: inline-flex; align-items: center; cursor: pointer; }
.file-list { display: flex; flex-direction: column; gap: 8px; }
.file-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--bg); border-radius: 10px; }
.file-icon { font-size: 20px; }
.file-info { flex: 1; min-width: 0; }
.file-name { color: var(--primary); text-decoration: none; font-size: 14px; font-weight: 500; }
.file-name:hover { text-decoration: underline; }
.file-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
.empty-sm { color: var(--muted); font-size: 13px; padding: 20px; text-align: center; }
.mr-list { display: flex; flex-direction: column; gap: 8px; }
.mr-item { padding: 12px 14px; background: var(--bg); border-radius: 10px; text-decoration: none; color: inherit; }
.mr-item:hover { background: var(--border); }
.mr-title { font-size: 14px; font-weight: 500; }
.mr-meta { display: flex; gap: 12px; font-size: 12px; color: var(--muted); margin-top: 4px; flex-wrap: wrap; }
.mr-status { padding: 1px 8px; border-radius: 999px; font-size: 11px; }
.mr-status.pending { background: #fff3d6; color: #8a6100; }
.mr-status.approved { background: #d8f3e3; color: #0f9d6e; }
.mr-status.rejected { background: #fde3e3; color: #ff7675; }
.mr-status.merged { background: #e4dfff; color: #6c5ce7; }
.mr-threshold { margin-top: 14px; font-size: 12px; color: var(--muted); background: var(--bg); padding: 8px 12px; border-radius: 8px; }
.timeline { position: relative; padding-left: 20px; }
.tl-item { position: relative; padding-bottom: 16px; }
.tl-item::before { content: ''; position: absolute; left: -16px; top: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--primary); }
.tl-item:not(:last-child)::after { content: ''; position: absolute; left: -13px; top: 14px; bottom: 0; width: 2px; background: var(--border); }
.tl-text { font-size: 13px; }
.tl-time { font-size: 11px; color: var(--muted); margin-top: 2px; }
.muted { color: var(--muted); }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: var(--card); border-radius: 16px; padding: 24px; width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
.modal h3 { font-size: 18px; margin-bottom: 16px; color: var(--primary-dark); }
.modal label { display: block; font-size: 13px; color: var(--muted); margin: 12px 0 6px; }
.modal input, .modal textarea { width: 100%; box-sizing: border-box; border: 1.5px solid var(--border); border-radius: 10px; padding: 8px 12px; font-size: 14px; outline: none; font-family: inherit; }
.modal input:focus, .modal textarea:focus { border-color: var(--primary); }
.hint-sm { font-size: 12px; color: var(--muted); margin-top: 8px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.error { color: var(--coral); font-size: 13px; margin-top: 10px; }
</style>
