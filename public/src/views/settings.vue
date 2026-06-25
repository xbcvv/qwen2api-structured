<template>
    <div class="page-fill overflow-y-auto p-4">
        <div class="container mx-auto">
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 px-4 space-y-4 md:space-y-0 pt-5">
                <h1 class="text-2xl font-bold text-[#2d2a24]">{{ t('settings.title') }}</h1>
                <div class="flex items-center space-x-3">
                    <router-link to="/"
                        class="action-button font-bold border border-[#c8b9a8] bg-[#f5f0e8] text-[#7a5e3f] px-4 py-2 rounded-xl shadow-sm hover:bg-[#ede5d8] hover:border-[#b56535] transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 text-center text-sm">
                        {{ t('settings.backToDash') }}
                    </router-link>
                    <LangSwitcher />
                </div>
            </div>
            <div class="grid grid-cols-1 gap-6 p-4">
                <!-- API Key 管理 -->
                <div class="setting-card relative overflow-hidden rounded-2xl p-6 flex flex-col gap-4 bg-white border border-[#e3ded6]">
                    <div class="absolute inset-0 bg-[#fdfcfa]/50 backdrop-blur-md border border-[#e3ded6]/60 rounded-2xl"></div>
                    <div class="relative flex flex-col gap-5">
                        <div>
                            <label class="text-gray-800 font-semibold text-lg">{{ t('settings.apiKeyTitle') }}</label>
                            <p class="text-sm text-gray-500 mt-1">{{ t('settings.keyManagerHint') }}</p>
                        </div>

                        <!-- 管理员密钥 -->
                        <div class="rounded-2xl border border-[#e8d5b0] bg-[#fef9f1] p-4">
                            <div class="flex items-center justify-between gap-3 mb-3">
                                <div>
                                    <div class="text-[#9a6020] font-semibold">{{ t('settings.adminKeyTitle') }}</div>
                                    <div class="text-xs text-gray-500 mt-1">{{ t('settings.adminKeyHint') }}</div>
                                </div>
                                <span v-if="settings.adminKeySet" class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">{{ t('settings.adminKeySet') }}</span>
                                <span v-else class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">{{ t('settings.adminKeyUnset') }}</span>
                            </div>
                            <div class="flex flex-col md:flex-row gap-2">
                                <input :value="visibleAdminKey ? revealed.admin : settings.adminKeyMasked" readonly
                                    class="flex-1 rounded-lg border border-[#ddd6cc] bg-white shadow-sm h-10 text-sm px-3 font-mono">
                                <input v-model="newAdminKey" type="password" :placeholder="t('settings.adminKeyInput')"
                                    class="flex-1 rounded-lg border border-[#ddd6cc] bg-white shadow-sm h-10 text-sm px-3 font-mono">
                            </div>
                            <div class="flex flex-wrap gap-2 mt-3">
                                <button @click="saveAdminKey" class="key-btn primary-key-btn">{{ t('settings.edit') }}</button>
                                <button @click="toggleRevealAdmin" class="key-btn">{{ visibleAdminKey ? t('settings.hide') : t('settings.view') }}</button>
                                <button @click="copyAdminKey" class="key-btn">{{ t('settings.copy') }}</button>
                                <button @click="rotateAdminKey" class="key-btn warn-key-btn">{{ t('settings.rotate') }}</button>
                                <button @click="deleteAdminKey" class="key-btn danger-key-btn">{{ t('settings.delete') }}</button>
                            </div>
                        </div>

                        <!-- 下游密钥列表 -->
                        <div class="rounded-2xl border border-[#e3ded6] bg-white p-4">
                            <div class="flex items-center justify-between gap-3 mb-3">
                                <div>
                                    <div class="text-gray-800 font-semibold">{{ t('settings.regularKeys') }}</div>
                                    <div class="text-xs text-gray-500 mt-1">{{ t('settings.regularKeysHint') }}</div>
                                </div>
                                <button @click="addRegularKey(true)" class="key-btn primary-key-btn">{{ t('settings.generate') }}</button>
                            </div>

                            <div class="flex flex-col md:flex-row gap-2 mb-3">
                                <input v-model="newApiKey" type="password" :placeholder="t('settings.addKeyPlaceholder')"
                                    class="flex-1 rounded-lg border border-[#ddd6cc] bg-white shadow-sm h-10 text-sm px-3 font-mono">
                                <button @click="addRegularKey(false)" class="key-btn primary-key-btn">{{ t('settings.add') }}</button>
                            </div>

                            <div v-if="settings.regularKeyItems.length === 0" class="text-gray-500 text-center py-4">
                                {{ t('settings.noKeys') }}
                            </div>

                            <div v-for="item in settings.regularKeyItems" :key="item.index"
                                class="flex flex-col gap-2 bg-[#fbfaf7] border border-[#e3ded6] rounded-xl p-3 mb-2">
                                <div class="flex flex-col md:flex-row gap-2">
                                    <input :value="visibleRegularKeys[item.index] ? revealed.regular[item.index] : item.masked" readonly
                                        class="flex-1 rounded-lg border border-[#ddd6cc] bg-white shadow-sm h-10 text-sm px-3 font-mono">
                                    <input v-model="editRegularKeys[item.index]" type="password" :placeholder="t('settings.newKeyPlaceholder')"
                                        class="flex-1 rounded-lg border border-[#ddd6cc] bg-white shadow-sm h-10 text-sm px-3 font-mono">
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    <button @click="updateRegularKey(item.index)" class="key-btn primary-key-btn">{{ t('settings.edit') }}</button>
                                    <button @click="toggleRevealRegular(item.index)" class="key-btn">{{ visibleRegularKeys[item.index] ? t('settings.hide') : t('settings.view') }}</button>
                                    <button @click="copyRegularKey(item.index)" class="key-btn">{{ t('settings.copy') }}</button>
                                    <button @click="rotateRegularKey(item.index)" class="key-btn warn-key-btn">{{ t('settings.rotate') }}</button>
                                    <button @click="deleteRegularKey(item.index)" class="key-btn danger-key-btn">{{ t('settings.delete') }}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 其他设置项 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- 自动刷新 -->
                    <div class="setting-card relative overflow-hidden rounded-2xl p-6 flex flex-col gap-4 bg-white border border-[#e3ded6]">
                        <div class="absolute inset-0 bg-[#fdfcfa]/50 backdrop-blur-md border border-[#e3ded6]/60 rounded-2xl">
                        </div>
                        <div class="relative flex flex-col gap-2">
                            <label class="text-gray-700 font-semibold">{{ t('settings.autoRefresh') }}</label>
                            <div class="flex items-center gap-2">
                                <input v-model="settings.autoRefresh" type="checkbox"
                                    class="h-5 w-5 rounded border-[#c8b9a8] accent-[#b56535]">
                                <span>{{ t('settings.enableAutoRefresh') }}</span>
                            </div>
                            <label class="text-gray-700">{{ t('settings.refreshInterval') }}</label>
                            <input v-model.number="settings.autoRefreshInterval" type="number"
                                class="mt-1 block w-full rounded-xl border-[#ddd6cc] bg-white shadow-sm focus:border-[#b56535] outline-none transition-all duration-300 h-12 text-base px-4">
                            <button @click="saveAutoRefresh"
                                class="w-full mt-2 bg-[#b56535] text-white rounded-lg py-2 hover:bg-[#9f532d] border border-[#b56535] transition-all duration-300">{{ t('settings.save') }}</button>
                        </div>
                    </div>
                    <!-- 批量登录并发数 -->
                    <div class="setting-card relative overflow-hidden rounded-2xl p-6 flex flex-col gap-4 bg-white border border-[#e3ded6]">
                        <div class="absolute inset-0 bg-[#fdfcfa]/50 backdrop-blur-md border border-[#e3ded6]/60 rounded-2xl">
                        </div>
                        <div class="relative flex flex-col gap-2">
                            <label class="text-gray-700 font-semibold">{{ t('settings.batchConcurrency') }}</label>
                            <label class="text-gray-700">{{ t('settings.batchConcurrencyDesc') }}</label>
                            <input v-model.number="settings.batchLoginConcurrency" type="number" min="1" max="20"
                                class="mt-1 block w-full rounded-xl border-[#ddd6cc] bg-white shadow-sm focus:border-[#b56535] outline-none transition-all duration-300 h-12 text-base px-4">
                            <span class="text-xs text-gray-500">{{ t('settings.batchConcurrencyHint') }}</span>
                            <button @click="saveBatchLoginConcurrency"
                                class="w-full mt-2 bg-[#b56535] text-white rounded-lg py-2 hover:bg-[#9f532d] border border-[#b56535] transition-all duration-300">{{ t('settings.save') }}</button>
                        </div>
                    </div>
                    <!-- 思考输出 -->
                    <div class="setting-card relative overflow-hidden rounded-2xl p-6 flex flex-col gap-4 bg-white border border-[#e3ded6]">
                        <div class="absolute inset-0 bg-[#fdfcfa]/50 backdrop-blur-md border border-[#e3ded6]/60 rounded-2xl">
                        </div>
                        <div class="relative flex flex-col gap-2">
                            <label class="text-gray-700 font-semibold">{{ t('settings.thinkOutput') }}</label>
                            <div class="flex items-center gap-2">
                                <input v-model="settings.outThink" type="checkbox"
                                    class="h-5 w-5 rounded border-[#c8b9a8] accent-[#b56535]">
                                <span>{{ t('settings.enableThinkOutput') }}</span>
                            </div>
                            <button @click="saveOutThink"
                                class="w-full mt-2 bg-[#b56535] text-white rounded-lg py-2 hover:bg-[#9f532d] border border-[#b56535] transition-all duration-300">{{ t('settings.save') }}</button>
                        </div>
                    </div>
                    <!-- 搜索信息模式 -->
                    <div class="setting-card relative overflow-hidden rounded-2xl p-6 flex flex-col gap-4 bg-white border border-[#e3ded6]">
                        <div class="absolute inset-0 bg-[#fdfcfa]/50 backdrop-blur-md border border-[#e3ded6]/60 rounded-2xl">
                        </div>
                        <div class="relative flex flex-col gap-2">
                            <label class="text-gray-700 font-semibold">{{ t('settings.searchMode') }}</label>
                            <select v-model="settings.searchInfoMode"
                                class="mt-1 block w-full rounded-xl border-[#ddd6cc] bg-white shadow-sm focus:border-[#b56535] outline-none transition-all duration-300 h-12 text-base px-4">
                                <option value="table">{{ t('settings.searchTable') }}</option>
                                <option value="text">{{ t('settings.searchText') }}</option>
                            </select>
                            <button @click="saveSearchInfoMode"
                                class="w-full mt-2 bg-[#b56535] text-white rounded-lg py-2 hover:bg-[#9f532d] border border-[#b56535] transition-all duration-300">{{ t('settings.save') }}</button>
                        </div>
                    </div>
                    <!-- 简化模型映射 -->
                    <div class="setting-card relative overflow-hidden rounded-2xl p-6 flex flex-col gap-4 bg-white border border-[#e3ded6]">
                        <div class="absolute inset-0 bg-[#fdfcfa]/50 backdrop-blur-md border border-[#e3ded6]/60 rounded-2xl">
                        </div>
                        <div class="relative flex flex-col gap-2">
                            <label class="text-gray-700 font-semibold">{{ t('settings.simpleModelMap') }}</label>
                            <div class="flex items-center gap-2">
                                <input v-model="settings.simpleModelMap" type="checkbox"
                                    class="h-5 w-5 rounded border-[#c8b9a8] accent-[#b56535]">
                                <span>{{ t('settings.simpleModelMapDesc') }}</span>
                            </div>
                            <button @click="saveSimpleModelMap"
                                class="w-full mt-2 bg-[#b56535] text-white rounded-lg py-2 hover:bg-[#9f532d] border border-[#b56535] transition-all duration-300">{{ t('settings.save') }}</button>
                        </div>
                    </div>
                    <!-- 会话流式默认设置 -->
                    <div class="setting-card relative overflow-hidden rounded-2xl p-6 flex flex-col gap-4 border border-[#e6ddd0] bg-[#fbfaf7]">
                        <div class="absolute inset-0 bg-gradient-to-br from-[#fffaf2]/80 to-white/60 rounded-2xl"></div>
                        <div class="relative flex flex-col gap-4">
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <label class="text-gray-800 font-semibold">{{ t('settings.chatStreamTitle') }}</label>
                                    <p class="text-sm text-gray-500 mt-1">{{ t('settings.chatStreamDesc') }}</p>
                                </div>
                                <button
                                    type="button"
                                    @click="settings.chatStreamDefault = !settings.chatStreamDefault"
                                    :class="[
                                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                                        settings.chatStreamDefault ? 'bg-[#b86b3b]' : 'bg-gray-300'
                                    ]"
                                >
                                    <span
                                        :class="[
                                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200',
                                            settings.chatStreamDefault ? 'translate-x-5' : 'translate-x-0'
                                        ]"
                                    ></span>
                                </button>
                            </div>
                            <div class="rounded-xl border border-[#eadfce] bg-white/70 px-4 py-3 text-sm text-gray-600">
                                {{ settings.chatStreamDefault ? t('settings.chatStreamOn') : t('settings.chatStreamOff') }}
                            </div>
                            <span class="text-xs text-gray-500">{{ t('settings.chatStreamHint') }}</span>
                            <button @click="saveChatStream"
                                class="w-full mt-1 bg-[#b86b3b] text-white rounded-lg py-2 hover:bg-[#9f5930] border border-[#b86b3b] transition-all duration-300">{{ t('settings.save') }}</button>
                        </div>
                    </div>
                    <!-- 聊天请求 retry 配置 -->
                    <div class="setting-card relative overflow-hidden rounded-2xl p-6 flex flex-col gap-4 bg-white border border-[#e3ded6]">
                        <div class="absolute inset-0 bg-[#fdfcfa]/50 backdrop-blur-md border border-[#e3ded6]/60 rounded-2xl">
                        </div>
                        <div class="relative flex flex-col gap-2">
                            <label class="text-gray-700 font-semibold">{{ t('settings.retryTitle') }}</label>
                            <label class="text-gray-700">{{ t('settings.retryCountLabel') }}</label>
                            <input v-model.number="settings.chatRetryCount" type="number" min="0" max="10"
                                class="mt-1 block w-full rounded-xl border-[#ddd6cc] bg-white shadow-sm focus:border-[#b56535] outline-none transition-all duration-300 h-12 text-base px-4">
                            <label class="text-gray-700">{{ t('settings.retryBackoffLabel') }}</label>
                            <input v-model.number="settings.chatRetryBackoffMs" type="number" min="0" max="60000"
                                class="mt-1 block w-full rounded-xl border-[#ddd6cc] bg-white shadow-sm focus:border-[#b56535] outline-none transition-all duration-300 h-12 text-base px-4">
                            <span class="text-xs text-gray-500">{{ t('settings.retryHint') }}</span>
                            <button @click="saveRetryConfig"
                                class="w-full mt-2 bg-[#b56535] text-white rounded-lg py-2 hover:bg-[#9f532d] border border-[#b56535] transition-all duration-300">{{ t('settings.save') }}</button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import LangSwitcher from '../components/LangSwitcher.vue'

