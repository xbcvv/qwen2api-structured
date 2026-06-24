import { createRouter, createWebHistory } from 'vue-router'
import axios from 'axios'
import AdminLayout from '../layouts/AdminLayout.vue'

const routes = [
  {
    name: 'auth',
    path: '/auth',
    component: () => import('../views/auth.vue')
  },
  {
    path: '/',
    component: AdminLayout,
    children: [
      {
        name: 'dashboard',
        path: '',
        component: () => import('../views/dashboard.vue')
      },
      {
        name: 'settings',
        path: 'settings',
        component: () => import('../views/settings.vue')
      },
      {
        name: 'statistics',
        path: 'statistics',
        component: () => import('../views/statistics.vue')
      },
      {
        name: 'chat',
        path: 'chat',
        component: () => import('../views/chat.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const requireAdmin = ['/', '/settings', '/statistics']

router.beforeEach(async (to, from, next) => {
  if (to.path === '/auth') {
    next()
    return
  }

  if (to.path === '/chat') {
    const apiKey = localStorage.getItem('apiKey')
    if (!apiKey) {
      next({ path: '/auth' })
      return
    }
    try {
      const verifyResponse = await axios.post('/verify', { apiKey })
      if (verifyResponse.data.status === 200) {
        next()
      } else {
        localStorage.removeItem('apiKey')
        next({ path: '/auth' })
      }
    } catch (_) {
      localStorage.removeItem('apiKey')
      next({ path: '/auth' })
    }
    return
  }

  if (requireAdmin.includes(to.path)) {
    const adminKey = localStorage.getItem('adminKey')
    if (!adminKey) {
      next({ path: '/auth' })
      return
    }
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
    } catch (_) {
      localStorage.removeItem('adminKey')
      localStorage.removeItem('isAdmin')
      next({ path: '/auth' })
    }
    return
  }

  next()
})

export default router
