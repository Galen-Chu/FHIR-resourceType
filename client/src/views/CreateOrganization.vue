<template>
  <h2>建立 Organization</h2>
  <p class="subtitle">醫事機構（Organization-hosp-twcore）— 建立順序 1，最先建立</p>

  <div class="form-card">
    <div class="form-row">
      <label>機構名稱</label>
      <input v-model="form.name" placeholder="例如：仁愛醫院" required />
      <div class="hint">必填；identifier 由後端以測試命名空間 + 隨機亂數自動產生</div>
    </div>
    <div class="form-row">
      <label>啟用狀態</label>
      <select v-model="form.active">
        <option :value="true">active = true</option>
        <option :value="false">active = false</option>
      </select>
    </div>
    <div class="form-row">
      <label>externalId（選填，Upsert 用）</label>
      <input v-model="form.externalId" placeholder="例如：HOSP-A（院所代碼）" />
      <div class="hint">
        帶入穩定的機構代碼後可用「Upsert 送出」：同一個 externalId 重複送出會
        更新既有資源，而非每次都建立新的
      </div>
    </div>
    <div class="button-row">
      <button class="primary" :disabled="loading || !form.name" @click="submit">
        {{ loading ? '建立中…' : '送出建立' }}
      </button>
      <button class="ghost" :disabled="loading || !form.name || !form.externalId" @click="upsert">
        {{ loading ? '處理中…' : 'Upsert 送出' }}
      </button>
    </div>
  </div>

  <JsonPreviewPanel endpoint="/organizations" :payload="form" :disabled="!form.name" filename="organization" />

  <ResourceResultCard :result="result" />
</template>

<script setup>
import { ref, reactive } from 'vue';
import api from '../api';
import { registerResource } from '../store';
import ResourceResultCard from '../components/ResourceResultCard.vue';
import JsonPreviewPanel from '../components/JsonPreviewPanel.vue';

const form = reactive({ name: '', active: true, externalId: '' });
const result = ref(null);
const loading = ref(false);

async function send(method) {
  loading.value = true;
  result.value = null;
  try {
    const r = await api({ method, url: '/organizations', data: { ...form } });
    result.value = r.data;
    if (r.data.id) registerResource('Organization', r.data.id, `${form.name || '測試醫院'}（Organization/${r.data.id}）`);
  } catch (err) {
    result.value = { status: 0, error: err.message };
  } finally {
    loading.value = false;
  }
}

const submit = () => send('post');
const upsert = () => send('put');
</script>
