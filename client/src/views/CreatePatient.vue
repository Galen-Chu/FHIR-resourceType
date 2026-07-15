<template>
  <h2>建立 Patient</h2>
  <p class="subtitle">病患（Patient-twcore）— 建立順序 3，managingOrganization → Organization</p>

  <div class="form-card">
    <div class="form-grid">
      <div class="form-row">
        <label>姓（family）</label>
        <input v-model="form.family" placeholder="例如：陳" />
      </div>
      <div class="form-row">
        <label>名（given）</label>
        <input v-model="form.given" placeholder="例如：小明" />
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
        <label>出生日期</label>
        <input v-model="form.birthDate" type="date" />
      </div>
      <div class="form-row">
        <label>聯絡電話（telecom）</label>
        <input v-model="form.phone" placeholder="例如：0912345678" />
      </div>
      <div class="form-row">
        <label>地址（address）</label>
        <input v-model="form.address" placeholder="例如：臺北市大安區仁愛路一段 1 號" />
      </div>
    </div>
    <div class="form-row">
      <label>就醫機構（managingOrganization）</label>
      <select v-model="form.organizationId">
        <option disabled value="">— 選擇已建立的 Organization —</option>
        <option v-for="o in createdResources.Organization" :key="o.id" :value="o.id">
          {{ o.label }}
        </option>
      </select>
      <div class="hint">請先於「Organization」頁建立機構</div>
    </div>
    <button class="primary" :disabled="loading || !canSubmit" @click="submit">
      {{ loading ? '建立中…' : '送出建立' }}
    </button>
  </div>

  <JsonPreviewPanel endpoint="/patients" :payload="form" :disabled="!canSubmit" filename="patient" />

  <ResourceResultCard :result="result" />
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import api from '../api';
import { createdResources, registerResource } from '../store';
import ResourceResultCard from '../components/ResourceResultCard.vue';
import JsonPreviewPanel from '../components/JsonPreviewPanel.vue';

const form = reactive({
  family: '',
  given: '',
  gender: 'male',
  birthDate: '1990-01-01',
  phone: '',
  address: '',
  organizationId: ''
});
const result = ref(null);
const loading = ref(false);
const canSubmit = computed(() => form.family && form.given && form.birthDate && form.organizationId);

async function submit() {
  loading.value = true;
  result.value = null;
  try {
    const r = await api.post('/patients', { ...form });
    result.value = r.data;
    if (r.data.id) {
      registerResource('Patient', r.data.id, `${form.family}${form.given}（Patient/${r.data.id}）`);
    }
  } catch (err) {
    result.value = { status: 0, error: err.message };
  } finally {
    loading.value = false;
  }
}
</script>
