/**
 * 本地服务：静态托管 dist/ 构建产物，并暴露维护脚本接口
 * 用法：node server.js [端口]（默认 8090），或直接双击 启动.bat
 * 仅监听 127.0.0.1，不对外网暴露
 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')

const PORT = Number(process.argv[2]) || 8090
const NO_BROWSER = process.argv.includes('--no-browser')
const DIST = path.join(__dirname, 'dist')
const LABELS_PATH = path.join(__dirname, 'src/data/labels.json')
const DEFAULT_LABELS = require('./src/data/labels.json')

// 维护任务注册表：key 与前端 src/utils/api.js 对应
const MAINTAIN_TASKS = {
  check: { label: '检查提取进度', module: './scripts/check' },
  merge: { label: '回填词库', module: './scripts/get' },
  clean: { label: '清除待删除实体', module: './scripts/del' },
  list: { label: '更新已提取名单', module: './scripts/isExtract' },
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function runMaintainTask(name) {
  const task = MAINTAIN_TASKS[name]
  if (!task) throw new Error(`未知的维护任务：${name}`)
  // 清除缓存，保证每次执行都读取磁盘上的最新数据
  const modPath = require.resolve(task.module)
  delete require.cache[modPath]
  const mod = require(modPath)
  if (typeof mod.run !== 'function') throw new Error(`脚本 ${task.module} 缺少 run() 导出`)
  return { label: task.label, lines: mod.run() }
}

function serveStatic(req, res, urlPath) {
  let filePath = path.join(DIST, urlPath)
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  if (urlPath === '/' || urlPath === '') filePath = path.join(DIST, 'index.html')
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // 前端为 hash 路由，未知路径回退到入口页
      filePath = path.join(DIST, 'index.html')
      if (!fs.existsSync(filePath)) {
        res.writeHead(404).end('dist/index.html not found, run `npm run build` first')
        return
      }
    }
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(res)
  })
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function getLabels() {
  try {
    return JSON.parse(fs.readFileSync(LABELS_PATH, 'utf8'))
  } catch (e) {
    return DEFAULT_LABELS
  }
}

async function handleLabels(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, { ok: true, labels: getLabels() })
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: '请使用 GET 或 POST' })
  const body = await readBody(req)
  let labels
  try {
    labels = JSON.parse(body).labels
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: '请求体不是合法的 JSON' })
  }
  if (!Array.isArray(labels) || !labels.every((t) => typeof t === 'string' && t.trim() && t.length <= 30)) {
    return sendJson(res, 400, { ok: false, error: '标签列表格式不正确' })
  }
  const cleaned = [...new Set(labels.map((t) => t.trim()))]
  if (!cleaned.length) return sendJson(res, 400, { ok: false, error: '至少保留一个标签' })
  fs.writeFileSync(LABELS_PATH, JSON.stringify(cleaned, null, 2))
  return sendJson(res, 200, { ok: true, labels: cleaned })
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0])

  if (urlPath === '/api/health') {
    return sendJson(res, 200, { ok: true })
  }

  if (urlPath === '/api/labels') {
    return handleLabels(req, res).catch((e) => sendJson(res, 500, { ok: false, error: e.message }))
  }

  const m = urlPath.match(/^\/api\/maintain\/(\w+)$/)
  if (m) {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: '请使用 POST' })
    try {
      const result = runMaintainTask(m[1])
      return sendJson(res, 200, Object.assign({ ok: true }, result))
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message })
    }
  }

  serveStatic(req, res, urlPath)
})

function openBrowser(url) {
  const cmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
  const shell = process.platform === 'win32' ? 'cmd.exe' : undefined
  exec(cmd, { shell }, (err) => {
    if (err) console.log(`浏览器未能自动打开，请手动访问：${url}`)
  })
}

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`
  console.log(`通用标注工具已启动：${url}`)
  console.log('维护页面：' + url + '/#/maintain')
  console.log('按 Ctrl+C 停止服务')
  if (!NO_BROWSER) openBrowser(url)
})
