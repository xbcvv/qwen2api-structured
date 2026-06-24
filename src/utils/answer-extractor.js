const stripThinkBlocks = (text) => {
    if (!text) return text
    return String(text).replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

const looksLikeReasoningPrefix = (text) => {
    if (!text) return false
    return /^(?:Thinking Process|Process|Analysis|Analyze the Request|Determine the Answer|Draft the Response|Final Selection|Check Constraints|Execute)\b/i.test(String(text).trim())
}

const stripReasoningPrefix = (text) => {
    if (!text) return text
    const value = String(text).trim()
    const patterns = [
        /^(?:Thinking Process|Process|Analysis|Analyze the Request|Determine the Answer|Draft the Response|Final Selection|Check Constraints|Execute)\b[\s\S]*?(?:\n\s*\n)([\s\S]+)$/i,
        /^\s*(?:\d+\.\s+|[-*]\s+)(?:\*\*)?[A-Za-z][\s\S]*?(?:\n\s*\n)([\s\S]+)$/i,
    ]
    for (const pattern of patterns) {
        const match = value.match(pattern)
        if (match && match[1] && match[1].trim().length > 0) {
            return match[1].trim()
        }
    }
    return value
}

const cleanAnswerContent = (text, outThink) => {
    let value = stripThinkBlocks(text || '')
    if (outThink === false && looksLikeReasoningPrefix(value)) {
        value = stripReasoningPrefix(value)
    }
    return value || null
}

module.exports = {
    stripThinkBlocks,
    stripReasoningPrefix,
    looksLikeReasoningPrefix,
    cleanAnswerContent,
}
