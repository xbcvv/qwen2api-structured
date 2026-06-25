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
                    <div class="relative flex flex-col gap-4">
                        <label class="text-gray-700 font-semibold text-lg">{{ t('settings.apiKeyTitle') }}</label>

                        <!-- 管理员密钥修改 -->
                        <div class="bg-[#fef9f1] border border-[#e8d5b0] rounded-lg p-4">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-[#9a6020] font-semibold">{{ t('settings.adminKeyTitle') }}</span>
                                <span v-if="settings.adminKeySet" class="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">{{ t('settings.adminKeySet') }}</span>
                                <span v-else class="text-xs bg-red-200 text-red-800 px-2 py-1 rounded">{{ t('settings.adminKeyUnset') }}</span>
                            </div>
                            <div v-if="settings.adminKeyHint" class="text-sm text-gray-600 mb-2">🔑 {{ settings.adminKeyHint }}</div>
                            <div v-else class="text-sm text-red-500 mb-2">{{ t('settings.adminKeyMissing') }}</div>
                            <div class="text-xs text-gray-500 mb-2">{{ t('settings.adminKeyHint') }}</div>
                            <div class="flex gap-2">
                                <input v-model="newAdminKey" type="password"
                                    :placeholder="t('settings.adminKeyInput')"
                                    class="flex-1 rounded-lg border-gray-300 bg-white shadow-sm h-8 text-sm px-3">
                                <button @click="saveAdminKey"
                                    class="bg-[#b56535] text-white px-3 py-1 rounded-lg text-sm hover:bg-[#9f532d] transition-all">
                                    {{ t('settings.adminKeySave') }}
                                </button>
                            </div>
                        </div>

                        <!-- 下游密钥列表 -->
                        <div class="space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="text-gray-700 font-semibold">{{ t('settings.regularKeys') }}</span>
                                <button @click="showAddKeyModal = true"
                                    class="bg-[#5f8a4b] text-white px-3 py-1 rounded-lg text-sm hover:bg-[#4d7339] transition-all">
                                    {{ t('settings.addKey') }}
                                </button>
                            </div>

                            <div v-if="settings.regularKeys.length === 0" class="text-gray-500 text-center py-4">
                                {{ t('settings.noKeys') }}
                            </div>

                            <div v-for="(key, index) in settings.regularKeys" :key="index"
                                class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <input :value="key" type="text" readonly
                                    class="flex-1 rounded-lg border-gray-300 bg-white shadow-sm h-8 text-sm px-3">
                                <button @click="deleteRegularKey(index)"
                                    class="bg-[#c04a3a] text-white px-3 py-1 rounded-lg text-sm hover:bg-[#a83c2e] transition-all">
                                    {{ t('settings.delete') }}
                                </button>
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

            <!-- 添加API Key模态框 -->
            <div v-if="showAddKeyModal"
                class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg p-6 w-96 max-w-90vw">
                    <h3 class="text-lg font-semibold mb-4">{{ t('settings.addKeyTitle') }}</h3>
                    <input v-model="newApiKey" type="text" :placeholder="t('settings.addKeyPlaceholder')"
                        class="w-full rounded-lg border-gray-300 shadow-sm h-10 text-sm px-3 mb-4">
                    <div class="flex gap-2 justify-end">
                        <button @click="showAddKeyModal = false"
                            class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all">
                            {{ t('settings.cancel') }}
                        </button>
                        <button @click="addRegularKey"
                            class="px-4 py-2 bg-[#b56535] text-white rounded-lg hover:bg-[#9f532d] transition-all">
                            {{ t('settings.add') }}
                        </button>
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

const showAddKeyModal = ref(false)
const newApiKey = ref('')
const newAdminKey = ref('')

const loadSettings = async () => {
    try {
        const res = await axios.get('/api/settings', {
            headers: {
                'Authorization': localStorage.getItem('adminKey') || ''
            }
        })
        settings.value.adminKeySet = res.data.adminKeySet
        settings.value.adminKeyHint = res.data.adminKeyHint || ''
        settings.value.regularKeys = res.data.regularKeys || []
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

const saveApiKey = async () => {
    try {
        await axios.post('/api/setApiKey', { apiKey: settings.value.apiKey }, {
            headers: { 'Authorization': localStorage.getItem('adminKey') || '' }
        })
        alert(t('smsg.apiKeySaved'))
    } catch (error) {
        alert(t('smsg.apiKeyFailed') + error.message)
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
const saveAdminKey = async () => {
    if (!newAdminKey.value.trim()) {
        alert(t('smsg.adminKeyRequired'))
        return
    }
    try {
        await axios.post('/api/setAdminKey', { adminKey: newAdminKey.value.trim() }, {
            headers: { 'Authorization': localStorage.getItem('adminKey') || '' }
        })
        // Update local storage with new key
        localStorage.setItem('adminKey', newAdminKey.value.trim())
        newAdminKey.value = ''
        await loadSettings()
        alert(t('smsg.adminKeySaved'))
    } catch (error) {
        alert(t('smsg.adminKeyFailed') + (error.response?.data?.error || error.message))
    }
}

const addRegularKey = async () => {
    if (!newApiKey.value.trim()) {
        alert(t('smsg.enterKey'))
        return
    }

    try {
        await axios.post('/api/addRegularKey', { apiKey: newApiKey.value.trim() }, {
            headers: { 'Authorization': localStorage.getItem('adminKey') || '' }
        })
        alert(t('smsg.keyAdded'))
        newApiKey.value = ''
        showAddKeyModal.value = false
        await loadSettings()
    } catch (error) {
        alert(t('smsg.keyAddFailed') + error.message)
    }
}

const deleteRegularKey = async (index) => {
    if (!confirm(t('smsg.confirmDeleteKey'))) return

    const keyToDelete = settings.value.regularKeys[index]
    try {
        await axios.post('/api/deleteRegularKey', { apiKey: keyToDelete }, {
            headers: { 'Authorization': localStorage.getItem('adminKey') || '' }
        })
        alert(t('smsg.keyDeleted'))
        await loadSettings()
    } catch (error) {
        alert(t('smsg.keyDeleteFailed') + error.message)
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

.action-button {
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
}
</style>
