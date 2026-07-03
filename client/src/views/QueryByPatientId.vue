<template>
  <h2>查詢 B：指定 ID 查詢病患</h2>
  <p class="subtitle">GET /api/patients/:id → GET /Patient/{id}；找不到時回傳 404 + OperationOutcome</p>

  <div class="form-card">
    <div class="form-row">
      <label>Patient id</label>
      <input v-model="patientId" placeholder="例如：tw-pat-2031" @keyup.enter="search" />
    </div>
    <button class="primary" :disabled="loading || !patientId" @click="search">
      {{ loading ? '查詢中…' : '查詢' }}
    </button>
  </div>

  <div v-if="error" class="result-card error">
    <div class="status-line">✖ {{ error.status }} {{ error.status === 404 ? 'Not Found' : '' }}</div>
    <div class="detail">{{ error.message }}</div>
  </div>

  <template v-if="patient && !error">
    <div class="result-card success" style="margin-bottom: 16px">
      <div class="status-line">✔ 200 OK — Patient/{{ patient.id }}</div>
      <div class="detail">
        姓名：{{ patientName }}
        identifier：{{ patientIdentifier }}
        性別：{{ patient.gender }}　出生日期：{{ patient.birthDate }}
      </div>
    </div>
    <pre class="json-view">{{ JSON.stringify(patient, null, 2) }}</pre>
  </template>
</template>

<script setup>
import { ref, computed } from 'vue';
import api from '../api';

const patientId = ref('');
const patient = ref(null);
const error = ref(null);
const loading = ref(false);

const patientName = computed(() => {
  const n = patient.value?.name?.[0];
  if (!n) return '(未命名)';
  return n.text || `${n.family || ''}${(n.given || []).join('')}`;
});

const patientIdentifier = computed(() => patient.value?.identifier?.[0]?.value || '');

async function search() {
  loading.value = true;
  error.value = null;
  patient.value = null;
  try {
    const r = await api.get(`/patients/${encodeURIComponent(patientId.value)}`);
    if (r.status >= 200 && r.status < 300) {
      patient.value = r.data.patient;
    } else {
      const outcome = r.data.outcome;
      error.value = {
        status: r.status,
        message:
          (outcome && `OperationOutcome: ${(outcome.issue || [])
            .map((i) => (i.details && i.details.text) || i.diagnostics)
            .join('\n')}`) ||
          r.data.error ||
          '查詢失敗'
      };
    }
  } catch (err) {
    error.value = { status: 0, message: err.message };
  } finally {
    loading.value = false;
  }
}
</script>
