/**
 * 标注核心算法：自动提取、排序去重、覆盖检测、高亮渲染、错词纠正
 * 全部为纯函数，不依赖 Vue 实例
 */

/** 默认标签类型列表（labels.json 不可用时的兑底） */
export const DEFAULT_LABEL_TYPES = [
  '临床表现', '疾病', '组织部位', '人体系统', '化学物质', '药品',
  '食物', '防护用品', '环境', '常见急救方法', '检查检验',
  '治疗方式', '侵入途径', '程度', '待删除',
]

/** 内置标签类型对应的高亮色板，自定义标签按名称哈希生成柔和色 */
const LABEL_COLORS = {
  临床表现: '#ffd6d6',
  疾病: '#ffe8c2',
  组织部位: '#d9f2d9',
  人体系统: '#d6f0ff',
  化学物质: '#e6dcff',
  药品: '#dcf8f1',
  食物: '#fdeff2',
  防护用品: '#e8f4d9',
  环境: '#fff3c4',
  常见急救方法: '#ffe0ee',
  检查检验: '#e2ecff',
  治疗方式: '#f0e6d2',
  侵入途径: '#d8e8ec',
  程度: '#efe3ff',
  待删除: '#e0e0e0',
}

/** 获取标签类型对应颜色：内置色板优先，否则按名称哈希生成 */
export function colorOf(type) {
  if (LABEL_COLORS[type]) return LABEL_COLORS[type]
  let h = 0
  for (const ch of String(type)) h = (h * 31 + ch.codePointAt(0)) % 360
  return `hsl(${h}, 65%, 82%)`
}

/** 是否为完全相同的重复标注 */
function sameMark(a, b) {
  return a.positionStart === b.positionStart
    && a.positionEnd === b.positionEnd
    && a.label_type === b.label_type
}

/**
 * 排序 + 去重 + 去除被完全包含的标注（保留外层较长的）
 * 返回新数组，不修改入参
 */
export function normalizeMarks(marks) {
  const sorted = [...marks].sort((a, b) =>
    a.positionStart - b.positionStart || b.positionEnd - a.positionEnd
  )
  const result = []
  sorted.forEach((mark) => {
    // 跳过完全重复项
    if (result.length && sameMark(result[result.length - 1], mark)) return
    // 跳过被前一项完全包含的项
    const prev = result[result.length - 1]
    if (prev
      && mark.positionStart >= prev.positionStart
      && mark.positionEnd <= prev.positionEnd) return
    result.push({ ...mark })
  })
  return result
}

/**
 * 找出被其他标注完全包含的标注下标（重叠告警用）
 */
export function findCoveredIndexes(marks) {
  const covered = []
  marks.forEach((item, index) => {
    const { positionStart: s, positionEnd: e } = item
    if (marks.some((it, inx) => inx !== index
      && s >= it.positionStart && e <= it.positionEnd)) {
      covered.push(index)
    }
  })
  return covered
}

/**
 * 自动提取：在文本中查找所有关键词出现位置
 * @param {string} text 原文本
 * @param {string[]} keyEnum 关键词列表
 * @param {Array<{label_type:string,label_list:string[]}>} typeEnum 类型词表
 * @param {string[]} [banLabel] 排除的关键词
 */
export function extractEntities(text, keyEnum, typeEnum, banLabel = []) {
  if (!text) return []
  const banSet = new Set(banLabel)
  // 关键词 -> 类型 的映射表，避免循环内反复 find
  const typeMap = {}
  typeEnum.forEach((group) => {
    group.label_list.forEach((word) => {
      if (!(word in typeMap)) typeMap[word] = group.label_type
    })
  })
  const marks = []
  keyEnum.forEach((word) => {
    if (!word || banSet.has(word)) return
    const type = typeMap[word]
    if (!type) return // 词表中无类型的关键词跳过，避免报错
    let inx = text.indexOf(word)
    while (inx !== -1) {
      marks.push({
        label_type: type,
        label_text: word,
        positionStart: inx,
        positionEnd: inx + word.length,
      })
      inx = text.indexOf(word, inx + word.length)
    }
  })
  return marks
}

/**
 * 生成高亮 HTML（用于覆盖在 textarea 上的同步层）
 * @param {string} text 原文本
 * @param {Array} marks 已按 positionStart 排序的标注
 * @param {Object} [opts] { typoIndexes:Set 错词标注下标, currentIndex:当前追踪下标 }
 */
export function buildHighlightHtml(text, marks, opts = {}) {
  const { typoIndexes = new Set(), currentIndex = -1 } = opts
  if (!marks.length) return escapeHtml(text)
  let html = ''
  let cursor = 0
  marks.forEach((mark, i) => {
    // 重叠时收敛起点，高亮始终使用原文切片，保证与 textarea 逐字对齐
    const segStart = Math.max(cursor, mark.positionStart)
    const segEnd = Math.min(mark.positionEnd, text.length)
    if (segStart >= segEnd) return
    html += escapeHtml(text.slice(cursor, segStart))
    const color = typoIndexes.has(i) ? '#ff9ec4' : colorOf(mark.label_type)
    const isCurrent = i === currentIndex
    html += `<span class="hl-mark${isCurrent ? ' hl-current' : ''}" style="background-color:${color}">`
      + escapeHtml(text.slice(segStart, segEnd)) + '</span>'
    cursor = Math.max(cursor, segEnd)
  })
  html += escapeHtml(text.slice(cursor))
  return html
}

/** HTML 转义 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 应用错词本纠正：替换 label_text 并同步 positionEnd
 * @returns {{applied:number, marks:Array}} 纠正后的新数组
 */
export function applyCorrections(marks, correctBook) {
  const dict = new Map(correctBook.map((it) => [it.old, it.new]))
  let applied = 0
  const next = marks.map((mark) => {
    const newWord = dict.get(mark.label_text)
    if (!newWord) return mark
    applied++
    return {
      ...mark,
      label_text: newWord,
      positionEnd: mark.positionStart + newWord.length,
    }
  })
  return { applied, marks: next }
}

/** 找出命中错词本的标注下标 */
export function findTypoIndexes(marks, correctBook) {
  const dict = new Set(correctBook.map((it) => it.old))
  return marks
    .map((mark, index) => (dict.has(mark.label_text) ? index : -1))
    .filter((i) => i >= 0)
}

/**
 * 导出数据校验
 * @returns {{ok:boolean, message:string}} 校验结果
 */
export function validateForExport(originalText, marks, coveredIndexes) {
  if (!originalText || !originalText.trim()) {
    return { ok: false, message: '原文本为空，请先导入或输入文本' }
  }
  if (!marks.length) return { ok: false, message: '标记列表为空' }
  if (marks.some((it) => !it.label_type)) {
    return { ok: false, message: '存在 label_type 为空的标注，请先补全' }
  }
  if (marks.some((it) => it.label_text.includes('"'))) {
    return { ok: false, message: 'label_text 不能包含英文双引号' }
  }
  if (coveredIndexes.length) {
    return { ok: false, message: `存在 ${coveredIndexes.length} 条被包含的重叠标注，请先“整理标签”` }
  }
  return { ok: true, message: '' }
}
