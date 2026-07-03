<template>
  <!-- JSON 規格預覽：呼叫 POST /api/{resource}/preview 取得組裝後的 TW Core JSON（不寫入伺服器），
       可複製或下載後貼到 FHIR Validator 手動驗證 -->
  <div class="form-card json-preview">
    <div class="preview-header">
      <div>
        <strong>JSON 規格預覽（Validator 驗證用）</strong>
        <div class="hint">
          產生組裝後的 TW Core JSON，不會寫入 FHIR Server；可貼到
          <a href="https://validator.fhir.org/" target="_blank" rel="noopener">validator.fhir.org ↗</a>
          或以 HAPI <code>$validate</code> 驗證格式
        </div>
      </div>
      <button class="primary" :disabled="disabled || loading" @click="generate">
        {{ loading ? '產生中…' : '產生 JSON' }}
      </button>
    </div>

    <div v-if="error" class="result-card error" style="margin-top: 14px">
      <div class="status-line">✖ 產生失敗</div>
      <div class="detail">{{ error }}</div>
    </div>

    <template v-if="json">
      <div class="preview-actions">
        <button class="ghost" @click="copy">{{ copied ? '✓ 已複製' : '複製 JSON' }}</button>
        <button class="ghost" @click="download">下載 .json</button>
      </div>
      <pre class="json-view">{{ json }}</pre>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import api from '../api';

const props = defineProps({
  // Express 端點前綴，例如 '/organizations'
  endpoint: { type: String, required: true },
  // 與「送出建立」相同的 request body（物件或回傳物件的函式）
  payload: { type: [Object, Function], required: true },
  disabled: { type: Boolean, default: false },
  filename: { type: String, default: 'resource' }
});

const json = ref('');
const error = ref('');
const loading = ref(false);
const copied = ref(false);

async function generate() {
  loading.value = true;
  error.value = '';
  json.value = '';
  try {
    const body = typeof props.payload === 'function' ? props.payload() : { ...props.payload };
    const r = await api.post(`${props.endpoint}/preview`, body);
    if (r.status >= 200 && r.status < 300) {
      json.value = JSON.stringify(r.data, null, 2);
    } else {
      error.value = r.data.error || `HTTP ${r.status}`;
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(json.value);
  } catch {
    // clipboard API 不可用（非 https / 權限被拒）時退回傳統作法
    const ta = document.createElement('textarea');
    ta.value = json.value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

function download() {
  const blob = new Blob([json.value], { type: 'application/fhir+json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${props.filename}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
</script>
