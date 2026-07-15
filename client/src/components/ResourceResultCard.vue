<template>
  <!-- 建立結果卡片：綠色 = 2xx；紅色 = 4xx/5xx 並顯示 OperationOutcome 錯誤訊息 -->
  <div v-if="result" class="result-card" :class="ok ? 'success' : 'error'">
    <div class="status-line">
      {{ ok ? '✔' : '✖' }} {{ result.status }} {{ statusText }}
    </div>
    <div class="detail" v-if="ok">
      resourceType: {{ result.resourceType }}
      id = {{ result.id }}<template v-if="result.env">
      env = {{ result.env }}</template>
    </div>
    <div class="detail" v-else>{{ errorMessage }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  result: { type: Object, default: null }
});

const ok = computed(() => props.result && props.result.status >= 200 && props.result.status < 300);

const STATUS_TEXT = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  404: 'Not Found',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  502: 'Bad Gateway'
};

const statusText = computed(() => STATUS_TEXT[props.result?.status] || '');

const errorMessage = computed(() => {
  const r = props.result;
  if (!r) return '';
  const outcome = r.outcome;
  if (outcome && outcome.resourceType === 'OperationOutcome') {
    return (outcome.issue || [])
      .map((i) => (i.details && i.details.text) || i.diagnostics || i.code)
      .join('\n');
  }
  return r.error || JSON.stringify(outcome || r, null, 2);
});
</script>
