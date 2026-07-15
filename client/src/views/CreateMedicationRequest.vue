<template>
  <h2>建立 MedicationRequest</h2>
  <p class="subtitle">
    用藥醫囑（MedicationRequest-twcore）— subject → Patient、encounter → Encounter、requester → Practitioner
  </p>

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
    <div class="form-row">
      <label>開立醫師（requester）</label>
      <select v-model="form.practitionerId">
        <option disabled value="">— 選擇已建立的 Practitioner —</option>
        <option v-for="p in createdResources.Practitioner" :key="p.id" :value="p.id">{{ p.label }}</option>
      </select>
    </div>
    <div class="form-grid">
      <div class="form-row">
        <label>藥品代碼</label>
        <input v-model="form.medicationCode" placeholder="例如：ACET500" />
      </div>
      <div class="form-row">
        <label>藥品名稱</label>
        <input v-model="form.medicationText" placeholder="例如：普拿疼 500mg 錠劑" />
      </div>
    </div>
    <div class="form-row">
      <label>用法用量（dosageInstruction）</label>
      <input v-model="form.dosageText" placeholder="例如：每日三次，每次一錠，飯後服用" />
    </div>
    <button class="primary" :disabled="loading || !canSubmit" @click="submit">
      {{ loading ? '建立中…' : '送出建立' }}
    </button>
  </div>

  <JsonPreviewPanel
    endpoint="/medication-requests"
    :payload="form"
    :disabled="!canSubmit"
    filename="medication-request"
  />

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
  practitionerId: '',
  medicationCode: 'ACET500',
  medicationText: '普拿疼 500mg 錠劑',
  dosageText: '每日三次，每次一錠，飯後服用'
});
const result = ref(null);
const loading = ref(false);
const canSubmit = computed(
  () => form.patientId && form.encounterId && form.practitionerId && form.medicationText
);

async function submit() {
  loading.value = true;
  result.value = null;
  try {
    const r = await api.post('/medication-requests', { ...form });
    result.value = r.data;
    if (r.data.id) {
      registerResource('MedicationRequest', r.data.id, `${form.medicationText}（MedicationRequest/${r.data.id}）`);
    }
  } catch (err) {
    result.value = { status: 0, error: err.message };
  } finally {
    loading.value = false;
  }
}
</script>
