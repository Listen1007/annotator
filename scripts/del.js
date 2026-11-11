/**
 * 清除待删除实体：移除 src/views/extract/ 下标注文件中
 * label_type 为「待删除」的实体并写回
 * 直接运行：node scripts/del.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function run() {
  const lines = []
  const dir = path.join(ROOT, 'src/views/extract')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : []

  if (!files.length) {
    lines.push('src/views/extract/ 目录下没有标注文件，无需处理')
    return lines
  }

  let total = 0
  let touched = 0
  files.forEach((f) => {
    const filePath = path.join(dir, f)
    let data
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (e) {
      lines.push(`跳过无法解析的文件：${f}`)
      return
    }
    const before = (data.entities || []).length
    data.entities = (data.entities || []).filter((it) => it.label_type !== '待删除')
    const removed = before - data.entities.length
    if (removed) {
      fs.writeFileSync(filePath, JSON.stringify(data))
      total += removed
      touched++
    }
  })
  lines.push(`已处理 ${files.length} 个文件，其中 ${touched} 个文件共移除 ${total} 条「待删除」实体`)
  return lines
}

if (require.main === module) {
  run().forEach((l) => console.log(l))
}

module.exports = { run }