const { t } = useI18n()

const settings = ref({
    adminKeySet: false,
    adminKeyHint: '',
    regularKeys: [],
    regularKeyItems: [],
    adminKeyMasked: '',
    defaultHeaders: '',
    defaultCookie: '',
    autoRefresh: false,
    autoRefreshInterval: 21600,
    batchLoginConcurrency: 5,
    outThink: false,
    searchInfoMode: 'table',
    simpleModelMap: false,
    chatStreamDefault: true,
    chatRetryCount: 1,
    chatRetryBackoffMs: 400
})

const newApiKey = ref('')
const newAdminKey = ref('')
const visibleAdminKey = ref(false)
const visibleRegularKeys = ref({})
const revealed = ref({ admin: '', regular: {} })
const editRegularKeys = ref({})

const loadSettings = async () => {
    try {
        const res = await axios.get('/api/settings', {
            headers: {
                'Authorization': localStorage.getItem('adminKey') || ''
            }
        })
        settings.value.adminKeySet = res.data.adminKeySet
        settings.value.adminKeyHint = res.data.adminKeyHint || ''
        settings.value.adminKeyMasked = res.data.adminKeyMasked || res.data.adminKeyHint || ''
        settings.value.regularKeys = res.data.regularKeys || []
        settings.value.regularKeyItems = res.data.regularKeyItems || []
        settings.value.defaultHeaders = JSON.stringify(res.data.defaultHeaders)
        settings.value.defaultCookie = res.data.defaultCookie
        settings.value.autoRefresh = res.data.autoRefresh
        settings.value.autoRefreshInterval = res.data.autoRefreshInterval
        settings.value.batchLoginConcurrency = res.data.batchLoginConcurrency
        settings.value.outThink = res.data.outThink
        settings.value.searchInfoMode = res.data.searchInfoMode
        settings.value.simpleModelMap = res.data.simpleModelMap
        if (res.data.chatStreamDefault !== undefined) settings.value.chatStreamDefault = res.data.chatStreamDefault
        if (res.data.chatRetryCount !== undefined) settings.value.chatRetryCount = res.data.chatRetryCount
        if (res.data.chatRetryBackoffMs !== undefined) settings.value.chatRetryBackoffMs = res.data.chatRetryBackoffMs
    } catch (error) {
        console.error('loadSettings error:', error)
    }
}

