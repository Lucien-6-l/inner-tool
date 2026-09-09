<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { request, currentUser } from '../api';
import { getSocket } from '../chat';

interface LotteryUser {
  id: string;
  name: string;
  department: string;
  email?: string;
}

interface LotteryDetail {
  id: string;
  conversationId: string;
  creatorId: string;
  title: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  winnerCount: number;
  deadline: string | null;
  status: 'PENDING' | 'DRAWN' | 'CANCELLED';
  drawnAt: string | null;
  createdAt: string;
  creator: { id: string; name: string };
  entries: LotteryUser[];
  winners: LotteryUser[];
  myEntry: boolean;
}

const props = defineProps<{ lotteryId: string }>();

const lottery = ref<LotteryDetail | null>(null);
const loading = ref(true);
const error = ref('');
const busy = ref(false);

const isCreator = computed(() => lottery.value?.creatorId === currentUser.value?.id);
const isDev = computed(() => currentUser.value?.role === 'DEV');
const canDraw = computed(() => lottery.value?.status === 'PENDING' && (isCreator.value || isDev.value));

function fmtTime(iso: string | null): string {
  if (!iso) return '手动开奖';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtSize(n: number | null): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const isImage = computed(() => {
  const url = lottery.value?.fileUrl ?? '';
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);
});

async function load() {
  try {
    const data = await request<{ lottery: LotteryDetail }>(`/api/lotteries/${props.lotteryId}`);
    lottery.value = data.lottery;
    error.value = '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function toggleEntry() {
  if (!lottery.value || busy.value) return;
  busy.value = true;
  try {
    if (lottery.value.myEntry) {
      await request(`/api/lotteries/${props.lotteryId}/entry`, { method: 'DELETE' });
    } else {
      await request(`/api/lotteries/${props.lotteryId}/entry`, { method: 'POST' });
    }
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败';
  } finally {
    busy.value = false;
  }
}

async function draw() {
  if (!lottery.value || busy.value) return;
  busy.value = true;
  try {
    await request(`/api/lotteries/${props.lotteryId}/draw`, { method: 'POST' });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '开奖失败';
  } finally {
    busy.value = false;
  }
}

function onLotteryUpdated(payload: { lotteryId: string }) {
  if (payload.lotteryId === props.lotteryId) load();
}

onMounted(() => {
  load();
  getSocket()?.on('lottery:updated', onLotteryUpdated);
});
onUnmounted(() => {
  getSocket()?.off('lottery:updated', onLotteryUpdated);
});
</script>

<template>
  <div class="card">
    <div v-if="loading" class="muted">加载中…</div>
    <p v-else-if="error" class="error">{{ error }}</p>
    <template v-else-if="lottery">
      <div class="head">
        <span class="tag">🎁 抽奖</span>
        <span class="status" :class="lottery.status">{{ lottery.status === 'PENDING' ? '报名中' : lottery.status === 'DRAWN' ? '已开奖' : '已取消' }}</span>
      </div>
      <p class="title">{{ lottery.title }}</p>
      <a v-if="lottery.fileUrl && !isImage" :href="lottery.fileUrl" target="_blank" rel="noopener" class="file">
        <span>📄</span><span class="file-name">{{ lottery.fileName }}</span><span class="file-size">{{ fmtSize(lottery.fileSize) }}</span>
      </a>
      <img v-else-if="lottery.fileUrl && isImage" :src="lottery.fileUrl" class="img" alt="抽奖图片" />
      <div class="meta">
        <span>开奖 {{ lottery.winnerCount }} 人</span>
        <span>参与 {{ lottery.entries.length }} 人</span>
        <span>发起人 {{ lottery.creator.name }}</span>
      </div>
      <div class="meta">
        <span>开奖时间：{{ fmtTime(lottery.deadline) }}</span>
      </div>

      <template v-if="lottery.status === 'PENDING'">
        <div class="actions">
          <button class="like" :class="{ liked: lottery.myEntry }" :disabled="busy" @click="toggleEntry">
            {{ lottery.myEntry ? '👍 已参与（点击取消）' : '👍 点赞参与' }}
          </button>
          <button v-if="canDraw" class="draw-btn" :disabled="busy" @click="draw">立即开奖</button>
        </div>
      </template>
      <template v-else-if="lottery.status === 'DRAWN'">
        <div class="winners">
          <p>🎉 中奖名单（{{ lottery.winners.length }} 人）</p>
          <span v-for="w in lottery.winners" :key="w.id" class="winner">🏆 {{ w.name }}<span class="dept">（{{ w.department }}）</span></span>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.card {
  background: linear-gradient(160deg, #fff7ef, #fff0f6);
  border: 1px solid #f7d9b0;
  border-radius: 14px;
  padding: 12px 14px;
  min-width: 240px;
  max-width: 300px;
  box-shadow: 0 4px 14px rgba(255, 159, 67, 0.15);
}
.head { display: flex; align-items: center; gap: 8px; }
.tag { font-size: 12px; font-weight: 700; color: #d97b00; }
.status { font-size: 11px; padding: 1px 8px; border-radius: 999px; }
.status.PENDING { background: #ffedd5; color: #d97b00; }
.status.DRAWN { background: #d8f3e3; color: #0f9d6e; }
.title { font-size: 14px; font-weight: 600; margin: 8px 0; }
.img { max-width: 260px; max-height: 260px; border-radius: 10px; display: block; }
.file { display: flex; align-items: center; gap: 6px; color: #334155; text-decoration: none; font-size: 12px; margin: 6px 0; }
.file-name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { color: var(--muted); }
.meta { display: flex; gap: 12px; font-size: 11px; color: var(--muted); margin-top: 6px; flex-wrap: wrap; }
.actions { display: flex; gap: 8px; margin-top: 10px; }
.like {
  background: #fff;
  border: 1.5px solid #f7d9b0;
  color: #d97b00;
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.like.liked { background: linear-gradient(135deg, #ff9f43, #ff6b9d); border-color: transparent; color: #fff; box-shadow: 0 4px 10px rgba(255, 159, 67, 0.35); }
.like:disabled { opacity: 0.6; }
.draw-btn {
  background: linear-gradient(135deg, #ff9f43, #ff6b9d);
  border: none;
  color: #fff;
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(255, 159, 67, 0.35);
}
.draw-btn:disabled { opacity: 0.6; }
.winners { margin-top: 10px; font-size: 13px; }
.winners p { margin: 0 0 6px; font-weight: 600; color: #0f9d6e; }
.winner { display: inline-flex; align-items: center; background: #fff; border-radius: 999px; padding: 3px 10px; margin: 0 6px 6px 0; font-size: 12px; box-shadow: var(--shadow-sm); }
.dept { color: var(--muted); font-size: 11px; }
.muted { color: var(--muted); font-size: 12px; }
.error { color: var(--coral); font-size: 12px; }
</style>
