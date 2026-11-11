<template>
  <div class="anno-page">
    <!-- 顶栏 -->
    <header class="topbar">
      <div class="brand">
        <span class="brand-logo">标</span>
        <span class="brand-name">通用标注工具</span>
      </div>
      <div class="topbar-center">
        <label class="import-btn" :class="{ 'is-dragging': isDragging }">
          {{ textValue ? '重新导入' : '导入 txt / json' }}
          <input ref="fileInput" type="file" accept=".txt,.json" hidden />
        </label>
        <span v-if="fileName" class="file-name" :title="fileName">{{ fileName }}</span>
      </div>
      <div class="topbar-stats">
        <span class="stat">标注 <b>{{ marks.length }}</b></span>
        <span v-if="coveredIndexes.length" class="stat stat--warn">重叠 <b>{{ coveredIndexes.length }}</b></span>
        <span v-if="typoIndexes.length" class="stat stat--typo">错词 <b>{{ typoIndexes.length }}</b></span>
      </div>
    </header>

    <main class="workspace">
      <!-- 左侧：文本编辑区 -->
      <section
        class="pane editor-pane"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="onDrop"
      >
        <div class="label-bar">
          <button
            v-for="(item, i) in labelTypes"
            :key="item"
            class="type-chip"
            :class="{ 'is-active': exType === item }"
            :style="exType === item ? { backgroundColor: colorOf(item), borderColor: colorOf(item) } : { backgroundColor: colorOf(item) + '55' }"
            @click="selectType(item)"
          >
            {{ item }}<i v-if="i < 10" class="chip-key">{{ (i + 1) % 10 }}</i>
          </button>
          <button class="type-chip type-chip--manage" @click="manageOpen = !manageOpen">＋ 标签</button>
        </div>

        <!-- 标签管理面板 -->
        <div v-if="manageOpen" class="label-manage" @click.stop>
          <div class="manage-hint">点击 × 删除标签；输入名称回车添加。标签列表会保存到项目数据，重启后仍生效。</div>
          <div class="manage-chips">
            <span
              v-for="t in labelTypes"
              :key="t"
              class="manage-chip"
              :style="{ backgroundColor: colorOf(t) + '66' }"
            >
              {{ t }}<i class="chip-del" title="删除该标签" @click="removeLabel(t)">×</i>
            </span>
          </div>
          <div class="manage-row">
            <input
              v-model.trim="newLabel"
              class="manage-input"
              placeholder="新标签名称"
              maxlength="30"
              @keyup.enter="addLabel"
            />
            <button class="btn btn--primary" :disabled="!newLabel" @click="addLabel">添加</button>
            <button class="btn btn--ghost" @click="manageOpen = false">完成</button>
          </div>
        </div>

        <div class="text-box">
          <div ref="maskText" class="text-mask" v-html="highlightHtml"></div>
          <textarea
            ref="originText"
            class="text-origin"
            v-model="textValue"
            readonly
            placeholder="点击上方「导入 txt / json」，或将文件拖入此处"
            @select="onSelect"
            @scroll="syncScroll"
          ></textarea>
        </div>

        <div class="selection-bar">
          <div class="sel-info">
            <template v-if="selection">
              <span class="sel-text">“{{ selection }}”</span>
              <span class="sel-pos">{{ positionStart }} – {{ positionEnd }}</span>
            </template>
            <span v-else class="sel-empty">在文本中框选文字，按 Enter 添加为「{{ exType || '未选择类型' }}」标注</span>
          </div>
          <button class="btn btn--primary" :disabled="!canAdd" @click="addMark">添加标注<small>Enter</small></button>
        </div>
      </section>

      <!-- 右侧：标注列表 -->
      <section class="pane marks-pane">
        <div class="marks-toolbar">
          <div class="marks-nav">
            <button class="btn btn--ghost" :disabled="!marks.length" @click="stepMark(-1)" title="快捷键 [">‹ 上一条</button>
            <span class="mark-counter">{{ marks.length ? currentIndex + 1 : 0 }} / {{ marks.length }}</span>
            <button class="btn btn--ghost" :disabled="!marks.length" @click="stepMark(1)" title="快捷键 ]">下一条 ›</button>
          </div>
          <div class="marks-actions">
            <button class="btn btn--ghost" :disabled="!marks.length" @click="tidyMarks">整理标签</button>
            <button class="btn btn--ghost" :disabled="!typoIndexes.length" @click="correctAll">纠正错字</button>
            <button class="btn btn--primary" :disabled="!marks.length" @click="exportJson">导出 JSON</button>
          </div>
        </div>

        <div v-if="typeStats.length" class="legend">
          <span v-for="it in typeStats" :key="it.type" class="legend-item">
            <i :style="{ backgroundColor: colorOf(it.type) }"></i>{{ it.type }} {{ it.count }}
          </span>
        </div>

        <div class="mark-cards">
          <div
            v-for="(item, index) in marks"
            :key="item.positionStart + '-' + item.positionEnd + '-' + item.label_text"
            :ref="'card' + index"
            class="mark-card"
            :class="{
              'is-current': index === currentIndex,
              'is-covered': coveredSet.has(index),
              'is-typo': typoSet.has(index),
            }"
            @click="trackMark(index)"
          >
            <div class="mark-card-head">
              <span class="type-badge" :style="{ backgroundColor: colorOf(item.label_type) }">{{ item.label_type || '(无类型)' }}</span>
              <span class="mark-text" :title="item.label_text">{{ item.label_text }}</span>
            </div>
            <div class="mark-pos">{{ item.positionStart }} – {{ item.positionEnd }}</div>

            <div v-if="editIndex === index" class="mark-edit" @click.stop>
              <div class="edit-row">
                <label>label_type</label>
                <select v-model="editData.label_type">
                  <option v-for="t in labelTypes" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
              <div class="edit-row">
                <label>label_text</label>
                <input v-model.trim="editData.label_text" @keyup.enter="confirmEditInput(item, index)" />
              </div>
              <div class="edit-btns">
                <button class="btn btn--ghost" @click="markTypo(item, index)">标记错字</button>
                <button class="btn btn--primary" @click="confirmEditInput(item, index)">确定输入</button>
                <button class="btn btn--primary" @click="confirmEditSelect(item, index)">确定选择</button>
                <button class="btn btn--ghost" @click="cancelEdit">取消<small>Esc</small></button>
              </div>
            </div>

            <div v-else class="mark-btns" @click.stop>
              <button class="btn btn--ghost" @click="startEdit(index)">编辑</button>
              <button class="btn btn--ghost" @click="trackMark(index)">追踪</button>
              <button class="btn btn--danger" @click="removeMark(index)" title="快捷键 Delete">删除</button>
            </div>
          </div>

          <div v-if="!marks.length" class="empty-state">
            <p>暂无标注</p>
            <p class="empty-hint">导入文件后会自动按词库提取，也可在左侧框选文字手动添加</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import { toast } from '@/utils/toast'
