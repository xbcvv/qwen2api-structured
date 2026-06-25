const MAX_LOGS = 1000
const logs = []
let seq = 0

const mask = (value = '') => {
  const text = String(value || '').replace(/^Bearer\s+/i, '')
  if (!text) return '-'
  if (text.length <= 10) return `${text.slice(0, 2)}***${text.slice(-2)}`
  return `${text.slice(0, 6)}***${text.slice(-4)}`
}

const pickModel = (body = {}) => {
  if (body.model) return body.model
  if (body.messages?.[0]?.model) return body.messages[0].model
  return '-'
}

const classifySource = (req) => {
  const path = req.path || req.originalUrl || ''
  if (path.startsWith('/v1/')) return 'API'
  if (path.startsWith('/cli/')) return 'CLI'
  if (path.startsWith('/api/')) return 'Admin'
  return 'Web'
}

const requestLogMiddleware = (req, res, next) => {
  const path = req.path || req.originalUrl || ''
  const shouldLog = path.startsWith('/v1/') || path.startsWith('/cli/') || path === '/verify'
  if (!shouldLog) return next()

  const started = Date.now()
  res.on('finish', () => {
    const auth = req.headers.authorization || req.headers.Authorization || req.headers['x-api-key'] || ''
    const item = {
      id: ++seq,
      method: req.method,
      path: req.originalUrl?.split('?')[0] || path,
      model: pickModel(req.body),
      source: classifySource(req),
      key: mask(auth),
      statusCode: res.statusCode,
      status: res.statusCode >= 500 ? '失败' : (res.statusCode >= 400 ? '异常' : '已完成'),
      durationMs: Date.now() - started,
      createdAt: new Date().toISOString(),
      ip: req.ip || req.socket?.remoteAddress || '-',
      stream: !!req.body?.stream,
      format: req.body?.stream ? '流式' : '非流式'
    }
    logs.unshift(item)
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS
  })

  next()
}

const getRequestLogs = ({ page = 1, pageSize = 50, q = '', status = '', source = '' } = {}) => {
  const query = String(q || '').trim().toLowerCase()
  let filtered = logs
  if (query) {
    filtered = filtered.filter(item => [item.id, item.model, item.path, item.key, item.ip].some(v => String(v || '').toLowerCase().includes(query)))
  }
  if (status) filtered = filtered.filter(item => item.status === status)
  if (source) filtered = filtered.filter(item => item.source === source)
  const total = filtered.length
  const p = Math.max(1, Number(page) || 1)
  const size = Math.min(200, Math.max(1, Number(pageSize) || 50))
  const start = (p - 1) * size
  return { data: filtered.slice(start, start + size), total, page: p, pageSize: size }
}

module.exports = { requestLogMiddleware, getRequestLogs }
