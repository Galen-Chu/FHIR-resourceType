<template>
  <h2>查詢 A：某 Organization 的所有病患</h2>
  <p class="subtitle">GET /api/organizations/:id/patients → GET /Patient?organization=Organization/{id}</p>

  <div class="form-card">
    <div class="form-row">
      <label>選擇機構</label>
      <select v-model="organizationId">
        <option disabled value="">— 選擇已建立的 Organization —</option>
        <option v-for="o in createdResources.Organization" :key="o.id" :value="o.id">{{ o.label }}</option>
      </select>
      <div class="hint">也可直接輸入機構 id：</div>
      <input v-model="organizationId" placeholder="Organization id，例如：17" style="margin-top: 6px" />
    </div>
    <button class="primary" :disabled="loading || !organizationId" @click="search">
      {{ loading ? '查詢中…' : '查詢' }}
    </button>
  </div>

  <div v-if="error" class="result-card error">
    <div class="status-line">✖ {{ error.status }}</div>
    <div class="detail">{{ error.message }}</div>
  </div>

  <template v-if="patients !== null && !error">
    <p class="subtitle">共 {{ total }} 筆</p>
    <table class="result-table" v-if="patients.length">
      <thead>
        <tr>
          <th>姓名</th>
          <th>identifier</th>
          <th>Patient id</th>
          <th>性別</th>
          <th>狀態</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in patients" :key="p.id">
          <td>{{ p.name }}</td>
          <td>{{ p.identifier }}</td>
          <td>{{ p.id }}</td>
          <td>{{ p.gender }}</td>
          <td>{{ p.active ? 'active' : 'inactive' }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="form-card">此機構下尚無病患。</div>
  </template>
</template>

<script setup>
import { ref } from 'vue';
import api from '../api';
import { createdResources } from '../store';

const organizationId = ref('');
const patients = ref(null);
const total = ref(0);
const error = ref(null);
const loading = ref(false);

async function search() {
  loading.value = true;
  error.value = null;
  patients.value = null;
  try {
    const r = await api.get(`/organizations/${encodeURIComponent(organizationId.value)}/patients`);
    if (r.status >= 200 && r.status < 300) {
      patients.value = r.data.patients;
      total.value = r.data.total;
    } else {
      const outcome = r.data.outcome;
      error.value = {
        status: r.status,
        message:
          (outcome && (outcome.issue || []).map((i) => (i.details && i.details.text) || i.diagnostics).join('\n')) ||
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
