<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { request, currentUser } from '../api';
import { connectSocket, disconnectSocket, getSocket } from '../chat';
import LotteryCard from '../components/LotteryCard.vue';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'file' | 'lottery' | 'lottery_result';
  content: string;
  fileName: string | null;
  fileSize: number | null;
  readAt: string | null;
  createdAt: string;
  sender: { id: string; name: string };
}

interface LotteryResult {
  lotteryId: string;
  winnerCount: number;
  winners: { id: string; name: string; department: string }[];
}

interface Conversation {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  name: string;
  department: string | null;
  unread: number;
  memberCount: number;
  lastMessage: {
    type: string;
    content: string;
    fileName: string | null;
    senderName: string;
    createdAt: string;
  } | null;
}

const router = useRouter();
const list = ref<Conversation[]>([]);
const currentId = ref('');
const messages = ref<Message[]>([]);
const hasMore = ref(false);
const loading = ref(false);
const sending = ref(false);
const draft = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const bodyEl = ref<HTMLElement | null>(null);
const inputError = ref('');

// 发起抽奖弹窗
const showLottery = ref(false);
const lotteryForm = ref({ title: '谁想要', winnerCount: 1, deadline: '' });
const lotteryFile = ref<{ url: string; name: string; size: number } | null>(null);
const lotteryBusy = ref(false);
const lotteryError = ref('');

const me = () => currentUser.value?.id ?? '';

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

function summary(c: Conversation): string {
  if (!c.lastMessage) return c.kind === 'GROUP' ? `${c.memberCount} 位成员` : '开始聊天吧';
  const typeMap: Record<string, string> = { image: '[图片]', file: `[文件] ${c.lastMessage.fileName ?? ''}`, text: c.lastMessage.content };
  const prefix = c.kind === 'GROUP' ? `${c.lastMessage.senderName}：` : '';
  return prefix + (typeMap[c.lastMessage.type] ?? c.lastMessage.content);
}

async function loadConversations() {
  const data = await request<{ list: Conversation[] }>('/api/conversations');
  list.value = data.list;
}

async function openConversation(id: string) {
  currentId.value = id;
  messages.value = [];
  hasMore.value = false;
  await loadMessages(id);
  await markRead(id);
  await nextTick();
  scrollBottom();
}

async function loadMessages(id: string) {
  loading.value = true;
  try {
    const data = await request<{ list: Message[]; hasMore: boolean }>(
      `/api/conversations/${id}/messages?limit=50`,
    );
    messages.value = data.list;
    hasMore.value = data.hasMore;
  } finally {
    loading.value = false;
  }
}

async function loadOlder() {
  if (!currentId.value || loading.value || !hasMore.value) return;
  loading.value = true;
  const before = messages.value[0]?.id;
  try {
    const data = await request<{ list: Message[]; hasMore: boolean }>(
      `/api/conversations/${currentId.value}/messages?limit=50&before=${before}`,
    );
    const scrollTop = bodyEl.value?.scrollHeight ?? 0;
    messages.value = [...data.list, ...messages.value];
    hasMore.value = data.hasMore;
    await nextTick();
    if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight - scrollTop;
  } finally {
    loading.value = false;
  }
}

async function markRead(id: string) {
  await request(`/api/conversations/${id}/read`, { method: 'POST' });
  const c = list.value.find((x) => x.id === id);
  if (c) c.unread = 0;
}

async function send() {
  const text = draft.value.trim();
  if (!text || !currentId.value || sending.value) return;
  sending.value = true;
  inputError.value = '';
  try {
    const data = await request<{ message: Message }>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ conversationId: currentId.value, type: 'text', content: text }),
    });
    messages.value.push(data.message);
    draft.value = '';
    await loadConversations();
    await nextTick();
    scrollBottom();
  } catch (e) {
    inputError.value = e instanceof Error ? e.message : '发送失败';
  } finally {
    sending.value = false;
  }
}

function pickFile(kind: 'image' | 'file') {
  if (!fileInput.value) return;
  fileInput.value.accept = kind === 'image' ? 'image/*' : '';
  fileInput.value.click();
}

async function onFileChosen(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !currentId.value || sending.value) return;
  sending.value = true;
  inputError.value = '';
  try {
    const form = new FormData();
    form.append('file', file);
    const up = await request<{ url: string; name: string; size: number }>('/api/upload', {
      method: 'POST',
      body: form,
      form: true,
    });
    const isImage = file.type.startsWith('image/');
    const data = await request<{ message: Message }>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: currentId.value,
        type: isImage ? 'image' : 'file',
        content: up.url,
        fileName: up.name,
        fileSize: up.size,
      }),
    });
    messages.value.push(data.message);
    await loadConversations();
    await nextTick();
    scrollBottom();
  } catch (e) {
    inputError.value = e instanceof Error ? e.message : '发送失败';
  } finally {
    sending.value = false;
  }
}

