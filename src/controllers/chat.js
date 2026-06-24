const { isJson, generateUUID } = require('../utils/tools.js')
const { createUsageObject } = require('../utils/precise-tokenizer.js')
const { sendChatRequest } = require('../utils/request.js')
const { createToolCallStreamParser, parseToolCallsFromText } = require('../utils/tool-prompt.js')
const accountManager = require('../utils/account.js')
const config = require('../config/index.js')
const axios = require('axios')
const { logger } = require('../utils/logger')
const { cleanAnswerContent, stripReasoningPrefix, looksLikeReasoningPrefix } = require('../utils/answer-extractor.js')

/**
 * 设置响应头
 * @param {object} res - Express 响应对象
 * @param {boolean} stream - 是否流式响应
 */
const setResponseHeaders = (res, stream) => {
    try {
        if (stream) {
            res.set({
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            })
        } else {
            res.set({
                'Content-Type': 'application/json',
            })
        }
    } catch (e) {
        logger.error('处理聊天请求时发生错误', 'CHAT', '', e)
    }
}

const getImageMarkdownListFromDelta = (delta) => {
    // 常规聊天在触发 image_gen_tool 时，仅使用 image_list 中用于展示的图片链接
    const imageList = []
    const displayImages = delta?.extra?.image_list || []

    for (const item of displayImages) {
        if (item?.image) {
            imageList.push(`![image](${item.image})`)
        }
    }

    return imageList
}

/**
 * 判断 tool_choice 是否要求强制调用工具
 * @param {string|Object} toolChoice - OpenAI tool_choice
 * @returns {boolean} 是否需要至少一次工具调用
 */
const requiresToolCall = (toolChoice) => {
    if (toolChoice === 'required') return true
    if (toolChoice && typeof toolChoice === 'object' && toolChoice.type === 'function' && toolChoice.function?.name) {
        return true
    }
    return false
}

/**
 * 构建 tool_choice=required 重试时追加的强约束提示
 * @param {string|Object} toolChoice - OpenAI tool_choice
 * @returns {string} 重试提示词
 */
const buildRequiredRetryHint = (toolChoice) => {
    if (toolChoice && typeof toolChoice === 'object' && toolChoice.function?.name) {
        return `You did not call any tool in your previous reply. You MUST now call the tool \`${toolChoice.function.name}\` using the <tool_call>...</tool_call> format and nothing else.`
    }
    return 'You did not call any tool in your previous reply. You MUST now call exactly one tool using the <tool_call>...</tool_call> format and nothing else.'
}

const attributeChatUsage = (account, usage) => {
    if (!account || !account.email || !usage) return
    try {
        accountManager.accumulateStats(account.email, 'chat', {
            input: Number(usage.prompt_tokens) || 0,
            output: Number(usage.completion_tokens) || 0
        })
    } catch (e) {
        // 静默——stats 累计失败不应中断响应
    }
}
const createPhaseAccumulator = () => ({
    think: '',
    answer: '',
    unknown: '',
    raw: '',
    rawEvents: [],
    rawTail: '',
    parseErrors: [],
    webSearchInfo: null,
    imageMarkdownSet: new Set(),
    imageMarkdownList: []
})
const appendImageMarkdown = (accumulator, imageMarkdownList) => {
    if (!imageMarkdownList || imageMarkdownList.length === 0) return
    for (const item of imageMarkdownList) {
        if (!accumulator.imageMarkdownSet.has(item)) {
            accumulator.imageMarkdownSet.add(item)
            accumulator.imageMarkdownList.push(item)
        }
    }
}