const saveAutoRefresh = async () => {
    try {
        await axios.post('/api/setAutoRefresh', {
            autoRefresh: settings.value.autoRefresh,
            autoRefreshInterval: settings.value.autoRefreshInterval
        }, {
            headers: { 'Authorization': localStorage.getItem('adminKey') || '' }
        })
        alert(t('smsg.autoRefreshSaved'))
    } catch (error) {
        alert(t('smsg.autoRefreshFailed') + error.message)
    }
}
const saveBatchLoginConcurrency = async () => {
    try {
        await axios.post('/api/setBatchLoginConcurrency', {
            batchLoginConcurrency: settings.value.batchLoginConcurrency
        }, {
            headers: { 'Authorization': localStorage.getItem('adminKey') || '' }
        })
        alert(t('smsg.batchSaved'))
    } catch (error) {
        alert(t('smsg.batchFailed') + error.message)
    }
}
const saveOutThink = async () => {
    try {
        await axios.post('/api/setOutThink', { outThink: settings.value.outThink }, {
            headers: { 'Authorization': localStorage.getItem('adminKey') || '' }
        })
        alert(t('smsg.thinkSaved'))
    } catch (error) {
        alert(t('smsg.thinkFailed') + error.message)
    }
}
const saveSearchInfoMode = async () => {
    try {
        await axios.post('/api/search-info-mode', { searchInfoMode: settings.value.searchInfoMode }, {
            headers: { 'Authorization': localStorage.getItem('adminKey') || '' }
        })
        alert(t('smsg.searchModeSaved'))
    } catch (error) {
        alert(t('smsg.searchModeFailed') + error.message)
    }
}
const saveSimpleModelMap = async () => {
    try {
        await axios.post('/api/simple-model-map', { simpleModelMap: settings.value.simpleModelMap }, {
            headers: { 'Authorization': localStorage.getItem('adminKey') || '' }
        })
        alert(t('smsg.simpleMapSaved'))
    } catch (error) {
        alert(t('smsg.simpleMapFailed') + error.message)
    }
}
const saveChatStream = async () => {
    try {
        await axios.post('/api/setChatStream', { chatStreamDefault: settings.value.chatStreamDefault }, {
            headers: { 'Authorization': localStorage.getItem('adminKey') || '' }
        })
        alert(t('smsg.chatStreamSaved'))
    } catch (error) {
        alert(t('smsg.chatStreamFailed') + (error.response?.data?.error || error.message))
    }
}
const saveRetryConfig = async () => {
    try {
        await axios.post('/api/setRetryConfig', {
            chatRetryCount: settings.value.chatRetryCount,
            chatRetryBackoffMs: settings.value.chatRetryBackoffMs
        }, {
            headers: { 'Authorization': localStorage.getItem('adminKey') || '' }
        })
        alert(t('smsg.retrySaved'))
    } catch (error) {
        alert(t('smsg.retryFailed') + (error.response?.data?.error || error.message))
    }
}