function onMessageNew(payload: { message: Message }) {
  const msg = payload.message;
  if (msg.conversationId === currentId.value) {
    messages.value.push(msg);
    markRead(currentId.value);
    nextTick(scrollBottom);
  } else if (msg.senderId !== me()) {
    loadConversations();
  } else {
    loadConversations();
  }
}

function scrollBottom() {
  if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight;
}

function fmtSize(n: number | null): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function parseLotteryResult(content: string): LotteryResult | null {
  try {
    return JSON.parse(content) as LotteryResult;
  } catch {
    return null;
  }
}

// ===== 发起抽奖 =====
function openLotteryModal() {
  lotteryForm.value = { title: '谁想要', winnerCount: 1, deadline: '' };
  lotteryFile.value = null;
  lotteryError.value = '';
  showLottery.value = true;
}

function pickLotteryFile() {
  lotteryFileInput.value?.click();
}

const lotteryFileInput = ref<HTMLInputElement | null>(null);

async function onLotteryFileChosen(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || lotteryBusy.value) return;
  lotteryBusy.value = true;
  lotteryError.value = '';
  try {
    const form = new FormData();
    form.append('file', file);
    const up = await request<{ url: string; name: string; size: number }>('/api/upload', {
      method: 'POST',
      body: form,
      form: true,
    });
    lotteryFile.value = up;
  } catch (e) {
    lotteryError.value = e instanceof Error ? e.message : '附件上传失败';
  } finally {
    lotteryBusy.value = false;
  }
}

async function submitLottery() {
  if (!currentId.value || lotteryBusy.value) return;
  const wc = Number(lotteryForm.value.winnerCount);
  if (!Number.isInteger(wc) || wc < 1) {
    lotteryError.value = '开奖人数必须是 ≥1 的整数';
    return;
  }
  lotteryBusy.value = true;
  lotteryError.value = '';
  try {
    const payload: Record<string, unknown> = {
      conversationId: currentId.value,
      title: lotteryForm.value.title.trim() || '谁想要',
      winnerCount: wc,
    };
    if (lotteryFile.value) {
      payload.fileUrl = lotteryFile.value.url;
      payload.fileName = lotteryFile.value.name;
      payload.fileSize = lotteryFile.value.size;
    }
    if (lotteryForm.value.deadline) {
      payload.deadline = new Date(lotteryForm.value.deadline).toISOString();
    }
    await request('/api/lotteries', { method: 'POST', body: JSON.stringify(payload) });
    showLottery.value = false;
    await loadConversations();
  } catch (e) {
    lotteryError.value = e instanceof Error ? e.message : '发起失败';
  } finally {
    lotteryBusy.value = false;
  }
}

onMounted(async () => {
  const socket = connectSocket();
  socket.on('message:new', onMessageNew);
  socket.on('disconnect', () => {
    // 后端重启等情况：短暂重连由 socket.io 自动处理，无需干预
  });
  await loadConversations();
});

onUnmounted(() => {
  getSocket()?.off('message:new', onMessageNew);
});
</script>

