<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-brand">
        <span class="brand-mark">Q</span>
        <span>Qwen2API</span>
      </div>

      <nav class="sidebar-nav">
        <template v-for="section in groupedSections" :key="section">
          <div class="sidebar-section">{{ section }}</div>
          <router-link
            v-for="item in navItems.filter(n => n.section === section)"
            :key="item.path"
            :to="item.path"
            class="sidebar-link"
            :class="{ active: route.path === item.path }"
            @click="sidebarOpen = false"
          >
            <span class="sidebar-icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </router-link>
        </template>
      </nav>

      <div class="sidebar-footer">
        <button class="sidebar-logout" @click="logout">⎋ 退出登录</button>
      </div>
    </aside>

    <div class="main-area">
      <header class="topbar">
        <div class="topbar-left">
          <button class="smallbtn mobile-menu" @click="sidebarOpen = !sidebarOpen">☰</button>
          <div>
            <div class="topbar-title">{{ pageTitle }}</div>
            <div class="topbar-subtitle">OpenAI-compatible API 管理控制台</div>
          </div>
        </div>
        <div class="topbar-right">
          <LangSwitcher />
          <div class="topbar-status">
            <span class="status-dot" :class="{ offline: !serviceOk }"></span>
            {{ serviceOk ? '服务正常' : '服务待确认' }}
          </div>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LangSwitcher from '../components/LangSwitcher.vue'

const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)
const serviceOk = ref(true)

const navItems = [
  { path: '/', label: '账号管理', icon: '◎', section: '核心功能' },
  { path: '/chat', label: '测试会话', icon: '✦', section: '核心功能' },
  { path: '/statistics', label: '统计', icon: '▣', section: '监控' },
  { path: '/settings', label: '系统设置', icon: '⚙', section: '系统' }
]

const groupedSections = computed(() => [...new Set(navItems.map(n => n.section))])
const pageTitle = computed(() => navItems.find(n => n.path === route.path)?.label || 'Qwen2API')

const logout = () => {
  localStorage.removeItem('adminKey')
  localStorage.removeItem('apiKey')
  localStorage.removeItem('isAdmin')
  router.replace('/auth')
}

onMounted(async () => {
  try {
    const key = localStorage.getItem('adminKey')
    if (!key) return
    const res = await fetch('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key })
    })
    serviceOk.value = res.ok
  } catch (_) {
    serviceOk.value = false
  }
})
</script>
