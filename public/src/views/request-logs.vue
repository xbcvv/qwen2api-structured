<template>
  <div class="page-fill overflow-hidden flex flex-col p-4 gap-3">
    <div class="flex items-start justify-between gap-3 px-1">
      <div>
        <h1 class="text-xl font-bold text-[#2d2a24]">请求日志</h1>
        <p class="text-xs text-gray-500 mt-1">查看和追踪 LLM 调用请求日志</p>
      </div>
      <div class="flex items-center gap-2">
        <label class="inline-flex items-center gap-1 text-xs text-gray-600">
          <input type="checkbox" v-model="autoRefresh" class="accent-[#b56535]" />
          自动刷新
        </label>
        <button class="log-btn" @click="loadLogs">刷新</button>
      </div>
    </div>

    <div class="log-filter-card">
      <input v-model="filters.q" @keyup.enter="applyFilters" class="log-input min-w-[220px]" placeholder="按模型ID / API密钥 / 路径 / IP 筛选..." />
      <select v-model="filters.status" @change="applyFilters" class="log-input w-28">
        <option value="">状态</option>
        <option value="已完成">已完成</option>
        <option value="异常">异常</option>
        <option value="失败">失败</option>
      </select>
      <select v-model="filters.source" @change="applyFilters" class="log-input w-28">
        <option value="">来源</option>
        <option value="API">API</option>
        <option value="CLI">CLI</option>
        <option value="Web">Web</option>
      </select>
      <button class="log-btn" @click="applyFilters">查询</button>
    </div>

    <div class="flex-1 min-h-0 rounded-2xl border border-[#e3ded6] bg-white overflow-hidden shadow-sm">
      <div class="overflow-auto h-full">
        <table class="log-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>模型ID</th>
              <th>API 格式</th>
              <th>格式</th>
              <th>来源</th>
              <th>API密钥</th>
              <th>状态</th>
              <th>耗时</th>
              <th>IP</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="logs.length === 0">
              <td colspan="10" class="text-center text-gray-400 py-10">暂无请求日志</td>
            </tr>
            <tr v-for="item in logs" :key="item.id">
              <td class="font-mono text-[#9f5930]">#{{ item.id }}</td>
              <td class="font-semibold text-gray-800">{{ item.model }}</td>
              <td><span class="pill neutral">{{ item.path }}</span></td>
              <td><span class="pill green">{{ item.format }}</span></td>
              <td><span class="pill blue">{{ item.source }}</span></td>
              <td class="font-mono">{{ item.key }}</td>
              <td><span :class="statusClass(item.status)">{{ item.status }}</span></td>
              <td>{{ formatDuration(item.durationMs) }}</td>
              <td>{{ item.ip }}</td>
              <td>{{ formatTime(item.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex justify-between items-center text-xs text-gray-600 px-1">
      <span>已显示 {{ logs.length }} / 总计 {{ total }} 行</span>
      <div class="flex items-center gap-2">
        <span>每页行数</span>
        <input v-model.number="pageSize" @change="applyFilters" type="number" min="1" max="200" class="log-input w-16 h-8" />
        <button class="log-page-btn" :disabled="page <= 1" @click="changePage(page - 1)">上一页</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button class="log-page-btn" :disabled="page >= totalPages" @click="changePage(page + 1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import axios from 'axios'

const logs = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const autoRefresh = ref(false)
const filters = ref({ q: '', status: '', source: '' })
let timer = null

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const headers = () => ({ Authorization: localStorage.getItem('adminKey') || '' })

const loadLogs = async () => {
  const res = await axios.get('/api/request-logs', {
    headers: headers(),
    params: { page: page.value, pageSize: pageSize.value, ...filters.value }
  })
  logs.value = res.data.data || []
  total.value = res.data.total || 0
}

const applyFilters = async () => {
  pageSize.value = Math.min(200, Math.max(1, Math.floor(Number(pageSize.value) || 50)))
  page.value = 1
  await loadLogs()
}

const changePage = async (next) => {
  if (next < 1 || next > totalPages.value) return
  page.value = next
  await loadLogs()
}

const statusClass = (status) => {
  if (status === '已完成') return 'pill green'
  if (status === '失败') return 'pill red'
  return 'pill amber'
}

const formatDuration = (ms) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
const formatTime = (iso) => new Date(iso).toLocaleString()

watch(autoRefresh, (enabled) => {
  if (timer) clearInterval(timer)
  timer = enabled ? setInterval(loadLogs, 5000) : null
})

onMounted(loadLogs)
onUnmounted(() => timer && clearInterval(timer))
</script>

<style scoped>
.log-filter-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #fbfaf7;
  border: 1px solid #e3ded6;
  border-radius: 14px;
}
.log-input {
  height: 34px;
  border: 1px solid #ddd6cc;
  border-radius: 10px;
  background: #fff;
  padding: 0 10px;
  font-size: 12px;
  outline: none;
}
.log-input:focus { border-color: #b56535; }
.log-btn,
.log-page-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid #d8c7b5;
  background: #fff8f1;
  color: #8b542f;
  font-size: 12px;
  font-weight: 700;
  transition: all .2s ease;
}
.log-btn:hover,
.log-page-btn:hover:not(:disabled) { background: #f2dfcb; }
.log-page-btn:disabled { opacity: .45; cursor: not-allowed; }
.log-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1100px;
  font-size: 12px;
}
.log-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #e9e5de;
  color: #5a5248;
  font-size: 11px;
  font-weight: 800;
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid #d8d0c4;
  white-space: nowrap;
}
.log-table td {
  padding: 11px 12px;
  border-bottom: 1px solid #f0ece6;
  color: #3f3931;
  white-space: nowrap;
}
.log-table tr:hover td { background: #fffaf4; }
.pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}
.pill.neutral { background: #f3f0ea; color: #5a5248; }
.pill.green { background: #e6f4ea; color: #15803d; }
.pill.blue { background: #e8f1fb; color: #2563eb; }
.pill.red { background: #fee2e2; color: #b91c1c; }
.pill.amber { background: #fef3c7; color: #a16207; }
</style>