// API Key 管理相关函数
const authHeaders = () => ({ headers: { 'Authorization': localStorage.getItem('adminKey') || '' } })

const copyText = async (text) => {
    await navigator.clipboard.writeText(text)
    alert(t('smsg.keyCopied'))
}

const revealKey = async (payload) => {
    const res = await axios.post('/api/revealKey', payload, authHeaders())
    return res.data.key || ''
}

const saveAdminKey = async () => {
    if (!newAdminKey.value.trim()) {
        alert(t('smsg.adminKeyRequired'))
        return
    }
    try {
        const nextKey = newAdminKey.value.trim()
        await axios.post('/api/setAdminKey', { adminKey: nextKey }, authHeaders())
        localStorage.setItem('adminKey', nextKey)
        revealed.value.admin = nextKey
        visibleAdminKey.value = false
        newAdminKey.value = ''
        await loadSettings()
        alert(t('smsg.adminKeySaved'))
    } catch (error) {
        alert(t('smsg.adminKeyFailed') + (error.response?.data?.error || error.message))
    }
}

const toggleRevealAdmin = async () => {
    if (!visibleAdminKey.value && !revealed.value.admin) {
        revealed.value.admin = await revealKey({ type: 'admin' })
    }
    visibleAdminKey.value = !visibleAdminKey.value
}

