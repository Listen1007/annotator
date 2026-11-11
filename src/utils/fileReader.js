/**
 * 文件读取与导入解析：txt / json 均支持，编码 UTF-8 优先、GBK 回退
 */

/**
 * 读取文件为文本：优先 UTF-8，失败时回退 GBK 解码
 * @param {File} file
 * @returns {Promise<string>} 文件文本内容
 */
export function readTextFile(file) {
  return file.arrayBuffer().then((buffer) => {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    } catch (e) {
      // UTF-8 解码失败，按 GBK（中文语料常见编码）回退
      return new TextDecoder('gbk').decode(buffer)
    }
  })
}

/** 从 "12-xxx.json" 这类文件名中取出 '-' 后的名称，用于已提取判断 */
export function extractFileLabel(fileName) {
  const base = fileName.replace(/\.json$/i, '')
  const inx = base.indexOf('-')
  return inx >= 0 ? base.slice(inx + 1) : base
}

/**
 * 解析导入内容，统一转为「可标注文本 + 可选标注列表」
 * - txt：直接作为文本
 * - 标注导出文件 {originalText, entities}：恢复文本与已有标注，继续标注
 * - 结构化 json 对象：拼接非空字符串字段为「字段名：值」的可读文本
 * @param {string} fileName
 * @param {string} rawText 已解码的文件文本
 * @returns {{mode:'text'|'annotation', textValue:string, marks?:Array}}
 */
export function parseImportContent(fileName, rawText) {
  if (/\.json$/i.test(fileName)) {
    let data
    try {
      data = JSON.parse(rawText)
    } catch (e) {
      return { mode: 'text', textValue: rawText }
    }
    // 本工具导出的标注文件：恢复继续标注
    if (data && typeof data === 'object'
      && typeof data.originalText === 'string' && Array.isArray(data.entities)) {
      const marks = data.entities
        .filter((it) => it && typeof it.label_text === 'string'
          && Number.isFinite(it.start_pos) && Number.isFinite(it.end_pos))
        .map((it) => ({
          label_type: it.label_type || '',
          label_text: it.label_text,
          positionStart: it.start_pos,
          positionEnd: it.end_pos,
        }))
      return { mode: 'annotation', textValue: data.originalText, marks }
    }
    // 结构化对象（如词典型的键值数据）：拼接为可读文本
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const parts = []
      Object.keys(data).forEach((key) => {
        const v = data[key]
        if (typeof v === 'string' && v.trim()) parts.push(`${key}：${v.trim()}`)
      })
      if (parts.length) return { mode: 'text', textValue: parts.join('\n\n') }
    }
  }
  return { mode: 'text', textValue: rawText }
}
