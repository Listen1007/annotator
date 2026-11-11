<template>
  <div class="maintain-page">
    <header class="topbar">
      <div class="brand">
        <span class="brand-logo">标</span>
        <span class="brand-name">通用标注工具 · 数据维护</span>
      </div>
      <div class="topbar-center">
        <router-link to="/" class="btn btn--ghost">← 返回标注</router-link>
      </div>
      <div class="topbar-stats">
        <span class="stat" :class="hasBackend === false ? 'stat--warn' : 'stat--ok'">
          {{ hasBackend === null ? '检测服务中…' : hasBackend ? '本地服务已连接' : '本地服务未启动' }}
        </span>
      </div>
    </header>

    <main class="maintain-main">
      <div v-if="hasBackend === false" class="backend-warn">
        未检测到本地服务。维护功能会读写项目内的数据文件，请关闭本页后，
        双击项目根目录的「启动.bat」启动工具，再进入本页面操作。
      </div>

      <div class="task-grid">
        <div v-for="t in tasks" :key="t.key" class="task-card">
          <div class="task-head">
            <h3>{{ t.title }}</h3>
            <span class="task-files" :title="t.files">{{ t.files }}</span>
          </div>
          <p class="task-desc">{{ t.desc }}</p>
          <button
            class="btn btn--primary"
            :disabled="running === t.key || hasBackend === false"
            @click="runTask(t.key)"
          >
            {{ running === t.key ? '执行中…' : '执行' }}
          </button>
        </div>
      </div>

      <div v-if="history.length" class="console">
        <div class="console-head">
          <span>执行结果（最新在前）</span>
          <button class="console-clear" @click="history = []">清空</button>
        </div>
        <div v-for="(h, i) in history" :key="history.length - i" class="console-block">
          <div class="console-title" :class="{ 'is-error': h.error }">{{ h.title }} · {{ h.time }}</div>
          <pre>{{ h.lines.join('\n') }}</pre>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { toast } from '@/utils/toast'
import { checkBackend, runMaintain } from '@/utils/api'

const TASKS = [
  {
    key: 'check',
    title: '检查提取进度',
    desc: '统计待提取与已标注文件，列出重名、重复标注以及剩余未提取的清单。',
    files: '待提取/ · extract/ · extracted/',
  },
  {
    key: 'merge',
    title: '回填词库',
    desc: '汇总 extract/ 目录下所有标注文件中的实体，将新词条合并进词库 enum.json，之后自动提取即可命中。',
    files: 'extract/ → src/data/enum.json',
  },
  {
    key: 'clean',
    title: '清除待删除实体',
    desc: '移除 extract/ 目录下标注文件中类型为「待删除」的实体并写回，用于标注完成后批量清理。',
    files: 'src/views/extract/',
  },
  {
    key: 'list',
    title: '更新已提取名单',
    desc: '以样例目录为准重算已提取名单 extracted.json，用于导入文件时的重复提醒。',
    files: '中毒1_part1/ → src/data/extracted.json',
  },
]

export default {
  name: 'Maintain',
  data() {
    return {
      tasks: TASKS,
      hasBackend: null,
      running: '',
      history: [],
    }
  },
  mounted() {
    checkBackend().then((ok) => {
      this.hasBackend = ok
    })
  },
  methods: {
    runTask(key) {
      const task = TASKS.find((t) => t.key === key)
      this.running = key
      runMaintain(key)
        .then((res) => {
          this.history.unshift({
            title: task.title,
            time: new Date().toLocaleTimeString(),
            lines: res.lines || [],
            error: false,
          })
          toast(`${task.title} 完成`, 'success')
        })
        .catch((err) => {
          this.history.unshift({
            title: `${task.title}（失败）`,
            time: new Date().toLocaleTimeString(),
            lines: [`执行失败：${err.message}`],
            error: true,
          })
          toast(`${task.title} 失败：${err.message}`, 'error', 5000)
        })
        .then(() => {
          this.running = ''
        })
    },
  },
}
</script>

<style scoped lang="scss">
.maintain-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.maintain-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
}

.backend-warn {
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid #fcd34d;
  border-radius: 10px;
  background: #fffbeb;
  color: #92400e;
  font-size: 13px;
  line-height: 1.7;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.task-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);

  h3 {
    margin: 0;
    font-size: 15px;
  }

  .btn { align-self: flex-start; margin-top: auto; }
}

.task-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.task-files {
  font-family: Consolas, monospace;
  font-size: 11px;
  color: var(--muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-desc {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--muted-color);
}

.console {
  margin-top: 20px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: #1e293b;
}

.console-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  font-size: 12px;
  color: #94a3b8;
  border-bottom: 1px solid #334155;
}

.console-clear {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 12px;
  cursor: pointer;

  &:hover { color: #e2e8f0; }
}

.console-block {
  padding: 10px 14px;
  border-bottom: 1px solid #334155;

  &:last-child { border-bottom: none; }
}

.console-title {
  font-size: 12px;
  color: #7dd3fc;
  margin-bottom: 6px;

  &.is-error { color: #fca5a5; }
}

.console pre {
  margin: 0;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.8;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