const redactSensitive = (value) => {
    if (!value) return ''
    return String(value)
        .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '***JWT_REDACTED***')
        .replace(/(authorization|api[_-]?key|token|secret|password)("?\s*[:=]\s*"?)[^,"\s}]+/ig, '$1$2***REDACTED***')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '***EMAIL_REDACTED***')
}

const pushRawEvent = (accumulator, dataContent) => {
    const redacted = redactSensitive(dataContent)
    accumulator.rawTail = redacted.slice(-1200)
    if (accumulator.rawEvents.length < 5) {
        accumulator.rawEvents.push(redacted.slice(0, 1200))
    }
}

const buildUpstreamErrorMessage = (accumulator, totalTokens = {}) => {
    const thinkLen = accumulator.think?.length || 0
    const answerLen = accumulator.answer?.length || 0
    const unknownLen = accumulator.unknown?.length || 0
    const rawEventCount = accumulator.rawEvents?.length || 0
    const promptTokens = totalTokens.prompt_tokens || 0
    const completionTokens = totalTokens.completion_tokens || 0

    let reason = '上游未返回可用正文。'
    if (rawEventCount === 0 && !accumulator.rawTail) {
        reason = '上游 SSE 连接结束，但没有返回任何 data 事件。'
    } else if (thinkLen === 0 && answerLen === 0 && unknownLen === 0) {
        reason = '上游返回了 SSE data，但没有可解析的 delta.content。'
    } else if (answerLen === 0 && thinkLen > 0) {
        reason = '上游只返回了 think 内容，没有返回 answer 内容。'
    }

    const details = [
        `reason=${reason}`,
        `phase_lengths={think:${thinkLen},answer:${answerLen},unknown:${unknownLen}}`,
        `usage={prompt_tokens:${promptTokens},completion_tokens:${completionTokens}}`,
    ]

    if (accumulator.parseErrors?.length) {
        details.push(`parse_errors=${accumulator.parseErrors.slice(-3).join(' | ')}`)
    }
    if (accumulator.rawTail) {
        details.push(`raw_tail=${accumulator.rawTail}`)
    } else if (rawEventCount > 0) {
        details.push(`raw_first=${accumulator.rawEvents[0]}`)
    }

    return `上游错误：${details.join('; ')}`
}
const appendDeltaToAccumulator = (accumulator, delta) => {
    if (delta && delta.name === 'web_search') {
        accumulator.webSearchInfo = delta.extra?.web_search_info || accumulator.webSearchInfo
    }

    appendImageMarkdown(accumulator, getImageMarkdownListFromDelta(delta))

    if (!delta || !delta.content) return
    const content = delta.content
    accumulator.raw += content
    if (delta.phase === 'think') {
        accumulator.think += content
    } else if (delta.phase === 'answer') {
        accumulator.answer += content
    } else {
        accumulator.unknown += content
    }
}
const buildOpenAIContentFromAccumulator = async (accumulator, enable_thinking) => {
    let answerContent = cleanAnswerContent(accumulator.answer || accumulator.unknown || '', config.outThink)

    if (accumulator.imageMarkdownList.length > 0) {
        const imageContent = accumulator.imageMarkdownList.join('\n\n')
        answerContent = answerContent ? `${imageContent}\n\n${answerContent}` : imageContent
    }

    if ((config.outThink === false || !enable_thinking) && accumulator.webSearchInfo && config.searchInfoMode === "text") {
        const webSearchTable = await accountManager.generateMarkdownTable(accumulator.webSearchInfo, "text")
        answerContent = answerContent ? `${answerContent}\n\n---\n${webSearchTable}` : webSearchTable
    }

    if (config.outThink !== false && enable_thinking && accumulator.think && accumulator.think.trim()) {
        let thinkContent = accumulator.think.trim()
        if (accumulator.webSearchInfo) {
            const webSearchTable = await accountManager.generateMarkdownTable(accumulator.webSearchInfo, config.searchInfoMode)
            thinkContent = `${webSearchTable}\n\n${thinkContent}`
        }
        return `<think>\n\n${thinkContent}\n\n</think>\n${answerContent || ''}`
    }

    return answerContent
}
const consumeUpstreamToAccumulator = (upstreamResponse, accumulator, totalTokensRef) => new Promise((resolve, reject) => {
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    upstreamResponse.on('data', (chunk) => {
        const decodeText = decoder.decode(chunk, { stream: true })
        buffer += decodeText

        const chunks = []
        let startIndex = 0

        while (true) {
            const dataStart = buffer.indexOf('data: ', startIndex)
            if (dataStart === -1) break
            const dataEnd = buffer.indexOf('\n\n', dataStart)
            if (dataEnd === -1) break
            const dataChunk = buffer.substring(dataStart, dataEnd).trim()
            chunks.push(dataChunk)
            startIndex = dataEnd + 2
        }

        if (startIndex > 0) {
            buffer = buffer.substring(startIndex)
        }

        for (const item of chunks) {
            try {
                const dataContent = item.replace("data: ", '')
                pushRawEvent(accumulator, dataContent)
                const decodeJson = isJson(dataContent) ? JSON.parse(dataContent) : null
                if (decodeJson === null) {
                    accumulator.parseErrors.push(`non_json:${redactSensitive(dataContent).slice(0, 200)}`)
                    continue
                }
                if (decodeJson.error) {
                    accumulator.parseErrors.push(`upstream_error:${redactSensitive(JSON.stringify(decodeJson.error)).slice(0, 300)}`)
                }
                if (!decodeJson.choices || decodeJson.choices.length === 0) {
                    continue
                }

                if (decodeJson.usage) {
                    totalTokensRef.value = {
                        prompt_tokens: decodeJson.usage.prompt_tokens || totalTokensRef.value.prompt_tokens,
                        completion_tokens: decodeJson.usage.completion_tokens || totalTokensRef.value.completion_tokens,
                        total_tokens: decodeJson.usage.total_tokens || totalTokensRef.value.total_tokens
                    }
                }

                appendDeltaToAccumulator(accumulator, decodeJson.choices[0].delta)
            } catch (error) {
                logger.error('SSE 数据结构化解析错误', 'CHAT', '', error)
            }
        }
    })

    upstreamResponse.on('end', () => resolve())
    upstreamResponse.on('error', (err) => reject(err))
})
const getPromptText = (requestBody) => {
    if (!requestBody || !Array.isArray(requestBody.messages)) return ''
    return requestBody.messages.map(msg => {
        if (typeof msg.content === 'string') return msg.content
        if (Array.isArray(msg.content)) return msg.content.map(item => item.text || '').join('')
        return ''
    }).join('\n')
}

/**
 * 处理流式响应
 * 策略：为兼容 AxonHub，立即发送 role + 零宽心跳；随后完整读取上游，结构化清洗后输出最终内容。
 * 这样既避免长时间无 SSE 内容被判 empty，也避免 think 内容提前泄漏。
 */
const handleStreamResponse = async (res, response, enable_thinking, enable_web_search, requestBody = null, options = {}) => {
    try {
        const message_id = generateUUID()
        const hasTools = !!options.has_tools
        const toolChoice = options.tool_choice
        const accumulator = createPhaseAccumulator()
        const totalTokensRef = { value: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
        const promptText = getPromptText(requestBody)

        const writeJSON = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)
        const baseChunk = () => ({
            id: `chatcmpl-${message_id}`,
            object: 'chat.completion.chunk',
            created: Math.round(Date.now() / 1000),
        })

        // AxonHub empty-response guard: send role and an invisible content delta immediately.
        writeJSON({ ...baseChunk(), choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })
        writeJSON({ ...baseChunk(), choices: [{ index: 0, delta: { content: '\u200b' }, finish_reason: null }] })

        await consumeUpstreamToAccumulator(response, accumulator, totalTokensRef)

        let finalContent = await buildOpenAIContentFromAccumulator(accumulator, enable_thinking)
        let toolCalls = []
        if (hasTools) {
            const parsed = parseToolCallsFromText(finalContent || '')
            finalContent = parsed.cleanedText
            toolCalls = parsed.toolCalls
        }

        if (hasTools && toolCalls.length === 0 && requiresToolCall(toolChoice)) {
            const retryHint = buildRequiredRetryHint(toolChoice)
            const retryBody = {
                ...requestBody,
                messages: [
                    ...(Array.isArray(requestBody?.messages) ? requestBody.messages : []),
                    { role: 'system', content: retryHint }
                ]
            }
            logger.warning?.('tool_choice=required 首次未触发工具调用，进行一次重试', 'CHAT')
            try {
                const retryResp = await sendChatRequest(retryBody)
                if (retryResp.status && retryResp.response) {
                    const retryAccumulator = createPhaseAccumulator()
                    await consumeUpstreamToAccumulator(retryResp.response, retryAccumulator, totalTokensRef)
                    const retryContent = await buildOpenAIContentFromAccumulator(retryAccumulator, enable_thinking)
                    const parsedRetry = parseToolCallsFromText(retryContent || '')
                    if (parsedRetry.toolCalls.length > 0) {
                        finalContent = parsedRetry.cleanedText
                        toolCalls = parsedRetry.toolCalls
                        accumulator.raw += retryAccumulator.raw
                    }
                }
            } catch (e) {
                logger.error('required 模式重试失败', 'CHAT', '', e)
            }
        }

        if (!finalContent && toolCalls.length === 0) {
            finalContent = buildUpstreamErrorMessage(accumulator, totalTokensRef.value)
            logger.warning?.(`流式响应内容为空，返回上游错误详情: ${finalContent}`, 'CHAT')
        }

        if (finalContent) {
            writeJSON({ ...baseChunk(), choices: [{ index: 0, delta: { content: finalContent }, finish_reason: null }] })
        }

        if (toolCalls.length > 0) {
            const deltaToolCalls = toolCalls.map(call => ({
                index: call.index,
                id: call.id,
                type: call.type,
                function: call.function
            }))
            writeJSON({ ...baseChunk(), choices: [{ index: 0, delta: { tool_calls: deltaToolCalls }, finish_reason: null }] })
        }

        let totalTokens = totalTokensRef.value
        if (totalTokens.prompt_tokens === 0 && totalTokens.completion_tokens === 0) {
            totalTokens = createUsageObject(requestBody?.messages || promptText, accumulator.raw || finalContent || '', null)
            logger.info(`流式使用tiktoken计算 - Prompt: ${totalTokens.prompt_tokens}, Completion: ${totalTokens.completion_tokens}, Total: ${totalTokens.total_tokens}`, 'CHAT')
        } else {
            logger.info(`流式使用上游真实Token - Prompt: ${totalTokens.prompt_tokens}, Completion: ${totalTokens.completion_tokens}, Total: ${totalTokens.total_tokens}`, 'CHAT')
        }

        totalTokens.prompt_tokens = Math.max(0, totalTokens.prompt_tokens || 0)
        totalTokens.completion_tokens = Math.max(0, totalTokens.completion_tokens || 0)
        totalTokens.total_tokens = totalTokens.prompt_tokens + totalTokens.completion_tokens
        attributeChatUsage(options.currentAccount, totalTokens)

        const finishReason = toolCalls.length > 0 ? 'tool_calls' : 'stop'
        writeJSON({ ...baseChunk(), choices: [{ index: 0, delta: {}, finish_reason: finishReason }] })
        writeJSON({ ...baseChunk(), choices: [], usage: totalTokens })
        res.write('data: [DONE]\n\n')
        res.end()
    } catch (error) {
        logger.error('聊天处理错误', 'CHAT', '', error)
        try { res.status(500).json({ error: 'Service error' }) } catch (_) { /* response already started */ }
    }
}

/**
 * 处理非流式响应（从流式数据累积完整响应）
 * @param {object} res - Express 响应对象
 * @param {object} response - 上游响应流
 * @param {boolean} enable_thinking - 是否启用思考模式
 * @param {boolean} enable_web_search - 是否启用网络搜索
 * @param {string} model - 模型名称
 * @param {object} requestBody - 原始请求体，用于提取prompt信息
 * @param {object} [options] - 扩展选项
 * @param {boolean} [options.has_tools] - 是否启用工具调用解析
 */
const handleNonStreamResponse = async (res, response, enable_thinking, enable_web_search, model, requestBody = null, options = {}) => {
    try {
        const accumulator = createPhaseAccumulator()
        const totalTokensRef = { value: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
        const hasTools = !!options.has_tools
        const toolChoice = options.tool_choice
        const promptText = getPromptText(requestBody)

        await consumeUpstreamToAccumulator(response, accumulator, totalTokensRef)

        let assistantContent = await buildOpenAIContentFromAccumulator(accumulator, enable_thinking)
        let toolCalls = []
        if (hasTools) {
            const parsed = parseToolCallsFromText(assistantContent || '')
            assistantContent = parsed.cleanedText
            toolCalls = parsed.toolCalls
        }

        if (hasTools && toolCalls.length === 0 && requiresToolCall(toolChoice)) {
            const retryHint = buildRequiredRetryHint(toolChoice)
            const retryBody = {
                ...requestBody,
                messages: [
                    ...(Array.isArray(requestBody?.messages) ? requestBody.messages : []),
                    { role: 'system', content: retryHint }
                ]
            }
            logger.warning?.('tool_choice=required 首次未触发工具调用，进行一次重试', 'CHAT')
            try {
                const retryResp = await sendChatRequest(retryBody)
                if (retryResp.status && retryResp.response) {
                    const retryAccumulator = createPhaseAccumulator()
                    await consumeUpstreamToAccumulator(retryResp.response, retryAccumulator, totalTokensRef)
                    const retryContent = await buildOpenAIContentFromAccumulator(retryAccumulator, enable_thinking)
                    const parsedRetry = parseToolCallsFromText(retryContent || '')
                    if (parsedRetry.toolCalls.length > 0) {
                        toolCalls = parsedRetry.toolCalls
                        assistantContent = parsedRetry.cleanedText
                        accumulator.raw += retryAccumulator.raw
                    }
                }
            } catch (e) {
                logger.error('required 模式重试失败', 'CHAT', '', e)
            }
        }

        let totalTokens = totalTokensRef.value
        if (totalTokens.prompt_tokens === 0 && totalTokens.completion_tokens === 0) {
            totalTokens = createUsageObject(requestBody?.messages || promptText, accumulator.raw || assistantContent || '', null)
            logger.info(`非流式使用tiktoken计算 - Prompt: ${totalTokens.prompt_tokens}, Completion: ${totalTokens.completion_tokens}, Total: ${totalTokens.total_tokens}`, 'CHAT')
        } else {
            logger.info(`非流式使用上游真实Token - Prompt: ${totalTokens.prompt_tokens}, Completion: ${totalTokens.completion_tokens}, Total: ${totalTokens.total_tokens}`, 'CHAT')
        }

        totalTokens.prompt_tokens = Math.max(0, totalTokens.prompt_tokens || 0)
        totalTokens.completion_tokens = Math.max(0, totalTokens.completion_tokens || 0)
        totalTokens.total_tokens = totalTokens.prompt_tokens + totalTokens.completion_tokens

        // Fallback for empty response: return upstream details, not a generic local message
        if (!assistantContent && toolCalls.length === 0) {
            assistantContent = buildUpstreamErrorMessage(accumulator, totalTokens)
            logger.warning?.(`非流式响应内容为空，返回上游错误详情: ${assistantContent}`, 'CHAT')
        }

        attributeChatUsage(options.currentAccount, totalTokens)

        const assistantMessage = { role: 'assistant', content: assistantContent || null }
        if (toolCalls.length > 0) {
            assistantMessage.tool_calls = toolCalls
        }

        res.json({
            "id": `chatcmpl-${generateUUID()}`,
            "object": "chat.completion",
            "created": Math.round(new Date().getTime() / 1000),
            "model": model,
            "choices": [{
                "index": 0,
                "message": assistantMessage,
                "finish_reason": toolCalls.length > 0 ? "tool_calls" : "stop"
            }],
            "usage": totalTokens
        })
    } catch (error) {
        logger.error('非流式聊天处理错误', 'CHAT', '', error)
        res.status(500).json({ error: "Service error" })
    }
}


/**
 * 主要的聊天完成处理函数
 * @param {object} req - Express 请求对象
 * @param {object} res - Express 响应对象
 */
const handleChatCompletion = async (req, res) => {
    const { stream, model } = req.body

    const enable_thinking = req.enable_thinking
    const enable_web_search = req.enable_web_search

    try {
        const response_data = await sendChatRequest(req.body)

        if (!response_data.status || !response_data.response) {
            res.status(500)
                .json({
                    error: "Request failed"
                })
            return
        }

        if (stream) {
            setResponseHeaders(res, true)
            await handleStreamResponse(res, response_data.response, enable_thinking, enable_web_search, req.body, { has_tools: req.has_tools, tool_choice: req.tool_choice, currentAccount: response_data.currentAccount })
        } else {
            setResponseHeaders(res, false)
            await handleNonStreamResponse(res, response_data.response, enable_thinking, enable_web_search, model, req.body, { has_tools: req.has_tools, tool_choice: req.tool_choice, currentAccount: response_data.currentAccount })
        }

    } catch (error) {
        logger.error('聊天处理错误', 'CHAT', '', error)
        res.status(500)
            .json({
                error: "Invalid token, request failed"
            })
    }
}

module.exports = {
    handleChatCompletion,
    handleStreamResponse,
    handleNonStreamResponse,
    setResponseHeaders
}
