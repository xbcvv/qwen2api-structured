import { createRouter, createWebHistory } from 'vue-router'
import axios from 'axios'

const routes = [
  {
    name: 'dashboard',
    path: '/',
    component: () => import('../views/dashboard.vue')
  },
  {
    name: 'auth',
    path: '/auth',
    component: () => import('../views/auth.vue')
  },
  {
    name: 'settings',
    path: '/settings',
    component: () => import('../views/settings.vue')
  },
  {
    name: 'statistics',
    path: '/statistics',
    component: () => import('../views/statistics.vue')
  },
    {
    name: 'chat',
    path: '/chat',
    component: () => import('../views/chat.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 管理后台鉴权：使用 adminKey
const requireAdmin = ['/', '/settings', '/statistics']

router.beforeEach(async (to, from, next) => {
  if (to.path === '/auth') {
    next()
  } else if (to.path === '/chat') {
    // 聊天测试页使用下游 API Key，无需 admin 验证
    const apiKey = localStorage.getItem('apiKey')
    if (!apiKey) {
      next({ path: '/auth' })
    } else {
      try {
        const verifyResponse = await axios.post('/verify', { apiKey })
        if (verifyResponse.data.status === 200) {
          next()
        } else {
          localStorage.removeItem('apiKey')
          next({ path: '/auth' })
        }
      } catch (error) {
        localStorage.removeItem('apiKey')
        next({ path: '/auth' })
      }
    }
  } else if (requireAdmin.includes(to.path)) {
    // 管理后台页面：只用 adminKey
    const adminKey = localStorage.getItem('adminKey')
    if (!adminKey) {
      next({ path: '/auth' })
    } else {
      try {
        const verifyResponse = await axios.post('/verify', { apiKey: adminKey })
        if (verifyResponse.data.status === 200 && verifyResponse.data.isAdmin) {
          localStorage.setItem('isAdmin', 'true')
          next()
        } else {
          localStorage.removeItem('adminKey')
          localStorage.removeItem('isAdmin')
          next({ path: '/auth' })
        }
      } catch (error) {
        localStorage.removeItem('adminKey')
        localStorage.removeItem('isAdmin')
        next({ path: '/auth' })
      }
    }
  } else {
    next()
  }
})

export default router