import { readTextFile, extractFileLabel, parseImportContent } from '@/utils/fileReader'
import { getLabels, saveLabels } from '@/utils/api'
import {
  DEFAULT_LABEL_TYPES,
  colorOf,
  normalizeMarks,
  findCoveredIndexes,
  findTypoIndexes,
  extractEntities,
  buildHighlightHtml,
  applyCorrections,
  validateForExport,
} from '@/utils/annotation'

const { TYPE_ENUM, KEY_ENUM } = require('@/data/enum.json')
const extractedList = require('@/data/extracted.json')
const correctBook = require('@/data/correctBook.json')

const LABELS_CACHE_KEY = 'anno-labels'

export default {
  name: 'Home',
  data() {
    return {
      labelTypes: [], // 自定义标签类型列表（从服务或缓存加载）
      manageOpen: false, // 标签管理面板开关
      newLabel: '', // 管理面板输入的新标签名
      textValue: '', // 原文本
      selection: '', // 当前框选内容
      positionStart: 0,
      positionEnd: 0,
      marks: [], // 标注列表，恒按 positionStart 有序
      exType: '', // 当前选中的标签类型
      currentIndex: 0, // 当前追踪的下标
      editIndex: null, // 当前编辑的下标
      editData: { label_type: '', label_text: '' }, // 编辑中的数据（副本）
      fileName: '',
      isDragging: false,
      correctArr: [], // 错词本（含用户新增，仅内存）
    }
  },
  computed: {
    canAdd() {
      return Boolean(this.selection && this.exType)
    },
    coveredIndexes() {
      return findCoveredIndexes(this.marks)
    },
    coveredSet() {
      return new Set(this.coveredIndexes)
    },
    typoIndexes() {
      return findTypoIndexes(this.marks, this.correctArr)
    },
    typoSet() {
      return new Set(this.typoIndexes)
    },
    typeStats() {
      const map = {}
      this.marks.forEach((it) => {
        const key = it.label_type || '(无类型)'
        map[key] = (map[key] || 0) + 1
      })
      return Object.keys(map)
        .map((type) => ({ type, count: map[type] }))
        .sort((a, b) => b.count - a.count)
    },
    highlightHtml() {
      return buildHighlightHtml(this.textValue, this.marks, {
        typoIndexes: this.typoSet,
        currentIndex: this.currentIndex,
      })
    },
  },
  watch: {
    marks() {
      if (this.currentIndex > this.marks.length - 1) {
        this.currentIndex = Math.max(0, this.marks.length - 1)
      }
    },
  },
  mounted() {
    this.correctArr = JSON.parse(JSON.stringify(correctBook))
    this.loadLabelTypes()
    this.$refs.fileInput.addEventListener('change', this.uploadHandler)
    window.addEventListener('keydown', this.keyHandler)
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.keyHandler)
  },
  methods: {
    colorOf,

    /* ---------- 标签类型管理 ---------- */
    loadLabelTypes() {
      getLabels()
        .then((labels) => this.applyLabelTypes(labels))
        .catch(() => {
          // 本地服务不可用：使用浏览器缓存或内置默认
          let cached = null
          try {
            cached = JSON.parse(localStorage.getItem(LABELS_CACHE_KEY) || 'null')
          } catch (e) { /* 忽略缓存解析失败 */ }
          this.applyLabelTypes(Array.isArray(cached) && cached.length ? cached : DEFAULT_LABEL_TYPES)
        })
    },
    applyLabelTypes(list) {
      this.labelTypes = list
      if (!this.labelTypes.includes(this.exType)) {
        this.exType = this.labelTypes[0] || ''
      }
    },
    persistLabelTypes() {
      saveLabels(this.labelTypes)
        .then(() => toast('标签列表已保存', 'success'))
        .catch(() => {
          try {
            localStorage.setItem(LABELS_CACHE_KEY, JSON.stringify(this.labelTypes))
            toast('本地服务未启动，标签已暂存于浏览器缓存', 'warn', 4000)
          } catch (e) {
            toast('标签保存失败', 'error')
          }
        })
    },
    addLabel() {
      const name = this.newLabel
      if (!name) return
      if (this.labelTypes.includes(name)) {
        toast('该标签已存在', 'warn')
        return
      }
      this.applyLabelTypes([...this.labelTypes, name])
      this.newLabel = ''
      this.persistLabelTypes()
    },
    removeLabel(name) {
      if (this.labelTypes.length <= 1) {
        toast('至少保留一个标签', 'warn')
        return
      }
      this.applyLabelTypes(this.labelTypes.filter((t) => t !== name))
      this.persistLabelTypes()
    },
    selectType(type) {
      this.exType = type
    },

    /* ---------- 文本框选 ---------- */
    onSelect(e) {
      const el = e.target
      this.selection = el.value.substring(el.selectionStart, el.selectionEnd)
      this.positionStart = el.selectionStart
      this.positionEnd = el.selectionEnd
    },
    syncScroll(e) {
      this.$refs.maskText.scrollTop = e.target.scrollTop
      this.$refs.maskText.scrollLeft = e.target.scrollLeft
    },

    /* ---------- 添加 / 编辑 / 删除 ---------- */
    addMark() {
      if (!this.canAdd) {
        toast(!this.selection ? '请先在文本中框选内容' : '请先选择标签类型', 'warn')
        return
      }
      this.marks = normalizeMarks([...this.marks, {
        label_type: this.exType,
        label_text: this.selection,
        positionStart: this.positionStart,
        positionEnd: this.positionEnd,
      }])
      this.selection = ''
      this.positionStart = 0
      this.positionEnd = 0
      toast('已添加标注', 'success')
    },
    startEdit(index) {
      this.editIndex = index
      this.editData = { ...this.marks[index] }
    },
    cancelEdit() {
      this.editIndex = null
      this.editData = { label_type: '', label_text: '' }
    },
    // 以输入框内容确定（文本为输入值，位置从原起点按长度重算）
    confirmEditInput(item, index) {
      if (!this.editData.label_text) {
        toast('label_text 不能为空', 'warn')
        return
      }
      const next = [...this.marks]
      next[index] = {
        label_type: this.editData.label_type || item.label_type,
        label_text: this.editData.label_text,
        positionStart: item.positionStart,
        positionEnd: item.positionStart + this.editData.label_text.length,
      }
      this.marks = normalizeMarks(next)
      this.cancelEdit()
      toast('已保存修改', 'success')
    },
    // 以当前框选内容确定（文本与位置均来自框选）
    confirmEditSelect(item, index) {
      if (!this.selection) {
        toast('请先在文本中框选内容', 'warn')
        return
      }
      const next = [...this.marks]
      next[index] = {
        label_type: this.editData.label_type || item.label_type,
        label_text: this.selection,
        positionStart: this.positionStart,
        positionEnd: this.positionEnd,
      }
      this.marks = normalizeMarks(next)
      this.cancelEdit()
      toast('已保存修改', 'success')
    },
    removeMark(index) {
      const next = [...this.marks]
      next.splice(index, 1)
      this.marks = normalizeMarks(next)
      if (this.editIndex === index) this.cancelEdit()
      toast('已删除标注', 'info')
    },

    /* ---------- 追踪 ---------- */
    trackMark(index) {
      if (index < 0 || index >= this.marks.length) return
      const item = this.marks[index]
      this.currentIndex = index
      const dom = this.$refs.originText
      dom.setSelectionRange(item.positionStart, item.positionEnd)
      dom.blur()
      dom.focus()
      this.$nextTick(() => {
        const card = this.$refs['card' + index]
        if (card && card.length) card[0].scrollIntoView({ block: 'nearest' })
      })
    },
    stepMark(delta) {
      if (!this.marks.length) return
      const len = this.marks.length
      this.currentIndex = (this.currentIndex + delta + len) % len
      this.trackMark(this.currentIndex)
    },

    /* ---------- 整理 / 纠错 ---------- */
    tidyMarks() {
      const before = this.marks.length
      this.marks = normalizeMarks(this.marks)
      const removed = before - this.marks.length
      toast(removed ? `已整理：排序并移除 ${removed} 条重复/被包含的标注` : '已按位置排序', 'success')
    },
    correctAll() {
      const { applied, marks } = applyCorrections(this.marks, this.correctArr)
      this.marks = normalizeMarks(marks)
      toast(applied ? `已纠正 ${applied} 处错词` : '没有可纠正的错词', applied ? 'success' : 'info')
    },
    markTypo(item) {
      if (!this.selection) {
        toast('请先在文本中框选错词原文', 'warn')
        return
      }
      if (!this.editData.label_text) {
        toast('请在 label_text 输入正确写法', 'warn')
        return
      }
      if (this.correctArr.find((it) => it.old === this.selection)) {
        toast('错词本已存在该词', 'warn')
        return
      }
      this.correctArr.push({ old: this.selection, new: this.editData.label_text })
      toast(`已加入错词本：${this.selection} → ${this.editData.label_text}（仅本次会话生效，如需持久化请更新 src/data/correctBook.json）`, 'info', 5000)
    },

    /* ---------- 文件导入 ---------- */
    uploadHandler(e) {
      const file = e.target.files && e.target.files[0]
      if (file) this.loadFile(file)
      e.target.value = '' // 允许重复导入同一文件
    },
    onDrop(e) {
      this.isDragging = false
      const file = e.dataTransfer.files && e.dataTransfer.files[0]
      if (file) this.loadFile(file)
    },
    loadFile(file) {
      const label = extractFileLabel(file.name)
      if (extractedList.includes(label)) {
        toast(`「${label}」已在已提取列表中，请确认是否重复标注`, 'warn', 5000)
      }
      readTextFile(file)
        .then((rawText) => {
          const parsed = parseImportContent(file.name, rawText)
          this.textValue = parsed.textValue
          this.fileName = file.name
          this.selection = ''
          this.editIndex = null
          if (parsed.mode === 'annotation') {
            // 导入的是本工具导出的标注文件：恢复标注继续编辑
            this.marks = normalizeMarks(parsed.marks)
            if (this.marks.length) this.trackMark(0)
            toast(`已恢复 ${this.marks.length} 条标注，可继续标注`, 'success')
          } else {
            this.autoExtract()
          }
        })
        .catch(() => toast('文件读取失败，请确认是有效的 txt / json 文件', 'error'))
    },
    autoExtract() {
      const list = extractEntities(this.textValue, KEY_ENUM, TYPE_ENUM)
      this.marks = normalizeMarks(list)
      if (this.marks.length) this.trackMark(0)
      toast(`自动提取完成，共 ${this.marks.length} 条标注`, 'success')
    },

    /* ---------- 导出 ---------- */
    exportJson() {
      const valid = validateForExport(this.textValue, this.marks, this.coveredIndexes)
      if (!valid.ok) {
        toast(valid.message, 'warn')
        return
      }
      if (this.correctArr.length !== correctBook.length) {
        toast('本次会话新增过错词，如需持久化请手动更新 src/data/correctBook.json', 'info', 5000)
      }
      // 导出前自动应用错词纠正
      const { marks } = applyCorrections(this.marks, this.correctArr)
      const originalText = this.textValue.replace(/[\n\t]/g, '')
      const entities = marks.map((item) => ({
        label_type: item.label_type,
        label_text: item.label_text,
        start_pos: item.positionStart,
        end_pos: item.positionEnd,
      }))
      const base = (this.fileName || '未命名').replace(/\.(txt|json)$/i, '')
      const exportFromJSON = require('export-from-json')
      exportFromJSON({ data: { originalText, entities }, fileName: `${base}_extract`, exportType: 'json' })
      toast(`已导出 ${entities.length} 条标注`, 'success')
    },

    /* ---------- 快捷键 ---------- */
    keyHandler(e) {
      const inInput = e.target && e.target.tagName === 'INPUT'
      if (e.key === 'Escape') {
        this.cancelEdit()
        this.manageOpen = false
        return
      }
      if (inInput) return
      if (e.target === this.$refs.originText && e.key === 'Enter') {
        this.addMark()
        return
      }
      if (e.key === '[') this.stepMark(-1)
      else if (e.key === ']') this.stepMark(1)
      else if (e.key === 'Delete') {
        if (this.marks.length) this.removeMark(this.currentIndex)
      } else if (/^[0-9]$/.test(e.key)) {
        const inx = e.key === '0' ? 9 : Number(e.key) - 1
        if (this.labelTypes[inx]) this.selectType(this.labelTypes[inx])
      }
    },
  },
}
</script>