const copyAdminKey = async () => {
    if (!revealed.value.admin) revealed.value.admin = await revealKey({ type: 'admin' })
    await copyText(revealed.value.admin)
}

const rotateAdminKey = async () => {
    if (!confirm(t('smsg.confirmRotateAdminKey'))) return
    try {
        const res = await axios.post('/api/rotateAdminKey', {}, authHeaders())
        localStorage.setItem('adminKey', res.data.key)
        revealed.value.admin = res.data.key
        visibleAdminKey.value = false
        await loadSettings()
        alert(t('smsg.adminKeyRotated'))
    } catch (error) {
        alert(t('smsg.adminKeyFailed') + (error.response?.data?.error || error.message))
    }
}

const deleteAdminKey = async () => {
    if (!confirm(t('smsg.confirmDeleteAdminKey'))) return
    try {
        const res = await axios.post('/api/deleteAdminKey', {}, authHeaders())
        if (res.data.key) localStorage.setItem('adminKey', res.data.key)
        revealed.value.admin = ''
        visibleAdminKey.value = false
        await loadSettings()
        alert(t('smsg.adminKeyDeleted'))
    } catch (error) {
        alert(t('smsg.adminKeyFailed') + (error.response?.data?.error || error.message))
    }
}

const addRegularKey = async (generated = false) => {
    if (!generated && !newApiKey.value.trim()) {
        alert(t('smsg.enterKey'))
        return
    }
    try {
        const payload = generated ? {} : { apiKey: newApiKey.value.trim() }
        const res = await axios.post('/api/addRegularKey', payload, authHeaders())
        if (res.data.key) await copyText(res.data.key)
        alert(t('smsg.keyAdded'))
        newApiKey.value = ''
        await loadSettings()
    } catch (error) {
        alert(t('smsg.keyAddFailed') + (error.response?.data?.error || error.message))
    }
}

