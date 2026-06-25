<template>
  <div class="fixed top-4 right-4 z-50">
    <LangSwitcher />
  </div>
  <div class="flex flex-col items-center justify-center w-screen h-screen">
    <transition name="fade-slide">
      <div v-if="showPanel"
        class="flex flex-col items-center w-96 p-8 bg-white rounded-3xl shadow-xl border border-gray-200 animate-panel">
        <h1 class="mb-8 text-2xl font-bold">{{ t('auth.title') }}</h1>

        <label class="self-start mb-2 text-gray-700" for="adminKey">
          {{ t('auth.passwordLabel') }}
        </label>
        <div class="relative w-full mb-6">
          <input
            id="adminKey"
            :type="passwordVisible ? 'text' : 'password'"
            v-model="apiKey"
            :placeholder="t('auth.placeholder')"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            @keyup.enter="handleLogin"
          />
          <button
            class="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            @click="passwordVisible = !passwordVisible"
            type="button"
            tabindex="-1"
          >
            <svg v-if="passwordVisible" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>

        <button
          class="w-full py-3 text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 active:scale-95 transition-transform duration-200"
          @click="handleLogin"
        >
          {{ t('auth.login') }}
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { useRouter } from 'vue-router'
import LangSwitcher from '../components/LangSwitcher.vue'

const { t } = useI18n()
const router = useRouter()
const apiKey = ref('')
const showPanel = ref(false)
const passwordVisible = ref(false)

const handleLogin = async () => {
  try {
    const res = await axios.post('/verify', {
      apiKey: apiKey.value
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    if (res.data.status == 200) {
      if (res.data.isAdmin) {
        localStorage.setItem('adminKey', apiKey.value)
        localStorage.setItem('isAdmin', 'true')
      } else {
        localStorage.setItem('apiKey', apiKey.value)
        localStorage.setItem('isAdmin', 'false')
        alert(t('auth.notAdmin'))
        return
      }
      router.push({ path: '/', replace: true })
    } else {
      alert(t('auth.error'))
    }
  } catch (err) {
    alert(t('auth.error'))
  }
}

onMounted(() => {
  setTimeout(() => {
    showPanel.value = true
  }, 80)
})
</script>

<style lang="css" scoped>
.fade-slide-enter-active, .fade-slide-leave-active {
  transition: opacity 0.5s, transform 0.5s;
}
.fade-slide-enter-from, .fade-slide-leave-to {
  opacity: 0;
  transform: translateY(40px);
}
.fade-slide-enter-to, .fade-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