<template>
  <main class="chat">
    <!-- 左侧会话列表 -->
    <aside class="side">
      <div class="side-head">
        <span>消息</span>
        <button class="ghost" @click="router.push('/friends')">＋</button>
      </div>
      <div class="conv" v-for="c in list" :key="c.id" :class="{ active: c.id === currentId }" @click="openConversation(c.id)">
        <div class="avatar" :class="c.kind === 'GROUP' ? 'group' : ''">{{ c.name.trim().slice(0, 1) }}</div>
        <div class="conv-main">
          <div class="conv-top">
            <span class="conv-name">{{ c.name }}</span>
            <span v-if="c.lastMessage" class="time">{{ fmtTime(c.lastMessage.createdAt) }}</span>
          </div>
          <div class="conv-bottom">
            <span class="last">{{ summary(c) }}</span>
            <span v-if="c.unread > 0" class="badge">{{ c.unread > 99 ? '99+' : c.unread }}</span>
          </div>
        </div>
      </div>
      <p v-if="list.length === 0" class="empty">还没有会话<br />点击右上角 ＋ 去通讯录找人聊天</p>
    </aside>

    <!-- 右侧聊天窗 -->
    <section class="main">
      <template v-if="currentId">
        <header class="chat-head">
          <span>{{ list.find((c) => c.id === currentId)?.name }}</span>
        </header>
        <div class="body" ref="bodyEl" @scroll.passive="() => { if ((bodyEl?.scrollTop ?? 0) < 40) loadOlder(); }">
          <div v-if="hasMore" class="more"><button class="ghost small" @click="loadOlder">加载更早消息</button></div>
          <div v-for="m in messages" :key="m.id" class="row" :class="m.senderId === me() ? 'mine' : 'theirs'">
            <div class="bubble" :class="m.type === 'lottery' || m.type === 'lottery_result' ? 'card-bubble' : ''">
              <template v-if="m.type === 'text'">
                <p class="text">{{ m.content }}</p>
              </template>
              <template v-else-if="m.type === 'image'">
                <img :src="m.content" class="img" alt="图片" />
              </template>
              <template v-else-if="m.type === 'file'">
                <a class="file" :href="m.content" target="_blank" rel="noopener">
                  <span class="file-icon">📄</span>
                  <span class="file-meta">
                    <span class="file-name">{{ m.fileName }}</span>
                    <span class="file-size">{{ fmtSize(m.fileSize) }}</span>
                  </span>
                </a>
              </template>
              <template v-else-if="m.type === 'lottery'">
                <LotteryCard :lottery-id="m.content" />
              </template>
              <template v-else-if="m.type === 'lottery_result'">
                <div v-if="parseLotteryResult(m.content)" class="result">
                  <p class="result-title">🎉 抽奖结果</p>
                  <p class="result-sub">中奖 {{ parseLotteryResult(m.content)!.winners.length }} / {{ parseLotteryResult(m.content)!.winnerCount }} 人</p>
                  <span v-for="w in parseLotteryResult(m.content)!.winners" :key="w.id" class="winner-name">🏆 {{ w.name }}</span>
                </div>
              </template>
            </div>
            <span class="meta">
              <span v-if="m.senderId === me()" class="read">{{ m.readAt ? '已读' : '' }}</span>
              <span class="time">{{ fmtTime(m.createdAt) }}</span>
            </span>
          </div>
        </div>
        <footer class="input-bar">
          <button class="attach" :disabled="sending" @click="pickFile('image')">🖼 图片</button>
          <button class="attach" :disabled="sending" @click="pickFile('file')">📎 文件</button>
          <button class="attach lottery-btn" :disabled="sending" @click="openLotteryModal">🎁 抽奖</button>
          <input ref="fileInput" type="file" class="hidden" @change="onFileChosen" />
          <input
            v-model="draft"
            class="text-input"
            placeholder="输入消息，回车发送"
            @keydown.enter.prevent="send"
          />
          <button class="primary" :disabled="sending" @click="send">{{ sending ? '发送中…' : '发送' }}</button>
          <p v-if="inputError" class="input-error">{{ inputError }}</p>
        </footer>

        <!-- 发起抽奖弹窗 -->
        <div v-if="showLottery" class="modal-mask" @click.self="showLottery = false">
          <div class="modal">
            <h3>发起抽奖</h3>
            <label>配文</label>
            <input v-model="lotteryForm.title" class="modal-input" placeholder="如：谁想要这个咖啡杯" />
            <label>开奖人数</label>
            <input v-model.number="lotteryForm.winnerCount" class="modal-input" type="number" min="1" max="100" />
            <label>附件（图片或文件，可选）</label>
            <div class="attach-row">
              <input ref="lotteryFileInput" type="file" class="hidden" @change="onLotteryFileChosen" />
              <button class="ghost" :disabled="lotteryBusy" @click="pickLotteryFile">选择图片 / 文件</button>
              <span v-if="lotteryFile" class="file-picked">✅ {{ lotteryFile.name }}（{{ fmtSize(lotteryFile.size) }}）</span>
            </div>
            <label>开奖时间（留空 = 手动开奖）</label>
            <input v-model="lotteryForm.deadline" class="modal-input" type="datetime-local" />
            <p v-if="lotteryError" class="modal-error">{{ lotteryError }}</p>
            <div class="modal-actions">
              <button class="ghost" @click="showLottery = false">取消</button>
              <button class="primary" :disabled="lotteryBusy" @click="submitLottery">{{ lotteryBusy ? '发起中…' : '发起抽奖' }}</button>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="placeholder">选择左侧会话开始聊天</div>
    </section>
  </main>