const updateRegularKey = async (index) => {
    const nextKey = (editRegularKeys.value[index] || '').trim()
    if (!nextKey) {
        alert(t('smsg.enterKey'))
        return
    }
    try {
        await axios.post('/api/updateRegularKey', { index, apiKey: nextKey }, authHeaders())
        editRegularKeys.value[index] = ''
        revealed.value.regular[index] = nextKey
        visibleRegularKeys.value[index] = false
        await loadSettings()
        alert(t('smsg.keyUpdated'))
    } catch (error) {
        alert(t('smsg.keyUpdateFailed') + (error.response?.data?.error || error.message))
    }
}

const toggleRevealRegular = async (index) => {
    if (!visibleRegularKeys.value[index] && !revealed.value.regular[index]) {
        revealed.value.regular[index] = await revealKey({ type: 'regular', index })
    }
    visibleRegularKeys.value[index] = !visibleRegularKeys.value[index]
}

const copyRegularKey = async (index) => {
    if (!revealed.value.regular[index]) revealed.value.regular[index] = await revealKey({ type: 'regular', index })
    await copyText(revealed.value.regular[index])
}

const rotateRegularKey = async (index) => {
    if (!confirm(t('smsg.confirmRotateKey'))) return
    try {
        const res = await axios.post('/api/rotateRegularKey', { index }, authHeaders())
        revealed.value.regular[index] = res.data.key
        visibleRegularKeys.value[index] = false
        await loadSettings()
        await copyText(res.data.key)
        alert(t('smsg.keyRotated'))
    } catch (error) {
        alert(t('smsg.keyRotateFailed') + (error.response?.data?.error || error.message))
    }
}

