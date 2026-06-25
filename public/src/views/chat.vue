<template>
  <div class="chat page-fill flex flex-col items-center overflow-hidden">
    <div class="chat-header shrink-0 p-4 bg-white/60 w-full flex justify-between">
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
      <div class="rounded-xl border p-4 m-4 bg-white/60">
        <textarea
          class="w-full outline-none bg-transparent"
          v-model="state.prompt"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <div class="flex justify-between items-center mt-2 gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <select
              class="border rounded py-2 outline-none bg-transparent text-sm"
              v-model="state.model"
            >
              <option v-for="opt in state.models" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <!-- 流式开关 -->
            <label class="inline-flex items-center gap-1.5 text-sm cursor-pointer select-none border rounded px-3 py-2 bg-transparent"
              :class="state.stream ? 'border-blue-400 text-blue-700' : 'border-gray-300 text-gray-600'">
              <input type="checkbox" v-model="state.stream" class="accent-blue-500 w-4 h-4" />
              {{ state.stream ? 'Stream' : 'Non-Stream' }}
            </label>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="state.streaming"
              class="bg-red-500 text-white px-4 py-2 rounded-full text-sm"
              @click="abort">
              ■ {{ t("chat.stop") || 'Stop' }}
            </button>
            <button
              class="bg-blue-500 text-white px-4 py-2 rounded-full text-sm disabled:opacity-50"
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
  const res = await fetch("/v1/models", {
    method: "GET",
    headers: { [tokenKey]: token },
  });
  const { data } = await res.json();
  state.model = data[0]?.id || "";
  state.models = (data || []).map((item) => ({
    label: item.name || item.id,
    value: item.id,
  }));
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