</template>

<style scoped>
.chat {
  display: flex;
  height: calc(100vh - 56px);
  max-width: 1080px;
  margin: 0 auto;
}
.side {
  width: 280px;
  border-right: 1px solid #e8ecf3;
  display: flex;
  flex-direction: column;
}
.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  font-weight: 700;
}
.conv {
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  align-items: center;
}
.conv:hover { background: #f4f6fa; }
.conv.active { background: #e8f0fe; }
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #0d1326;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}
.avatar.group { background: #2563eb; }
.conv-main { flex: 1; min-width: 0; }
.conv-top { display: flex; justify-content: space-between; align-items: center; }
.conv-name { font-size: 14px; font-weight: 600; }
.time { font-size: 11px; color: #8a93a6; }
.conv-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
.last {
  font-size: 12px;
  color: #8a93a6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}
.badge {
  background: #e03131;
  color: #fff;
  border-radius: 999px;
  font-size: 11px;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}
.empty { text-align: center; color: #8a93a6; font-size: 13px; padding: 40px 16px; line-height: 1.8; }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.chat-head {
  padding: 12px 20px;
  border-bottom: 1px solid #e8ecf3;
  font-weight: 700;
  font-size: 15px;
}
.body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  background: #f8fafc;
}
.row { display: flex; flex-direction: column; margin-bottom: 14px; }
.row.mine { align-items: flex-end; }
.row.theirs { align-items: flex-start; }
.bubble {
  max-width: 65%;
  padding: 9px 13px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.55;
  background: #fff;
  border: 1px solid #e8ecf3;
}
.mine .bubble { background: #2563eb; color: #fff; border-color: #2563eb; }
.bubble.card-bubble { background: transparent; border: none; padding: 0; max-width: 320px; }
.text { margin: 0; white-space: pre-wrap; word-break: break-word; }
.result { font-size: 13px; line-height: 1.6; min-width: 180px; }
.result-title { margin: 0; font-weight: 700; }
.result-sub { margin: 2px 0 6px; color: #8a93a6; font-size: 12px; }
.winner-name { display: inline-block; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 999px; padding: 2px 10px; margin: 0 6px 4px 0; font-size: 12px; }
.img {
  max-width: 280px;
  max-height: 320px;
  border-radius: 8px;
  display: block;
  cursor: zoom-in;
}
.file {
  display: flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  text-decoration: none;
}
.file-icon { font-size: 22px; }
.file-meta { display: flex; flex-direction: column; }
.file-name { font-size: 13px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 11px; opacity: 0.7; }
.meta { display: flex; gap: 6px; align-items: center; margin-top: 3px; font-size: 11px; color: #8a93a6; }
.read { color: #2563eb; }
.more { text-align: center; margin-bottom: 10px; }
.input-bar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e8ecf3;
  align-items: center;
  background: #fff;
  position: relative;
  flex-wrap: wrap;
}
.attach {
  height: 40px;
  padding: 0 14px;
  border: 1px solid #d3dae6;
  background: #fff;
  color: #374151;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}
.attach:hover { border-color: #2563eb; color: #2563eb; }
.lottery-btn { border-color: #fed7aa; color: #c2410c; }
.lottery-btn:hover { border-color: #c2410c; color: #c2410c; }
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(13, 19, 38, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.modal {
  width: 400px;
  background: #fff;
  border-radius: 14px;
  padding: 24px;
}
.modal h3 { margin: 0 0 16px; font-size: 17px; }
.modal label { display: block; font-size: 13px; color: #536174; margin: 12px 0 4px; }
.modal-input {
  width: 100%;
  height: 40px;
  border: 1px solid #d3dae6;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.modal-input:focus { border-color: #2563eb; }
.attach-row { display: flex; align-items: center; gap: 10px; }
.file-picked { font-size: 12px; color: #0f6b3a; }
.modal-error { color: #b3343a; font-size: 13px; margin: 10px 0 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.input-error {
  position: absolute;
  bottom: 4px;
  left: 16px;
  color: #b3343a;
  font-size: 12px;
}
.text-input {
  flex: 1;
  height: 40px;
  border: 1px solid #d3dae6;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
}
.text-input:focus { border-color: #2563eb; }
.primary {
  height: 40px;
  padding: 0 22px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}
.primary:disabled { opacity: 0.6; }
.ghost { border: none; background: none; cursor: pointer; font-size: 15px; color: #536174; }
.ghost.small { font-size: 13px; }
.hidden { display: none; }
.placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: #8a93a6; }
</style>
