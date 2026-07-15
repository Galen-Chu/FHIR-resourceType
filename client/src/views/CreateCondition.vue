<template>
  <h2>建立 Condition</h2>
  <p class="subtitle">診斷（Condition-twcore）— subject → Patient、encounter → Encounter，code 採 ICD-10</p>

  <div class="form-card">
    <div class="form-row">
      <label>病患</label>
      <select v-model="form.patientId">
        <option disabled value="">— 選擇已建立的 Patient —</option>
        <option v-for="p in createdResources.Patient" :key="p.id" :value="p.id">{{ p.label }}</option>
      </select>
    </div>
    <div class="form-row">
      <label>就診（Encounter）</label>
      <select v-model="form.encounterId">
        <option disabled value="">— 選擇已建立的 Encounter —</option>
        <option v-for="e in createdResources.Encounter" :key="e.id" :value="e.id">{{ e.label }}</option>
      </select>
    </div>
    <div class="form-grid">
      <div class="form-row">
        <label>ICD-10 代碼</label>
        <input v-model="form.icd10Code" placeholder="例如：J06.9" />
      </div>
      <div class="form-row">
        <label>診斷名稱</label>
        <input v-model="form.icd10Display" placeholder="例如：急性上呼吸道感染" />
      </div>
      <div class="form-row">
        <label>臨床狀態（clinicalStatus）</label>
        <select v-model="form.clinicalStatus">
          <option value="active">active</option>
          <option value="resolved">resolved</option>
        </select>
      </div>
      <div class="form-row">
        <label>發病時間（onsetDateTime）</label>
        <input v-model="form.onsetDateTime" type="datetime-local" />
      </div>
    </div>
    <button class="primary" :disabled="loading || !canSubmit" @click="submit">
      {{ loading ? '建立中…' : '送出建立' }}
    </button>
  </div>

  <JsonPreviewPanel endpoint="/conditions" :payload="buildBody" :disabled="!canSubmit" filename="condition" />

  <ResourceResultCard :result="result" />
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import api from '../api';
import { createdResources, registerResource } from '../store';
import ResourceResultCard from '../components/ResourceResultCard.vue';
import JsonPreviewPanel from '../components/JsonPreviewPanel.vue';

const form = reactive({
  patientId: '',
  encounterId: '',
  icd10Code: 'J06.9',
  icd10Display: '急性上呼吸道感染',
  clinicalStatus: 'active',
  onsetDateTime: ''
});
const result = ref(null);
const loading = ref(false);
const canSubmit = computed(() => form.patientId && form.encounterId && form.icd10Code);

// 「產生 JSON」與「送出建立」使用同一份 request body
function buildBody() {
  const body = { ...form };
  if (body.onsetDateTime) body.onsetDateTime = new Date(body.onsetDateTime).toISOString();
  else delete body.onsetDateTime;
  return body;
}

async function submit() {
  loading.value = true;
  result.value = null;
  try {
    const r = await api.post('/conditions', buildBody());
    result.value = r.data;
    if (r.data.id) registerResource('Condition', r.data.id, `${form.icd10Display}（Condition/${r.data.id}）`);
  } catch (err) {
    result.value = { status: 0, error: err.message };
  } finally {
    loading.value = false;
  }
}
</script>
