/**
 * 并发请求队列
 * 参考 glm2api 的 ConcurrentRequestQueue，实现请求排队和并发控制
 * 
 * 核心功能：
 * 1. 限制同时发往 Qwen 上游的请求数量
 * 2. 超出并发限制的请求排队等待
 * 3. 等待超时后拒绝请求，返回明确错误
 */

const { logger } = require('./logger')

class RequestQueue {
    /**
     * @param {Object} options
     * @param {number} options.maxConcurrency - 最大并发数
     * @param {number} options.waitTimeoutMs - 排队等待超时（毫秒）
     */
    constructor(options = {}) {
        this.maxConcurrency = options.maxConcurrency || 5
        this.waitTimeoutMs = options.waitTimeoutMs || 30000
        this._active = 0
        this._queue = []
        this._nextId = 0
    }

    /**
     * 获取一个执行槽位
     * @param {string} requestName - 请求标识（用于日志）
     * @returns {Promise<{release: Function}>} 槽位句柄，用完必须调 release()
     */
    acquire(requestName) {
        return new Promise((resolve, reject) => {
            const id = ++this._nextId
            const entry = { id, requestName, resolve, reject, createdAt: Date.now() }

            if (this._active < this.maxConcurrency) {
                this._active++
                logger.info(`请求获得执行槽位 #${id} active=${this._active}/${this.maxConcurrency} request=${requestName}`, 'QUEUE')
                resolve(this._makeLease(id))
                return
            }

            // 排队
            this._queue.push(entry)
            const queuePos = this._queue.length
            logger.info(`请求进入排队 #${id} position=${queuePos} active=${this._active}/${this.maxConcurrency} request=${requestName}`, 'QUEUE')

            // 设置超时
            const timer = setTimeout(() => {
                const idx = this._queue.indexOf(entry)
                if (idx !== -1) {
                    this._queue.splice(idx, 1)
                    reject(new Error(`请求排队超时 (${this.waitTimeoutMs}ms)，前方仍有 ${this._active} 个活跃请求`))
                }
            }, this.waitTimeoutMs)

            entry.timer = timer
        })
    }

    _makeLease(id) {
        let released = false
        return {
            id,
            release: () => {
                if (released) return
                released = true
                this._release(id)
            }
        }
    }

    _release(id) {
        this._active--

        // 从队列中取下一个
        if (this._queue.length > 0) {
            const next = this._queue.shift()
            clearTimeout(next.timer)
            this._active++
            logger.info(`请求获得执行槽位 #${next.id} (从队列) active=${this._active}/${this.maxConcurrency} request=${next.requestName}`, 'QUEUE')
            next.resolve(this._makeLease(next.id))
        }

        logger.info(`请求释放槽位 #${id} active=${this._active}/${this.maxConcurrency}`, 'QUEUE')
    }

    /**
     * 获取当前队列状态
     */
    getStatus() {
        return {
            active: this._active,
            queued: this._queue.length,
            maxConcurrency: this.maxConcurrency,
        }
    }
}

// 全局单例
const defaultQueue = new RequestQueue({
    maxConcurrency: 5,   // 默认最多 5 个并发请求
    waitTimeoutMs: 30000, // 排队最多等 30 秒
})

module.exports = {
    RequestQueue,
    defaultQueue,
}
