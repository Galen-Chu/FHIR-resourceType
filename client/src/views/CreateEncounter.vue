<template>
  <h2>建立 Encounter</h2>
  <p class="subtitle">
    一次就診（Encounter-twcore）— 建立順序 4，subject → Patient、serviceProvider → Organization、participant → Practitioner
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
      <label>主治醫師</label>
      <select v-model="form.practitionerId">
        <option disabled value="">— 選擇已建立的 Practitioner —</option>
        <option v-for="p in createdResources.Practitioner" :key="p.id" :value="p.id">{{ p.label }}</option>
      </select>
    </div>
    <div class="form-row">
      <label>就診機構</label>
      <select v-model="form.organizationId">
        <option disabled value="">— 選擇已建立的 Organization —</option>
        <option v-for="o in createdResources.Organization" :key="o.id" :value="o.id">{{ o.label }}</option>
      </select>
    </div>
    <div class="form-grid">
      <div class="form-row">
        <label>就診類型（class）</label>
        <input value="門診（AMB）" disabled />
      </div>
      <div class="form-row">
        <label>狀態（status）</label>
        <select v-model="form.status">
          <option value="in-progress">in-progress</option>
          <option value="finished">finished</option>
        </select>
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

const form = reactive({
  patientId: '',
  practitionerId: '',
  organizationId: '',
  status: 'in-progress'
});
const result = ref(null);
const loading = ref(false);
const canSubmit = computed(() => form.patientId && form.practitionerId && form.organizationId);

async function submit() {
  loading.value = true;
  result.value = null;
  try {
    const r = await api.post('/encounters', { ...form });
    result.value = r.data;
    if (r.data.id) registerResource('Encounter', r.data.id, `門診就診（Encounter/${r.data.id}）`);
  } catch (err) {
    result.value = { status: 0, error: err.message };
  } finally {
    loading.value = false;
  }
}
</script>
