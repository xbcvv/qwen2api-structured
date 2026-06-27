/**
 * 消息压缩器
 * 参考 glm2api 的 convert_messages()，将 OpenAI 格式消息压缩为 Qwen 友好格式
 * 
 * 核心策略：
 * 1. System prompt 抽取 + 精简（保留核心规则，删除静态规则/技能列表/文件路径）
 * 2. 消息截断：只保留最近 N 条，老消息合并为摘要
 * 3. 相邻同角色合并
 * 4. 工具结果压缩
 */

const { logger } = require('./logger')

// 默认配置
const DEFAULT_CONFIG = {
    maxSystemPromptLength: 12000,    // system prompt 最大字符数
    maxMessages: 30,                  // 最多保留消息数
    maxToolResultLength: 800,         // 单条工具结果最大字符数
    maxTotalPayloadSize: 80000,       // 总 payload 最大字节数
    oldMessageSummaryThreshold: 50,   // 超过此数量的消息，老消息压缩为摘要
}

/**
 * 压缩 system prompt
 * 删除技能列表、文件路径规则、群聊协议等静态内容，保留核心规则
 */
function compressSystemPrompt(content) {
    if (!content || typeof content !== 'string') return content

    // 如果已经很短，直接返回
    if (content.length <= DEFAULT_CONFIG.maxSystemPromptLength) return content

    // 删除技能列表（从 "## Skills" 到下一个 "##" 或文件末尾）
    let compressed = content
        // 删除技能列表段
        .replace(/## Skills \(mandatory\)[\s\S]*?(?=\n## [A-Z]|\n---|\n> |\Z)/g, '')
        // 删除详细技能描述列表（- name: ... location: ...）
        .replace(/- \*\*[^*]+\*\*:[^\n]*\n(?:\s+[^\n]+\n)*/g, '')
        // 删除文件路径规则（PATH、LOCATION 等）
        .replace(/(?:^|\n)(?:PATH|LOCATION|FILE|DIR)[^\n]{50,}/g, '')
        // 删除群聊协议引用
        .replace(/(?:^|\n)## 群聊协作规则[\s\S]*?(?=\n## [A-Z]|\n---|\n> |\Z)/g, '')
        // 删除记忆分层目录详细说明
        .replace(/(?:^|\n)## 记忆分层目录[\s\S]*?(?=\n## [A-Z]|\n---|\n> |\Z)/g, '')
        // 删除技能图谱引用
        .replace(/(?:^|\n)🗺️ 全域路牌[^\n]*/g, '')
        .replace(/(?:^|\n)📁 落盘规范[^\n]*/g, '')
        .replace(/(?:^|\n)🛠 技能图谱[^\n]*/g, '')
        // 删除 workspace 文件列表
        .replace(/(?:^|\n)## Workspace Files \(injected\)[\s\S]*?(?=\n## [A-Z]|\n---|\n> |\Z)/g, '')
        // 删除 markdown 表格
        .replace(/\|[^\n]*\|/g, '')
        // 删除多空行
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    // 如果压缩后还是太长，做硬截断
    if (compressed.length > DEFAULT_CONFIG.maxSystemPromptLength) {
        compressed = compressed.substring(0, DEFAULT_CONFIG.maxSystemPromptLength) + '\n\n[system prompt truncated]'
    }

    return compressed
}

/**
 * 合并相邻同角色消息
 */
function mergeAdjacentRoleMessages(messages) {
    if (!messages || messages.length <= 1) return messages

    const merged = []
    for (const msg of messages) {
        const last = merged[merged.length - 1]
        if (last && last.role === msg.role) {
            // 合并内容
            const lastContent = typeof last.content === 'string' ? last.content : JSON.stringify(last.content)
            const msgContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            last.content = lastContent + '\n\n' + msgContent
        } else {
            merged.push({ ...msg })
        }
    }
    return merged
}

/**
 * 压缩工具结果（截断过长内容）
 */
function compressToolResults(messages) {
    return messages.map(msg => {
        if (msg.role !== 'tool') return msg
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        if (content.length <= DEFAULT_CONFIG.maxToolResultLength) return msg
        return {
            ...msg,
            content: content.substring(0, DEFAULT_CONFIG.maxToolResultLength) + '\n\n[result truncated]'
        }
    })
}

/**
 * 截断老消息，只保留最近 N 条
 * 老消息合并为一段摘要放在 system prompt 后面
 */
function truncateOldMessages(messages, maxMessages) {
    if (messages.length <= maxMessages) return messages

    // 找到 system prompt（第一条如果是 system）
    const systemMsg = messages[0].role === 'system' ? messages[0] : null
    const nonSystemMessages = systemMsg ? messages.slice(1) : messages

    // 老消息（要压缩为摘要的）
    const oldMessages = nonSystemMessages.slice(0, nonSystemMessages.length - maxMessages)
    const recentMessages = nonSystemMessages.slice(nonSystemMessages.length - maxMessages)

    // 生成老消息摘要
    const summaryParts = oldMessages.map(m => {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        const preview = content.length > 100 ? content.substring(0, 100) + '...' : content
        return `[${m.role}] ${preview}`
    })

    const summary = summaryParts.join('\n')

    // 把摘要注入 system prompt
    if (systemMsg) {
        const summaryBlock = `\n\n## 早期对话摘要（共 ${oldMessages.length} 条消息）\n${summary}`
        const newSystem = {
            ...systemMsg,
            content: (typeof systemMsg.content === 'string' ? systemMsg.content : JSON.stringify(systemMsg.content)) + summaryBlock
        }
        return [newSystem, ...recentMessages]
    }

    // 没有 system prompt，创建一个带摘要的
    return [
        { role: 'system', content: `早期对话摘要：\n${summary}` },
        ...recentMessages
    ]
}

/**
 * 估算 payload 大小（字节）
 */
function estimatePayloadSize(messages) {
    let total = 0
    for (const msg of messages) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        total += content.length * 2 // 粗略估算：中文约 2 字节/字符
        if (msg.tool_calls) total += JSON.stringify(msg.tool_calls).length * 2
    }
    return total
}

/**
 * 主压缩函数
 * @param {Array} messages - OpenAI 格式消息数组
 * @param {Object} options - 可选配置覆盖
 * @returns {Array} 压缩后的消息数组
 */
function compressMessages(messages, options = {}) {
    if (!messages || messages.length === 0) return messages

    const config = { ...DEFAULT_CONFIG, ...options }
    let result = [...messages]

    // 1. 压缩 system prompt
    result = result.map(msg => {
        if (msg.role === 'system') {
            return { ...msg, content: compressSystemPrompt(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)) }
        }
        return msg
    })

    // 2. 压缩工具结果
    result = compressToolResults(result)

    // 3. 合并相邻同角色
    result = mergeAdjacentRoleMessages(result)

    // 4. 截断老消息
    result = truncateOldMessages(result, config.maxMessages)

    // 5. 检查总大小，如果还是太大，继续压缩
    const size = estimatePayloadSize(result)
    if (size > config.maxTotalPayloadSize) {
        logger.warn(`消息压缩后仍超过大小限制: ${size} > ${config.maxTotalPayloadSize}，进行二次压缩`, 'COMPRESS')
        // 进一步减少消息数量
        const systemMsg = result[0].role === 'system' ? result[0] : null
        const nonSystem = systemMsg ? result.slice(1) : result
        const keep = Math.max(10, Math.floor(nonSystem.length * 0.5))
        result = systemMsg
            ? [systemMsg, ...nonSystem.slice(-keep)]
            : nonSystem.slice(-keep)
    }

    const originalSize = estimatePayloadSize(messages)
    const finalSize = estimatePayloadSize(result)
    if (originalSize !== finalSize) {
        logger.info(`消息压缩: ${messages.length} 条 → ${result.length} 条, ${originalSize} → ${finalSize} 字节`, 'COMPRESS')
    }

    return result
}

module.exports = {
    compressMessages,
    compressSystemPrompt,
    mergeAdjacentRoleMessages,
    compressToolResults,
    truncateOldMessages,
    DEFAULT_CONFIG,
}
