<template>
  <div class="page">
    <div class="header">
      <router-link :to="`/timelines/${id}`" class="back">← 返回项目</router-link>
      <h2>{{ mr?.title }}</h2>
      <div class="meta">
        <span :class="['status-badge', mr?.status]">{{ statusLabel(mr?.status || '') }}</span>
        <span class="muted">发起人：{{ mr?.createdBy?.name }}</span>
      </div>
    </div>

    <div v-if="loading" class="muted">加载中…</div>
    <template v-else-if="mr">
      <!-- 说明 -->
      <div v-if="mr.description" class="section desc-box">
        <p>{{ mr.description }}</p>
      </div>

      <!-- 投票进度 -->
      <div class="section">
        <h3>投票进度</h3>
        <div class="vote-bar">
          <div class="vote-fill" :style="{ width: approvePercent + '%' }"></div>
        </div>
        <div class="vote-stats">
          <span class="approve">👍 赞成 {{ mr.approveCount }} / {{ mr.requiredApprovals }}</span>
          <span class="reject">👎 驳回 {{ mr.rejectCount }}</span>
          <span class="muted">共 {{ mr.participantCount }} 名参与者，需超过 2/3（{{ mr.requiredApprovals }} 票）</span>
        </div>
      </div>

      <!-- 我的投票 -->
      <div v-if="mr.status === 'pending'" class="section">
        <h3>我的投票</h3>
        <div class="vote-actions">
          <button class="btn vote-btn approve" :class="{ active: myVote === 'approve' }" @click="doVote('approve')">👍 赞成</button>
          <button class="btn vote-btn reject" :class="{ active: myVote === 'reject' }" @click="showReject = true">👎 驳回</button>
          <button class="btn vote-btn abstain" :class="{ active: myVote === 'abstain' }" @click="doVote('abstain')">🤷 弃权</button>
        </div>
        <div v-if="myVote" class="my-vote-note">
          你已投：<b>{{ { approve: '赞成', reject: '驳回', abstain: '弃权' }[myVote] }}</b>
          <span v-if="myVoteDetail">（{{ myVoteDetail }}）</span>
        </div>
      </div>

      <!-- 汇入执行 -->
      <div v-if="mr.status === 'approved'" class="section merge-box">
        <p>🎉 投票已通过，可执行汇入主线</p>
        <button class="btn btn-primary" :disabled="merging" @click="doMerge">{{ merging ? '汇入中…' : '汇入主线' }}</button>
      </div>

      <!-- 重新提交 -->
      <div v-if="mr.status === 'rejected' && isCreator" class="section">
        <h3>重新提交</h3>
        <p class="muted">请求被驳回后，可修改后重新提交（投票将重置）。当前已重提交 {{ mr.resubmitCount }} 次。</p>
        <button class="btn btn-primary" @click="showResubmit = true">修改并重新提交</button>
      </div>

      <!-- 文件列表 -->
      <div class="section">
        <h3>本次汇入文件（{{ mr.files?.length || 0 }}）</h3>
        <div v-if="!mr.files?.length" class="empty-sm">无文件</div>
        <div v-else class="file-list">
          <div v-for="f in mr.files" :key="f.id" class="file-item">
            <span class="file-icon">📄</span>
            <div class="file-info">
              <a :href="f.filePath" target="_blank" class="file-name">{{ f.filename }}</a>
              <div class="file-meta">
                v{{ f.version }} · {{ formatSize(f.fileSize) }}
                <span v-if="f.isConflict" class="conflict-tag">⚠ 与主线 v{{ f.mainVersion }} 冲突，投票决议</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 投票详情 -->
      <div class="section">
        <h3>投票详情</h3>
        <div v-if="!mr.votes?.length" class="empty-sm">暂无投票</div>
        <div v-else class="vote-list">
          <div v-for="v in mr.votes" :key="v.id" class="vote-item">
            <span class="avatar-c sm" :style="{ background: colorForName(v.voter.name) }">{{ v.voter.name.trim().slice(0,1) }}</span>
            <div class="vote-info">
              <div class="vote-name">{{ v.voter.name }}
                <span :class="['vote-tag', v.vote]">{{ { approve: '赞成', reject: '驳回', abstain: '弃权' }[v.vote] }}</span>
              </div>
              <div v-if="v.comment" class="vote-comment">问题：{{ v.comment }}</div>
              <div class="vote-time">{{ formatTime(v.createdAt) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 评论讨论 -->
      <div class="section">
        <h3>讨论（{{ mr.comments?.length || 0 }}）</h3>
        <div class="comment-list">
          <div v-for="c in mr.comments" :key="c.id" class="comment-item">
            <span class="avatar-c sm" :style="{ background: colorForName(c.user.name) }">{{ c.user.name.trim().slice(0,1) }}</span>
            <div class="comment-body">
              <div class="comment-head"><b>{{ c.user.name }}</b> <span class="muted">{{ formatTime(c.createdAt) }}</span></div>
              <div class="comment-text">{{ c.content }}</div>
            </div>
          </div>
        </div>
        <div class="comment-input">
          <input v-model="commentText" placeholder="发表评论…" @keydown.enter.prevent="doComment" />
          <button class="btn btn-primary sm" :disabled="!commentText.trim()" @click="doComment">发送</button>
        </div>
      </div>
    </template>

    <!-- 驳回弹窗 -->
    <div v-if="showReject" class="modal-mask" @click.self="showReject = false">
      <div class="modal">
        <h3>投驳回票</h3>
        <p class="hint-sm">驳回必须填写具体问题所在，便于发起人修改。</p>
        <textarea v-model="rejectComment" placeholder="请描述具体问题…" rows="4"></textarea>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showReject = false">取消</button>
          <button class="btn btn-danger" :disabled="!rejectComment.trim()" @click="doVote('reject')">确认驳回</button>
        </div>
      </div>
    </div>

    <!-- 重提交弹窗 -->
    <div v-if="showResubmit" class="modal-mask" @click.self="showResubmit = false">
      <div class="modal">
        <h3>修改并重新提交</h3>
        <label>标题</label>
        <input v-model="resubmitForm.title" />
        <label>说明</label>
        <textarea v-model="resubmitForm.description" rows="3"></textarea>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showResubmit = false">取消</button>
          <button class="btn btn-primary" :disabled="resubmitting" @click="doResubmit">{{ resubmitting ? '提交中…' : '重新提交' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  getMergeRequest, voteMergeRequest, commentMergeRequest, mergeMergeRequest, resubmitMergeRequest,
  type MergeRequest,
} from '../timelineApi';
import { currentUser, colorForName } from '../api';

const route = useRoute();
const id = route.params.id as string;
const mrId = route.params.mrId as string;

const mr = ref<MergeRequest | null>(null);
const loading = ref(true);
const merging = ref(false);
const commentText = ref('');
const showReject = ref(false);
const rejectComment = ref('');
const showResubmit = ref(false);
const resubmitting = ref(false);
const resubmitForm = ref({ title: '', description: '' });

const isCreator = computed(() => mr.value?.createdById === currentUser.value?.id);
const myVote = computed(() => {
  const v = mr.value?.votes?.find((x) => x.voterId === currentUser.value?.id);
  return v?.vote || null;
});
const myVoteDetail = computed(() => {
  const v = mr.value?.votes?.find((x) => x.voterId === currentUser.value?.id);
  return v?.comment || null;
});
const approvePercent = computed(() => {
  if (!mr.value?.requiredApprovals) return 0;
  return Math.min(100, ((mr.value.approveCount || 0) / mr.value.requiredApprovals) * 100);
});

async function load() {
  loading.value = true;
  try {
    mr.value = await getMergeRequest(mrId);
    resubmitForm.value = { title: mr.value.title, description: mr.value.description || '' };
  } finally { loading.value = false; }
}

async function doVote(vote: 'approve' | 'reject' | 'abstain') {
  const comment = vote === 'reject' ? rejectComment.value.trim() : undefined;
  if (vote === 'reject' && !comment) return;
  try {
    await voteMergeRequest(mrId, vote, comment);
    showReject.value = false;
    rejectComment.value = '';
    await load();
  } catch (e: any) {
    alert(e.message || '投票失败');
  }
}

async function doComment() {
  if (!commentText.value.trim()) return;
  try {
    await commentMergeRequest(mrId, commentText.value.trim());
    commentText.value = '';
    await load();
  } catch (e: any) {
    alert(e.message || '评论失败');
  }
}

async function doMerge() {
  if (!confirm('确认汇入主线？汇入后分支文件将复制到主线（版本递增）。')) return;
  merging.value = true;
  try {
    await mergeMergeRequest(mrId);
    await load();
  } catch (e: any) {
    alert(e.message || '汇入失败');
  } finally { merging.value = false; }
}

async function doResubmit() {
  resubmitting.value = true;
  try {
    await resubmitMergeRequest(mrId, resubmitForm.value);
    showResubmit.value = false;
    await load();
  } catch (e: any) {
    alert(e.message || '重新提交失败');
  } finally { resubmitting.value = false; }
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
  return { pending: '投票中', approved: '已通过待汇入', rejected: '已驳回', merged: '已汇入主线' }[s] || s;
}

onMounted(load);
</script>

<style scoped>
.page { max-width: 800px; margin: 0 auto; padding: 24px; }
.header { margin-bottom: 16px; }
.back { font-size: 13px; color: var(--primary); text-decoration: none; }
h2 { font-size: 20px; color: var(--text); margin: 4px 0; }
.meta { display: flex; gap: 12px; align-items: center; margin-top: 6px; }
.status-badge { padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.status-badge.pending { background: #fff3d6; color: #8a6100; }
.status-badge.approved { background: #d8f3e3; color: #0f9d6e; }
.status-badge.rejected { background: #fde3e3; color: #ff7675; }
.status-badge.merged { background: #e4dfff; color: #6c5ce7; }
.section { background: var(--card); border-radius: 14px; padding: 18px; margin-bottom: 14px; box-shadow: var(--shadow-sm); border: 1px solid var(--border); }
.section h3 { font-size: 14px; color: var(--primary-dark); margin-bottom: 12px; }
.desc-box p { font-size: 13px; color: var(--text); line-height: 1.6; margin: 0; }
.vote-bar { height: 10px; background: var(--border); border-radius: 5px; overflow: hidden; margin-bottom: 8px; }
.vote-fill { height: 100%; background: linear-gradient(90deg, #00cec9, #6c5ce7); border-radius: 5px; transition: width 0.3s; }
.vote-stats { display: flex; gap: 16px; font-size: 13px; flex-wrap: wrap; }
.vote-stats .approve { color: #0f9d6e; font-weight: 600; }
.vote-stats .reject { color: #ff7675; font-weight: 600; }
.vote-actions { display: flex; gap: 10px; }
.vote-btn { flex: 1; height: 42px; border-radius: 10px; font-size: 14px; border: 1.5px solid var(--border); background: var(--card); cursor: pointer; }
.vote-btn.approve.active { background: #d8f3e3; border-color: #0f9d6e; color: #0f9d6e; }
.vote-btn.reject.active { background: #fde3e3; border-color: #ff7675; color: #ff7675; }
.vote-btn.abstain.active { background: var(--border); border-color: var(--muted); color: var(--muted); }
.my-vote-note { margin-top: 10px; font-size: 13px; color: var(--muted); }
.merge-box { text-align: center; }
.merge-box p { font-size: 15px; color: #0f9d6e; margin-bottom: 12px; }
.file-list { display: flex; flex-direction: column; gap: 8px; }
.file-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--bg); border-radius: 8px; }
.file-icon { font-size: 18px; }
.file-info { flex: 1; min-width: 0; }
.file-name { color: var(--primary); text-decoration: none; font-size: 13px; }
.file-name:hover { text-decoration: underline; }
.file-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
.conflict-tag { color: #d97b00; margin-left: 8px; }
.vote-list { display: flex; flex-direction: column; gap: 10px; }
.vote-item { display: flex; gap: 10px; align-items: flex-start; }
.avatar-c.sm { width: 30px; height: 30px; font-size: 13px; flex-shrink: 0; }
.vote-info { flex: 1; }
.vote-name { font-size: 13px; font-weight: 500; }
.vote-tag { margin-left: 8px; padding: 1px 8px; border-radius: 999px; font-size: 11px; }
.vote-tag.approve { background: #d8f3e3; color: #0f9d6e; }
.vote-tag.reject { background: #fde3e3; color: #ff7675; }
.vote-tag.abstain { background: var(--border); color: var(--muted); }
.vote-comment { font-size: 12px; color: #ff7675; margin-top: 2px; }
.vote-time { font-size: 11px; color: var(--muted); margin-top: 2px; }
.comment-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.comment-item { display: flex; gap: 10px; }
.comment-body { flex: 1; }
.comment-head { font-size: 12px; margin-bottom: 2px; }
.comment-text { font-size: 13px; color: var(--text); }
.comment-input { display: flex; gap: 8px; }
.comment-input input { flex: 1; height: 36px; border: 1.5px solid var(--border); border-radius: 10px; padding: 0 12px; font-size: 13px; outline: none; }
.comment-input input:focus { border-color: var(--primary); }
.btn { height: 36px; padding: 0 14px; border-radius: 10px; font-size: 13px; }
.btn.sm { height: 32px; padding: 0 12px; }
.empty-sm { color: var(--muted); font-size: 13px; text-align: center; padding: 12px; }
.muted { color: var(--muted); font-size: 13px; }
.hint-sm { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: var(--card); border-radius: 16px; padding: 24px; width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
.modal h3 { font-size: 18px; margin-bottom: 12px; color: var(--primary-dark); }
.modal label { display: block; font-size: 13px; color: var(--muted); margin: 10px 0 6px; }
.modal input, .modal textarea { width: 100%; box-sizing: border-box; border: 1.5px solid var(--border); border-radius: 10px; padding: 8px 12px; font-size: 14px; outline: none; font-family: inherit; }
.modal textarea { resize: vertical; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
</style>
