<template>
  <h2>建立 Practitioner</h2>
  <p class="subtitle">醫事人員（Practitioner-twcore）— 建立順序 2，獨立建立、不綁定機構</p>

  <div class="form-card">
    <div class="form-grid">
      <div class="form-row">
        <label>姓（family）</label>
        <input v-model="form.family" placeholder="例如：王" />
      </div>
      <div class="form-row">
        <label>名（given）</label>
        <input v-model="form.given" placeholder="例如：大明" />
      </div>
    </div>
    <div class="form-row">
      <label>性別</label>
      <select v-model="form.gender">
        <option value="male">male</option>
        <option value="female">female</option>
        <option value="other">other</option>
        <option value="unknown">unknown</option>
      </select>
    </div>
    <button class="primary" :disabled="loading || !canSubmit" @click="submit">
      {{ loading ? '建立中…' : '送出建立' }}
    </button>
  </div>

  <JsonPreviewPanel endpoint="/practitioners" :payload="form" :disabled="!canSubmit" filename="practitioner" />

  <ResourceResultCard :result="result" />
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import api from '../api';
import { registerResource } from '../store';
import ResourceResultCard from '../components/ResourceResultCard.vue';
import JsonPreviewPanel from '../components/JsonPreviewPanel.vue';

const form = reactive({ family: '', given: '', gender: 'male' });
const result = ref(null);
const loading = ref(false);
const canSubmit = computed(() => form.family && form.given);

async function submit() {
  loading.value = true;
  result.value = null;
  try {
    const r = await api.post('/practitioners', { ...form });
    result.value = r.data;
    if (r.data.id) {
      registerResource('Practitioner', r.data.id, `${form.family}${form.given}（Practitioner/${r.data.id}）`);
    }
  } catch (err) {
    result.value = { status: 0, error: err.message };
  } finally {
    loading.value = false;
  }
}
</script>
