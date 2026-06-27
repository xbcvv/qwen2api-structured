const { generateUUID } = require('../utils/tools.js')
const { isChatType, isThinkingEnabled, parserModel, parserMessages } = require('../utils/chat-helpers.js')
const { buildToolSystemPrompt, foldToolMessages } = require('../utils/tool-prompt.js')
const { logger } = require('../utils/logger')
const { compressMessages } = require('../utils/message-compressor.js')

/**
 * 处理聊天请求体的中间件
 * 解析和转换请求参数为内部格式
 */
const processRequestBody = async (req, res, next) => {
  try {
    // 获取请求体原始数据
    let {
      messages,            // 消息历史
      model,               // 模型
      stream,              // 流式输出
      enable_thinking,     // 是否启用思考
      thinking_budget,      // 思考预算
      size,                  //图片尺寸
      tools,                // 工具列表（OpenAI function calling）
      tool_choice           // 工具调用控制
    } = req.body

    const now = Math.floor(Date.now() / 1000)
    const fid = generateUUID()
    const thinkingConfig = isThinkingEnabled(model, enable_thinking, thinking_budget)

    // 构建请求体 — 对齐 React 前端格式
    const body = {
      stream: stream !== false,
      version: '2.1',
      incremental_output: true,
      chat_id: null,                    // 由 sendChatRequest 填充
      chat_mode: 'normal',
      model: await parserModel(model),
      parent_id: null,
      messages: [{
        fid: fid,
        parentId: null,
        childrenIds: [],
        role: 'user',                   // 取最后一条消息的角色
        content: '',                    // 由下方 parserMessages 填充
        user_action: 'chat',
        files: [],
        timestamp: now,
        models: [await parserModel(model)],
        chat_type: isChatType(model),
        feature_config: {
          thinking_enabled: thinkingConfig.thinking_enabled,
          research_mode: 'normal',
          auto_thinking: true,
          thinking_mode: 'Auto',
          thinking_format: 'detail',
          auto_search: true
        },
        extra: { meta: { subChatType: isChatType(model) } },
        sub_chat_type: isChatType(model)
      }],
      timestamp: now
    }

    // 处理 stream 参数
    if (stream === true || stream === 'true') {
      body.stream = true
    } else {
      body.stream = false
    }

    // 在进入 Qwen 格式转换前，先压缩 OpenAI 格式的 messages
    // 避免大 payload（>100条消息、33K system prompt、11个 tools）触发 Qwen WAF
    if (messages && messages.length > 30) {
      const compressedMessages = compressMessages(messages)
      if (compressedMessages.length !== messages.length) {
        logger.info(`中间件消息压缩: ${messages.length} 条 → ${compressedMessages.length} 条`, 'MIDDLEWARE')
      }
      messages = compressedMessages
      // 同步处理 tools（如果很多）
      if (Array.isArray(tools) && tools.length > 5) {
        tools = tools.map(t => {
          if (!t.function?.description) return t
          if (t.function.description.length > 200) {
            return { ...t, function: { ...t.function, description: t.function.description.substring(0, 200) + '...' } }
          }
          return t
        })
        logger.info(`中间件 tools 压缩: ${tools.length} 个`, 'MIDDLEWARE')
      }
    }

    // 处理 tools 参数 : 通过提示词为网页版模型注入工具调用能力
    const chatType = isChatType(model)
    const hasTools = Array.isArray(tools) && tools.length > 0 && chatType === 't2t'
    let preparedMessages = messages
    let toolSystemPrompt = ''
    if (hasTools) {
      toolSystemPrompt = buildToolSystemPrompt(tools, { tool_choice })
      preparedMessages = foldToolMessages(messages || [])
      req.has_tools = true
      req.tool_choice = tool_choice || 'auto'
    } else {
      req.has_tools = false
    }

    // 处理 messages 参数 : 消息历史（返回 OpenAI 格式消息数组）
    const parsedMessages = await parserMessages(preparedMessages, thinkingConfig, chatType)

    // 将解析后的消息填充到 React UI 格式的消息对象中
    // 取最后一条用户消息作为主消息内容，历史消息通过 content 传递
    const lastMessage = parsedMessages[parsedMessages.length - 1] || { role: 'user', content: '' }
    body.messages[0].role = lastMessage.role || 'user'
    body.messages[0].content = lastMessage.content || ''
    body.messages[0].chat_type = chatType
    body.messages[0].sub_chat_type = chatType
    body.messages[0].feature_config.thinking_enabled = thinkingConfig.thinking_enabled

    // 工具提示词拼接到用户消息内容上
    if (hasTools && toolSystemPrompt) {
      const msgContent = body.messages[0].content
      if (typeof msgContent === 'string') {
        body.messages[0].content = `${toolSystemPrompt}\n\n${msgContent}`
      } else if (Array.isArray(msgContent)) {
        const textIdx = msgContent.findIndex(c => c?.type === 'text')
        if (textIdx >= 0) {
          msgContent[textIdx].text = `${toolSystemPrompt}\n\n${msgContent[textIdx].text || ''}`
        } else {
          msgContent.unshift({ type: 'text', text: toolSystemPrompt })
        }
      }
    }

    // 保存完整消息历史供下游使用（用于多轮对话上下文）
    req.parsed_messages = parsedMessages
    req.enable_web_search = chatType === 'search' ? true : false

    // 顶层 chat_type 供路由选择器使用 (selectChatCompletion)
    body.chat_type = chatType

    // 处理图片尺寸
    if (size) {
      body.size = size
    }

    // 处理请求体,将body赋值给req.body
    req.body = body

    next()
  } catch (e) {
    logger.error('处理请求体时发生错误', 'MIDDLEWARE', '', e)
    res.status(500)
      .json({
        status: 500,
        message: "在处理请求体时发生错误 ~ ~ ~"
      })
  }
}

module.exports = {
  processRequestBody
}
