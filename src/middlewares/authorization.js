const config = require('../config')

/**
 * 验证API Key是否有效
 * @param {string} providedKey - 提供的API Key
 * @returns {Object} 验证结果 { isValid: boolean, isAdmin: boolean }
 */
const validateApiKey = (providedKey) => {
  if (!providedKey) {
    return { isValid: false, isAdmin: false }
  }

  // 移除Bearer前缀
  const cleanKey = providedKey.startsWith('Bearer ') ? providedKey.slice(7) : providedKey

  // 管理员密钥验证：只检查 adminKey
  const isAdmin = cleanKey === config.adminKey && !!config.adminKey

  // 普通API Key验证：检查 apiKeys 列表 或 adminKey 本身也有效
  const isDownstreamKey = config.apiKeys.includes(cleanKey)
  const isValid = isAdmin || isDownstreamKey

  return { isValid, isAdmin }
}

/**
 * API Key验证中间件 - 只验证下游 API Key（用于 /v1/*、/cli/* 等外部调用接口）
 */
const apiKeyVerify = (req, res, next) => {
  const apiKey = req.headers['authorization'] || req.headers['Authorization'] || req.headers['x-api-key']
  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const cleanKey = apiKey.startsWith('Bearer ') ? apiKey.slice(7) : apiKey
  const isAdmin = cleanKey === config.adminKey && !!config.adminKey
  const isDownstreamKey = config.apiKeys.includes(cleanKey)

  if (!isAdmin && !isDownstreamKey) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  req.isAdmin = isAdmin
  req.apiKey = apiKey
  next()
}

/**
 * 管理员权限验证中间件 - 只允许管理员API Key（用于管理接口）
 */
const adminKeyVerify = (req, res, next) => {
  const apiKey = req.headers['authorization'] || req.headers['Authorization'] || req.headers['x-api-key']
  const { isValid, isAdmin } = validateApiKey(apiKey)

  if (!isValid || !isAdmin) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  req.isAdmin = isAdmin
  req.apiKey = apiKey
  next()
}

module.exports = {
  apiKeyVerify,
  adminKeyVerify,
  validateApiKey
}
