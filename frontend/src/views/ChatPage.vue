<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { request, currentUser } from '../api';
import { connectSocket, disconnectSocket, getSocket } from '../chat';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'file';
  content: string;
  fileName: string | null;
  fileSize: number | null;
  readAt: string | null;
  createdAt: string;
  sender: { id: string; name: string };
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
  } finally {
    sending.value = false;
  }
}

function pickFile() {
  fileInput.value?.click();
}

async function onFileChosen(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !currentId.value || sending.value) return;
  sending.value = true;
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
            <div class="bubble">
              <template v-if="m.type === 'text'">
                <p class="text">{{ m.content }}</p>
              </template>
              <template v-else-if="m.type === 'image'">
                <img :src="m.content" class="img" alt="图片" />
              </template>
              <template v-else>
                <a class="file" :href="m.content" target="_blank" rel="noopener">
                  <span class="file-icon">📄</span>
                  <span class="file-meta">
                    <span class="file-name">{{ m.fileName }}</span>
                    <span class="file-size">{{ fmtSize(m.fileSize) }}</span>
                  </span>
                </a>
              </template>
            </div>
            <span class="meta">
              <span v-if="m.senderId === me()" class="read">{{ m.readAt ? '已读' : '' }}</span>
              <span class="time">{{ fmtTime(m.createdAt) }}</span>
            </span>
          </div>
        </div>
        <footer class="input-bar">
          <button class="ghost" title="发送文件或图片" @click="pickFile">📎</button>
          <input ref="fileInput" type="file" class="hidden" @change="onFileChosen" />
          <input
            v-model="draft"
            class="text-input"
            placeholder="输入消息，回车发送"
            @keydown.enter.prevent="send"
          />
          <button class="primary" :disabled="sending" @click="send">发送</button>
        </footer>
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
.text { margin: 0; white-space: pre-wrap; word-break: break-word; }
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
