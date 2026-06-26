const express = require('express')
const multer = require('multer')
const axios = require('axios')
const dns = require('dns').promises
const net = require('net')
const router = express.Router()
const { apiKeyVerify } = require('../middlewares/authorization.js')
const { processRequestBody } = require('../middlewares/chat-middleware.js')
const { handleChatCompletion } = require('../controllers/chat.js')
const {
    handleImageVideoCompletion,
    handleOpenAIImagesGeneration,
    handleOpenAIImagesEdit,
    handleOpenAIVideoGeneration
} = require('../controllers/chat.image.video.js')

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024
    }
})

const selectChatCompletion = (req, res, next) => {
    const ChatCompletionMap = {
        't2t': handleChatCompletion,
        'search': handleChatCompletion,
        't2i': handleImageVideoCompletion,
        't2v': handleImageVideoCompletion,
        'image_edit': handleImageVideoCompletion,
        //   'deep_research': handleDeepResearchCompletion
    }

    const chatType = req.body.chat_type
    const chatCompletion = ChatCompletionMap[chatType]
    if (chatCompletion) {
        chatCompletion(req, res, next)
    } else {
        handleImageVideoCompletion(req, res, next)
    }
}

const isPrivateIp = (ip) => {
    if (!ip) return true
    if (net.isIP(ip) === 4) {
        const parts = ip.split('.').map(Number)
        return parts[0] === 10 ||
            parts[0] === 127 ||
            parts[0] === 0 ||
            (parts[0] === 169 && parts[1] === 254) ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168)
    }
    if (net.isIP(ip) === 6) {
        const lower = ip.toLowerCase()
        return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')
    }
    return true
}

const assertSafeImageUrl = async (rawUrl) => {
    const parsed = new URL(rawUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol')
    const records = await dns.lookup(parsed.hostname, { all: true })
    if (!records.length || records.some(record => isPrivateIp(record.address))) {
        throw new Error('Unsafe image host')
    }
    return parsed.toString()
}

router.post('/v1/chat/completions',
    apiKeyVerify,
    processRequestBody,
    selectChatCompletion
)

router.get('/v1/image-proxy',
    async (req, res) => {
        try {
            const rawUrl = String(req.query.url || '')
            const safeUrl = await assertSafeImageUrl(rawUrl)

            const upstream = await axios.get(safeUrl, {
                responseType: 'stream',
                timeout: 30000,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Referer': 'https://chat.qwen.ai/'
                },
                validateStatus: status => status >= 200 && status < 400
            })

            const contentType = upstream.headers['content-type'] || 'image/jpeg'
            if (!contentType.startsWith('image/')) {
                return res.status(415).json({ error: 'Upstream is not an image' })
            }

            res.setHeader('Content-Type', contentType)
            res.setHeader('Cache-Control', 'private, max-age=300')
            upstream.data.pipe(res)
        } catch (error) {
            res.status(502).json({ error: 'Image proxy failed', message: error.message })
        }
    }
)

router.post('/v1/images/generations',
    apiKeyVerify,
    handleOpenAIImagesGeneration
)

router.post('/v1/images/edits',
    apiKeyVerify,
    upload.any(),
    handleOpenAIImagesEdit
)

router.post('/v1/videos',
    apiKeyVerify,
    upload.any(),
    handleOpenAIVideoGeneration
)


module.exports = router
