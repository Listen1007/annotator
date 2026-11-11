/**
 * 与本地 server.js 的接口通信
 * 若页面由纯静态服务器托管（无后端），请求会失败并由调用方提示
 */

export async function checkBackend() {
  try {
    const res = await fetch('api/health')
    return res.ok
  } catch (e) {
    return false
  }
}

function parseBody(res) {
  return res.json().catch(() => ({})).then((body) => {
    if (!res.ok || !body.ok) throw new Error(body.error || `请求失败（${res.status}）`)
    return body
  })
}

export function runMaintain(name) {
  return fetch(`api/maintain/${name}`, { method: 'POST' }).then(parseBody)
}

/** 获取自定义标签列表 */
export function getLabels() {
  return fetch('api/labels')
    .then(parseBody)
    .then((body) => body.labels)
}

/** 保存自定义标签列表 */
export function saveLabels(labels) {
  return fetch('api/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels }),
  }).then(parseBody)
}
