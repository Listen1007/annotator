/**
 * 更新已提取名单：以 中毒1_part1/ 样例目录为准，
 * 重算 src/data/extracted.json（用于前端导入文件时的重复提醒）
 * 直接运行：node scripts/isExtract.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

// 与前端 extractFileLabel 一致的标签提取规则
const toLabel = (base) => {
  const inx = base.indexOf('-')
  return inx >= 0 ? base.slice(inx + 1) : base
}

function run() {
  const lines = []
  const sampleDir = path.join(ROOT, '中毒1_part1')
  if (!fs.existsSync(sampleDir)) {
    lines.push('未找到样例目录 中毒1_part1/，无法更新')
    return lines
  }
  const labels = fs.readdirSync(sampleDir)
    .map((f) => f.replace(/\.(json|txt)$/i, ''))
    .map(toLabel)

  const outPath = path.join(ROOT, 'src/data/extracted.json')
  const before = JSON.parse(fs.readFileSync(outPath, 'utf8')).length
  fs.writeFileSync(outPath, JSON.stringify(labels))
  lines.push(`已提取名单更新：${before} → ${labels.length} 条（依据 中毒1_part1/ 目录）`)
  return lines
}

if (require.main === module) {
  run().forEach((l) => console.log(l))
}

module.exports = { run }
