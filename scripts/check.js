/**
 * 检查提取进度：统计待提取 / 已标注文件，找出重名、重复与剩余未提取清单
 * 直接运行：node scripts/check.js
 * 被 server.js 调用：run() 返回输出行数组
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

const listDir = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
// 与前端导入提醒一致的标签提取规则："1,1-二氯乙烯中毒" -> "二氯乙烯中毒"
const toLabel = (base) => {
  const inx = base.indexOf('-')
  return inx >= 0 ? base.slice(inx + 1) : base
}
// 归一化文件名：去掉 .json 与导出后缀 _extract
const norm = (f) => f.replace(/\.json$/i, '').replace(/_extract$/i, '')

function run() {
  const lines = []
  const extractedList = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/extracted.json'), 'utf8'))
  const waitFiles = listDir(path.join(ROOT, '待提取'))
  const extractFiles = listDir(path.join(ROOT, 'src/views/extract'))
  const extractedFiles = listDir(path.join(ROOT, 'src/views/extracted'))

  const waitNames = waitFiles.map(norm)
  const doneSet = new Set([...extractFiles, ...extractedFiles].map(norm))

  lines.push(`待提取目录：${waitFiles.length} 个文件`)
  lines.push(`已标注文件：extract/ ${extractFiles.length} 个，extracted/ ${extractedFiles.length} 个`)

  // 待提取内部重名
  const dupWait = waitNames.filter((n, i) => waitNames.indexOf(n) !== i)
  if (dupWait.length) {
    lines.push(`警告：待提取目录存在重名文件 ${dupWait.length} 个：${[...new Set(dupWait)].join('、')}`)
  }

  // extract 与 extracted 之间重复
  const overlap = extractFiles.map(norm).filter((n) => extractedFiles.some((f) => norm(f) === n))
  if (overlap.length) {
    lines.push(`警告：extract/ 与 extracted/ 之间重复 ${overlap.length} 个：${[...new Set(overlap)].join('、')}`)
  }

  // 剩余未提取：不在已标注文件中，且标签不在已提取名单中
  const labelSet = new Set(extractedList)
  const remaining = waitNames.filter((n) => !doneSet.has(n) && !labelSet.has(toLabel(n)))
  lines.push(`剩余未提取：${remaining.length} 个`)
  remaining.slice(0, 30).forEach((n) => lines.push(`  - ${n}`))
  if (remaining.length > 30) lines.push(`  ... 其余 ${remaining.length - 30} 个略`)

  if (!dupWait.length && !overlap.length) lines.push('未发现重名或重复标注文件')
  return lines
}

if (require.main === module) {
  run().forEach((l) => console.log(l))
}

module.exports = { run }
