<template>
  <div class="chat page-fill flex flex-col items-center overflow-hidden">
    <div class="chat-header shrink-0 p-4 bg-[#f7f6f3] border-b border-[#e3ded6] w-full flex justify-between text-sm text-gray-700">
      <span>Qwen</span>
      <span>{{ t("chat.title") }}</span>
    </div>
    <div class="chat-messages min-h-0 flex-1 overflow-y-auto max-w-5xl w-full">
      <div
        v-for="(message, index) in state.messages"
        :key="index"
        :class="`chat-message m-4 flex flex-col role-${message.role}`"
      >
        <div class="message-content">
          {{ message.content }}
        </div>
      </div>
    </div>
    <div class="chat-input shrink-0 max-w-5xl w-full">
      <div class="rounded-2xl border border-[#ddd6cc] p-4 m-4 bg-white shadow-sm">
        <textarea
          class="w-full outline-none bg-transparent min-h-[88px] resize-none text-sm"
          v-model="state.prompt"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <div class="flex justify-between items-center mt-2 gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <select
              class="border border-[#ddd6cc] rounded-lg px-3 py-2 outline-none bg-white text-sm focus:border-[#b56535]"
              v-model="state.model"
            >
              <option v-for="opt in state.models" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <label class="inline-flex items-center justify-center gap-1.5 text-sm cursor-pointer select-none border rounded-lg px-3 py-2 bg-white whitespace-nowrap min-w-[72px]"
              :class="state.stream ? 'border-[#b56535] text-[#9f5930] bg-[#fff8f1]' : 'border-gray-300 text-gray-600'">
              <input type="checkbox" v-model="state.stream" class="accent-[#b56535] w-4 h-4 shrink-0" />
              <span class="whitespace-nowrap leading-none">{{ t('chat.streamLabel') }}</span>
            </label>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="state.streaming"
              class="bg-red-500 text-white px-4 py-2 rounded-full text-sm"
              @click="abort">
              ■ {{ t("chat.stop") || 'Stop' }}
            </button>
            <button
              class="bg-[#b56535] text-white px-4 py-2 rounded-full text-sm disabled:opacity-50 hover:bg-[#9f532d]"
              :disabled="state.streaming || !state.prompt.trim()"
              @click="send"
            >
              {{ t("chat.send") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import axios from 'axios';

defineOptions({
  name: "Chat",
});

const { t } = useI18n();

const apiKey = localStorage.getItem("adminKey") || localStorage.getItem("apiKey");
const typeKey = "Content-Type";
const tokenKey = "Authorization";
const token = `Bearer ${apiKey}`;

let abortController = null;

const state = reactive({
  models: [],
  messages: [],
  prompt: "",
  model: "",
  stream: true,
  streaming: false,
});

/* ===================== SSE helpers ===================== */

function createSseTransformer() {
  function pushMessage(block, controller) {
    const regLine = /(data|event|id|retry):\s?(.*)/;
    const message = { data: "", event: "", id: "", retry: "" };
    const lines = block.split("\n");

    lines.forEach(function (line) {
      if (!line) return;
      const match = regLine.exec(line);
      if (match) {
        message[match[1]] += match[2];
      }
    });

    if (message.data.length > 0) {
      controller.enqueue(message);
    }
  }

  let buffer = "";

  return new TransformStream({
    start() {},
    transform(chunk, controller) {
      buffer += chunk;
      const s = "\n\n";
      let idx;
      while ((idx = buffer.indexOf(s)) > -1) {
        const block = buffer.slice(0, idx);
        pushMessage(block, controller);
        buffer = buffer.slice(idx + s.length);
      }
    },
    flush() {},
  });
}

/* ===================== Stream mode ===================== */

function sendStream() {
  state.streaming = true;
  abortController = new AbortController();

  state.messages.push({ role: "user", content: state.prompt });
  state.prompt = "";

  const body = {
    model: state.model,
    messages: state.messages,
    stream: true,
  };

  fetch("/v1/chat/completions", {
    method: "POST",
    headers: {
      [typeKey]: "application/json",
      [tokenKey]: token,
    },
    body: JSON.stringify(body),
    signal: abortController.signal,
  })
    .then((response) => {
      const ct = response.headers.get(typeKey);
      if (!response.ok || !ct?.includes("text/event-stream")) {
        throw new Error(`${response.status} - ${response.statusText}`);
      }

      state.messages.push({ role: "assistant", content: "" });

      return response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(createSseTransformer())
        .pipeTo(
          new WritableStream({
            write(data) {
              try {
                const parsed = JSON.parse(data.data);
                parsed.choices?.forEach((choice) => {
                  const content = choice?.delta?.content;
                  if (content) {
                    state.messages[state.messages.length - 1].content += content;
                  }
                });
              } catch (_) {}
            },
            close() {
              state.streaming = false;
            },
          })
        );
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        state.messages[state.messages.length - 1].content += "\n\n[已中止]";
      } else {
        state.messages.push({
          role: "assistant",
          content: `⚠️ ${err.message}`,
        });
      }
      state.streaming = false;
    });
}

/* ===================== Non-stream mode ===================== */

function sendSync() {
  state.streaming = true;
  abortController = new AbortController();

  state.messages.push({ role: "user", content: state.prompt });
  state.prompt = "";

  const body = {
    model: state.model,
    messages: state.messages,
    stream: false,
  };

  fetch("/v1/chat/completions", {
    method: "POST",
    headers: {
      [typeKey]: "application/json",
      [tokenKey]: token,
    },
    body: JSON.stringify(body),
    signal: abortController.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`${response.status} - ${response.statusText}`);
      }
      const json = await response.json();
      const content =
        json.choices?.[0]?.message?.content ?? "(空响应)";
      state.messages.push({ role: "assistant", content });
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        state.messages.push({
          role: "assistant",
          content: "[已中止]",
        });
      } else {
        state.messages.push({
          role: "assistant",
          content: `⚠️ ${err.message}`,
        });
      }
    })
    .finally(() => {
      state.streaming = false;
    });
}

/* ===================== Public API ===================== */

function send() {
  if (!state.prompt.trim() || state.streaming) return;
  if (state.stream) {
    sendStream();
  } else {
    sendSync();
  }
}

function abort() {
  abortController?.abort();
}

/* ===================== Init ===================== */

onMounted(async function () {
  const [modelsRes, settingsRes] = await Promise.all([
    fetch("/v1/models", {
      method: "GET",
      headers: { [tokenKey]: token },
    }),
    axios.get('/api/settings', {
      headers: { Authorization: token },
    }).catch(() => null)
  ])
  const { data } = await modelsRes.json();
  state.model = data[0]?.id || "";
  state.models = (data || []).map((item) => ({
    label: item.name || item.id,
    value: item.id,
  }));
  if (settingsRes?.data?.chatStreamDefault !== undefined) {
    state.stream = settingsRes.data.chatStreamDefault;
  }
});
</script>

<style scoped>
.role-user {
  align-items: flex-end;
}

.role-user .message-content {
  @apply bg-blue-100 py-2 px-4 rounded-lg;
}

.role-assistant .message-content {
  white-space: pre-wrap;
}
</style>
