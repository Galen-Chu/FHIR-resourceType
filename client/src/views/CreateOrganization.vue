<template>
  <h2>建立 Organization</h2>
  <p class="subtitle">醫事機構（Organization-hosp-twcore）— 建立順序 1，最先建立</p>

  <div class="form-card">
    <div class="form-row">
      <label>機構名稱</label>
      <input v-model="form.name" placeholder="例如：仁愛醫院" />
      <div class="hint">identifier 由後端以測試命名空間 + 隨機亂數自動產生</div>
    </div>
    <div class="form-row">
      <label>啟用狀態</label>
      <select v-model="form.active">
        <option :value="true">active = true</option>
        <option :value="false">active = false</option>
      </select>
    </div>
    <button class="primary" :disabled="loading" @click="submit">
      {{ loading ? '建立中…' : '送出建立' }}
    </button>
  </div>

  <ResourceResultCard :result="result" />
</template>

<script setup>
import { ref, reactive } from 'vue';
import api from '../api';
import { registerResource } from '../store';
import ResourceResultCard from '../components/ResourceResultCard.vue';

const form = reactive({ name: '', active: true });
const result = ref(null);
const loading = ref(false);

async function submit() {
  loading.value = true;
  result.value = null;
  try {
    const r = await api.post('/organizations', { ...form });
    result.value = r.data;
    if (r.data.id) registerResource('Organization', r.data.id, `${form.name || '測試醫院'}（Organization/${r.data.id}）`);
  } catch (err) {
    result.value = { status: 0, error: err.message };
  } finally {
    loading.value = false;
  }
}
</script>
