const axios = require('axios')
const accountManager = require('./account.js')
const config = require('../config/index.js')
const { logger } = require('./logger')
const { getSsxmodItna, getSsxmodItna2 } = require('./ssxmod-manager')
const { getProxyAgent, getChatBaseUrl, applyProxyToAxiosConfig } = require('./proxy-helper')
const { generateUUID } = require('./tools.js')
const { compressPayload } = require('./message-compressor.js')
const { defaultQueue } = require('./request-queue.js')

// 传输层（非 HTTP）错误码 — 这些重试的, HTTP 响应不重试
const RETRYABLE_ERROR_CODES = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ECONNABORTED',
    'EAI_AGAIN'
])

const isRetryableNetworkError = (error) => {
    if (!error) return false
    // 已收到 HTTP 响应 = 上游回包了, 不是传输问题
    if (error.response) return false
    if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) return true
    if (typeof error.message === 'string' && error.message.includes('socket hang up')) return true
    return false
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 构建请求头（与通义千问 React Web 客户端完全一致）
 */
function buildHeaders(token) {
    const chatBaseUrl = getChatBaseUrl()
    return {
        'sec-ch-ua-platform': '"Windows"',
        'authorization': `Bearer ${token}`,
        'referer': `${chatBaseUrl}/`,
        'accept-language': 'zh-CN,zh;q=0.9',
        'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'content-type': 'application/json',
        'bx-v': '2.5.36',
        'accept': 'text/event-stream',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'source': 'web',
        'version': '0.2.63',
        'timezone': new Date().toString().replace(/GMT\+0800/, 'GMT+0800'),
        'x-request-id': generateUUID(),
        'connection': 'keep-alive',
        'cookie': `token=${token};ssxmod_itna=${getSsxmodItna()};ssxmod_itna2=${getSsxmodItna2()}`,
        'host': chatBaseUrl.replace('https://', ''),
        'origin': chatBaseUrl,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-accel-buffering': 'no',
    }
}

/**
 * 对单个账户执行一次请求尝试
 * @param {Object} account - 账户对象
 * @param {Object} payload - 请求体
 * @returns {Promise<Object>} { status, response, currentAccount, currentToken }
 */
async function tryAccount(account, payload) {
    const token = account.token
    const chatBaseUrl = getChatBaseUrl()
    const proxyAgent = getProxyAgent(account)
    const requestConfig = {
        headers: buildHeaders(token),
        responseType: 'stream',
        timeout: 60 * 1000,
    }
    if (proxyAgent) {
        requestConfig.httpsAgent = proxyAgent
        requestConfig.proxy = false
    }

    const chat_id = await generateChatID(token, payload.model, account)
    const url = `${chatBaseUrl}/api/v2/chat/completions?chat_id=` + chat_id
    const body = { ...payload, stream: true, chat_id }

    const response = await axios.post(url, body, requestConfig)
    if (response.status === 200) {
        return {
            status: true,
            response: response.data,
            currentAccount: account,
            currentToken: token,
        }
    }
    throw new Error(`Unexpected status ${response.status}`)
}

/**
 * 发送聊天请求（带并发队列 + 消息压缩 + 账号 failover）
 * @param {Object} body - 请求体
 * @param {Object} options - 可选参数
 * @param {boolean} options.skipCompress - 跳过消息压缩
 * @param {boolean} options.skipQueue - 跳过队列
 * @returns {Promise<Object>} 响应结果
 */
const sendChatRequest = async (body, options = {}) => {
    // 1. 完整 payload 压缩（除非明确跳过）
    let processedBody = body
    if (!options.skipCompress && body?.messages?.length > 5) {
        processedBody = compressPayload(body)
    }

    // 2. 获取可用账户列表
    const accountCount = accountManager.getAccountCount ? accountManager.getAccountCount() : 0
    const accounts = []
    for (let i = 0; i < Math.max(accountCount, 1); i++) {
        const acc = accountManager.getAccount()
        if (acc && acc.token) {
            accounts.push(acc)
        }
    }
    if (accounts.length === 0) {
        logger.error('没有可用的账户令牌', 'TOKEN')
        return { status: false, response: null }
    }

    // 3. 并发队列
    let lease = null
    if (!options.skipQueue) {
        try {
            lease = await defaultQueue.acquire(`chat:${processedBody.model || 'unknown'}`)
        } catch (queueErr) {
            logger.warn(`请求排队失败: ${queueErr.message}`, 'QUEUE')
            return { status: false, response: null, queueError: queueErr.message }
        }
    }

    // 4. 账号 failover：依次尝试不同账户
    let lastError = null
    const maxAttempts = Math.min(accounts.length, 3) // 最多尝试 3 个不同账户

    for (let i = 0; i < maxAttempts; i++) {
        const account = accounts[i]
        try {
            logger.network(`发送聊天请求 (account=${account.email}, attempt=${i + 1}/${maxAttempts})`, 'REQUEST')
            const result = await tryAccount(account, processedBody)
            if (lease) lease.release()
            return result
        } catch (error) {
            lastError = error
            const isNetworkErr = isRetryableNetworkError(error)
            const isHttpErr = !!error.response

            logger.warn(`账户 ${account.email} 请求失败 (attempt=${i + 1}/${maxAttempts}): ${error.message}`, 'REQUEST')

            // 标记账户失败
            if (account?.email) {
                if (isNetworkErr) {
                    accountManager.recordAccountFailure(account.email, error.code)
                } else if (isHttpErr) {
                    accountManager.recordAccountError(account.email, error.response?.status)
                }
            }

            // 如果是可重试的网络错误，继续尝试下一个账户
            if (isNetworkErr && i < maxAttempts - 1) {
                await delay(500) // 短暂等待后切换账户
                continue
            }

            // HTTP 错误（WAF/限流等）：切换账户继续尝试
            if (isHttpErr && i < maxAttempts - 1) {
                continue
            }

            // 不可重试的错误，直接退出
            break
        }
    }

    // 所有账户都失败
    if (lease) lease.release()
    if (lastError) {
        logger.error(`所有账户请求失败 (已尝试 ${maxAttempts} 个): ${lastError.message}`, 'REQUEST')
    }
    return { status: false, response: null }
}

/**
 * 生成chat_id
 * @param {string} currentToken
 * @param {string} model
 * @param {Object} [account] - 当前账户对象（用于解析账号级代理）
 * @returns {Promise<string|null>} 返回生成的chat_id，如果失败则返回null
 */
const generateChatID = async (currentToken, model, account) => {
    try {
        const chatBaseUrl = getChatBaseUrl()
        const proxyAgent = getProxyAgent(account)

        const requestConfig = {
            headers: {
                ...buildHeaders(currentToken),
                'accept': '*/*',
            }
        }

        // 添加代理配置
        if (proxyAgent) {
            requestConfig.httpsAgent = proxyAgent
            requestConfig.proxy = false
        }

        const response_data = await axios.post(`${chatBaseUrl}/api/v2/chats/new`, {
            "title": "New Chat",
            "models": [
                model
            ],
            "chat_mode": "local",
            "chat_type": "t2i",
            "timestamp": new Date().getTime()
        }, requestConfig)

        return response_data.data?.data?.id || null

    } catch (error) {
        logger.error('生成chat_id失败', 'CHAT', '', error.message)
        return null
    }
}

module.exports = {
    sendChatRequest,
    generateChatID
}
