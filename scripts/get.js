/**
 * 回填词库：汇总 src/views/extract/ 下所有标注文件的实体，
 * 将新词条合并进 src/data/enum.json 的类型词表
 * 直接运行：node scripts/get.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function run() {
  const lines = []
  const enumPath = path.join(ROOT, 'src/data/enum.json')
  const enumData = JSON.parse(fs.readFileSync(enumPath, 'utf8'))
  const dir = path.join(ROOT, 'src/views/extract')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : []

  if (!files.length) {
    lines.push('src/views/extract/ 目录下没有标注文件，无需回填')
    return lines
  }

  let added = 0
  const newWords = []
  files.forEach((f) => {
    let data
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    } catch (e) {
      lines.push(`跳过无法解析的文件：${f}`)
      return
    }
    ;(data.entities || []).forEach((it) => {
      const group = enumData.TYPE_ENUM.find((g) => g.label_type === it.label_type)
      if (group && !group.label_list.includes(it.label_text)) {
        group.label_list.push(it.label_text)
        newWords.push(`${it.label_text}（${it.label_type}）`)
        added++
      }
    })
  })

  const KEY_ENUM = []
  enumData.TYPE_ENUM.forEach((g) => g.label_list.forEach((w) => KEY_ENUM.push(w)))
  fs.writeFileSync(enumPath, JSON.stringify({ TYPE_ENUM: enumData.TYPE_ENUM, KEY_ENUM }))
  lines.push(`已处理 ${files.length} 个标注文件，回填 ${added} 个新词条，词库共 ${KEY_ENUM.length} 个关键词`)
  newWords.slice(0, 30).forEach((w) => lines.push(`  + ${w}`))
  if (newWords.length > 30) lines.push(`  ... 其余 ${newWords.length - 30} 个略`)
  return lines
}

if (require.main === module) {
  run().forEach((l) => console.log(l))
}

module.exports = { run }