<style scoped lang="scss">
/* ===== 顶栏（通用样式见 global.scss） ===== */

.import-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;

  &:hover { background: var(--primary-strong); }
  &.is-dragging { background: var(--primary-strong); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25); }
}

.file-name {
  font-size: 13px;
  color: var(--muted-color);
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 工作区 ===== */
.workspace {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 14px;
  padding: 14px;
  min-height: 0;
}

.pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

/* ===== 左：编辑区 ===== */
.label-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
}

.type-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-color);
  transition: transform 0.1s, box-shadow 0.15s;

  &:hover { transform: translateY(-1px); }
  &.is-active { box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15); }
}

.chip-key {
  font-style: normal;
  font-size: 10px;
  opacity: 0.55;
}

.type-chip--manage {
  background: transparent;
  color: var(--muted-color);
  border-color: var(--border-color);

  &:hover { color: var(--primary); border-color: var(--primary); }
}

/* 标签管理面板 */
.label-manage {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg);
}

.manage-hint {
  font-size: 12px;
  color: var(--muted-color);
  margin-bottom: 8px;
}

.manage-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.manage-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
}

.chip-del {
  font-style: normal;
  cursor: pointer;
  color: var(--muted-color);
  padding: 0 2px;

  &:hover { color: var(--danger); }
}

