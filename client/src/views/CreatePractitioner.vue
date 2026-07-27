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
    <div class="form-row">
      <label>externalId（選填，Upsert 用）</label>
      <input v-model="form.externalId" placeholder="例如：PRAC-0001（醫事人員證號）" />
      <div class="hint">
        帶入穩定的證號後可用「Upsert 送出」：同一個 externalId 重複送出會
        更新既有資源，而非每次都建立新的
      </div>
    </div>
    <div class="button-row">
      <button class="primary" :disabled="loading || !canSubmit" @click="submit">
        {{ loading ? '建立中…' : '送出建立' }}
      </button>
      <button class="ghost" :disabled="loading || !canSubmit || !form.externalId" @click="upsert">
        {{ loading ? '處理中…' : 'Upsert 送出' }}
      </button>
    </div>
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

const form = reactive({ family: '', given: '', gender: 'male', externalId: '' });
const result = ref(null);
const loading = ref(false);
const canSubmit = computed(() => form.family && form.given);

async function send(method) {
  loading.value = true;
  result.value = null;
  try {
    const r = await api({ method, url: '/practitioners', data: { ...form } });
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

const submit = () => send('post');
const upsert = () => send('put');
</script>