const deleteRegularKey = async (index) => {
    if (!confirm(t('smsg.confirmDeleteKey'))) return
    try {
        await axios.post('/api/deleteRegularKey', { index }, authHeaders())
        delete visibleRegularKeys.value[index]
        delete revealed.value.regular[index]
        delete editRegularKeys.value[index]
        alert(t('smsg.keyDeleted'))
        await loadSettings()
    } catch (error) {
        alert(t('smsg.keyDeleteFailed') + (error.response?.data?.error || error.message))
    }
}

onMounted(() => {
    loadSettings()
})
</script>

<style lang="css" scoped>
.setting-card {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.3));
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.10);
    transition: box-shadow 0.3s, transform 0.3s;
    position: relative;
}

.setting-card:hover {
    box-shadow: 0 12px 36px 0 rgba(31, 38, 135, 0.18);
    transform: translateY(-2px) scale(1.01);
}

.key-btn {
    border: 1px solid #c8b9a8;
    background: #f5f0e8;
    color: #6f5639;
    border-radius: 10px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 700;
    transition: all .2s ease;
}
.key-btn:hover { background: #ede5d8; border-color: #b56535; }
.primary-key-btn { background: #b56535; border-color: #b56535; color: #fff; }
.primary-key-btn:hover { background: #9f532d; }
.warn-key-btn { background: #f4e3cf; border-color: #d7a069; color: #8a4f1f; }
.warn-key-btn:hover { background: #ecd4b8; }
.danger-key-btn { background: #c04a3a; border-color: #c04a3a; color: #fff; }
.danger-key-btn:hover { background: #a83c2e; }

.action-button {
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
}
</style>