.manage-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.manage-input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 13px;
  outline: none;

  &:focus { border-color: var(--primary); }
}

.text-box {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.text-mask,
.text-origin {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 14px 16px;
  border: none;
  box-sizing: border-box;
  font-family: Consolas, 'Courier New', 'Microsoft YaHei', monospace;
  font-size: 15px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  text-align: start;
}

.text-mask {
  z-index: 0;
  overflow: auto;
  color: transparent;
  pointer-events: none;

  ::v-deep .hl-mark { border-radius: 3px; }
  ::v-deep .hl-current { outline: 2px solid var(--primary); outline-offset: -1px; }
}

.text-origin {
  z-index: 1;
  resize: none;
  outline: none;
  background: transparent;
  color: var(--text-color);
  cursor: text;
}

.selection-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.sel-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.sel-text {
  color: var(--text-color);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sel-pos {
  font-family: Consolas, monospace;
  color: var(--muted-color);
}

.sel-empty {
  color: var(--muted-color);
}

/* ===== 右：标注列表 ===== */
.marks-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.marks-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mark-counter {
  font-size: 13px;
  color: var(--muted-color);
  font-family: Consolas, monospace;
  min-width: 52px;
  text-align: center;
}

.marks-actions {
  display: flex;
  gap: 6px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--muted-color);

  i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    display: inline-block;
  }
}

.mark-cards {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mark-card {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover { border-color: var(--primary); }

  &.is-current {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    background: #fff;
  }

  &.is-covered { border-color: #f59e0b; background: #fffbeb; }
  &.is-typo { border-color: #ec4899; }
}

.mark-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.type-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: #374151;
}

.mark-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mark-pos {
  margin-top: 4px;
  font-family: Consolas, monospace;
  font-size: 12px;
  color: var(--muted-color);
}

.mark-edit {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-color);
}

.edit-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;

  label {
    width: 70px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--muted-color);
    text-align: right;
  }

  select,
  input {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 13px;
    outline: none;

    &:focus { border-color: var(--primary); }
  }
}

.edit-btns,
.mark-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.mark-btns { justify-content: flex-end; }

.empty-state {
  margin: auto;
  text-align: center;
  color: var(--muted-color);

  p { margin: 4px 0; }
  .empty-hint { font-size: 12px; }
}
</style>
