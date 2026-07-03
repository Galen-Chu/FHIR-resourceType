<template>
  <h2>建立 Observation</h2>
  <p class="subtitle">生命徵象（Observation-twcore）— subject → Patient、encounter → Encounter，code 採 LOINC</p>

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
      <label>檢測項目（LOINC）</label>
      <select v-model="selectedVital">
        <option v-for="(v, i) in VITALS" :key="v.code" :value="i">
          {{ v.code }} — {{ v.text }}
        </option>
      </select>
    </div>
    <div class="form-grid">
      <div class="form-row">
        <label>數值（valueQuantity）</label>
        <input v-model="form.value" type="number" step="any" />
      </div>
      <div class="form-row">
        <label>單位</label>
        <input :value="VITALS[selectedVital].unit" disabled />
      </div>
    </div>
    <button class="primary" :disabled="loading || !canSubmit" @click="submit">
      {{ loading ? '建立中…' : '送出建立' }}
    </button>
  </div>

  <ResourceResultCard :result="result" />
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import api from '../api';
import { createdResources, registerResource } from '../store';
import ResourceResultCard from '../components/ResourceResultCard.vue';

const VITALS = [
  { code: '8867-4', display: 'Heart rate', text: '心率', unit: 'beats/minute', unitCode: '/min' },
  { code: '8480-6', display: 'Systolic blood pressure', text: '收縮壓', unit: 'mmHg', unitCode: 'mm[Hg]' },
  { code: '8462-4', display: 'Diastolic blood pressure', text: '舒張壓', unit: 'mmHg', unitCode: 'mm[Hg]' },
  { code: '8310-5', display: 'Body temperature', text: '體溫', unit: 'Cel', unitCode: 'Cel' },
  { code: '9279-1', display: 'Respiratory rate', text: '呼吸速率', unit: 'breaths/minute', unitCode: '/min' }
];

const form = reactive({ patientId: '', encounterId: '', value: 72 });
const selectedVital = ref(0);
const result = ref(null);
const loading = ref(false);
const canSubmit = computed(() => form.patientId && form.encounterId && form.value !== '');

async function submit() {
  loading.value = true;
  result.value = null;
  const v = VITALS[selectedVital.value];
  try {
    const r = await api.post('/observations', {
      ...form,
      loincCode: v.code,
      loincDisplay: v.display,
      codeText: v.text,
      unit: v.unit,
      unitCode: v.unitCode
    });
    result.value = r.data;
    if (r.data.id) registerResource('Observation', r.data.id, `${v.text}（Observation/${r.data.id}）`);
  } catch (err) {
    result.value = { status: 0, error: err.message };
  } finally {
    loading.value = false;
  }
}
</script>
