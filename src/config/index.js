const dotenv = require('dotenv')
dotenv.config()

const parseKeyList = (value) => {
    if (!value) return []
    return String(value).split(',').map(key => key.trim()).filter(key => key.length > 0)
}

/**
 * 管理员登录密钥与下游 API Key 分离：
 * - ADMIN_KEY：只用于 Web 管理后台和 /api/* 管理接口
 * - API_KEYS / API_KEY：只用于 OpenAI-compatible 下游接口
 * 兼容旧环境：未设置 ADMIN_KEY 时，仍以 API key 列表第一个作为 adminKey。
 */
const parseApiKeys = () => {
    const downstreamKeys = parseKeyList(process.env.API_KEYS || process.env.API_KEY)
    const explicitAdminKey = (process.env.ADMIN_KEY || '').trim()
    const adminKey = explicitAdminKey || (downstreamKeys.length > 0 ? downstreamKeys[0] : 'admin')
    const apiKeys = explicitAdminKey
        ? downstreamKeys.filter(key => key !== explicitAdminKey)
        : downstreamKeys

    return { apiKeys, adminKey }
}

const { apiKeys, adminKey } = parseApiKeys()

const config = {
    dataSaveMode: process.env.DATA_SAVE_MODE || "none",
    apiKeys: apiKeys,
    adminKey: adminKey,
    batchLoginConcurrency: Math.max(1, parseInt(process.env.BATCH_LOGIN_CONCURRENCY) || 5),
    simpleModelMap: process.env.SIMPLE_MODEL_MAP === 'true' ? true : false,
    listenAddress: process.env.LISTEN_ADDRESS || null,
    listenPort: process.env.SERVICE_PORT || 3000,
    searchInfoMode: process.env.SEARCH_INFO_MODE === 'table' ? "table" : "text",
    outThink: process.env.OUTPUT_THINK === 'true' ? true : false,
    redisURL: process.env.REDIS_URL || null,
    autoRefresh: true,
    autoRefreshInterval: 6 * 60 * 60,
    cacheMode: process.env.CACHE_MODE || "default",
    logLevel: process.env.LOG_LEVEL || "INFO",
    enableFileLog: process.env.ENABLE_FILE_LOG === 'true',
    logDir: process.env.LOG_DIR || "./logs",
    maxLogFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE) || 10,
    maxLogFiles: parseInt(process.env.MAX_LOG_FILES) || 5,
    // 自定义反代URL配置
    qwenChatProxyUrl: process.env.QWEN_CHAT_PROXY_URL || "https://chat.qwen.ai",
    qwenCliProxyUrl: process.env.QWEN_CLI_PROXY_URL || "https://portal.qwen.ai",
    // 代理配置
    proxyUrl: process.env.PROXY_URL || null,
    // chat 请求重试配置（运行时可被 web UI 覆盖，见 src/utils/data-persistence.js#loadSettings）
    chatRetryCount: Math.max(0, parseInt(process.env.CHAT_RETRY_COUNT, 10) || 1),
    chatRetryBackoffMs: Math.max(0, parseInt(process.env.CHAT_RETRY_BACKOFF_MS, 10) || 400)
}

module.exports = config
