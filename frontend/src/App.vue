<script setup lang="ts">
// 阶段 1 占位页：展示项目已就绪，后续替换为登录页 / 工作台
import { ref, onMounted } from 'vue';

const backendOk = ref<boolean | null>(null);

onMounted(async () => {
  try {
    const res = await fetch('/api/health');
    backendOk.value = res.ok;
  } catch {
    backendOk.value = false;
  }
});
</script>

<template>
  <main class="shell">
    <h1>公司内部沟通工具</h1>
    <p class="sub">阶段 1 · 工程骨架已就绪</p>
    <p class="status" :class="backendOk === true ? 'ok' : backendOk === false ? 'fail' : 'wait'">
      {{ backendOk === true ? '后端连接正常' : backendOk === false ? '后端未连接（先启动 backend）' : '检测后端中…' }}
    </p>
  </main>
</template>

<style>
* { box-sizing: border-box; margin: 0; }
body {
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  background: #f2f4f8;
  color: #0d1326;
}
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
h1 { font-size: 28px; }
.sub { color: #536174; font-size: 15px; }
.status { font-size: 14px; padding: 6px 14px; border-radius: 999px; }
.ok { background: #d8f3e3; color: #0f6b3a; }
.fail { background: #fde3e3; color: #b3343a; }
.wait { background: #e5e9f0; color: #536174; }
</style>
