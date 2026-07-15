<template>
  <nav class="sidebar">
    <h1>FHIR 交換測試系統</h1>

    <div class="group-title">FHIR Server 環境</div>
    <div class="env-select">
      <select v-model="currentEnv">
        <option v-for="s in servers" :key="s.key" :value="s.key">{{ s.label }}</option>
      </select>
      <div class="env-url">{{ currentUrl }}</div>
    </div>

    <div class="group-title">建立資源</div>
    <router-link to="/organizations/create">Organization</router-link>
    <router-link to="/practitioners/create">Practitioner</router-link>
    <router-link to="/patients/create">Patient</router-link>
    <router-link to="/encounters/create">Encounter</router-link>
    <router-link to="/conditions/create">Condition</router-link>
    <router-link to="/observations/create">Observation</router-link>
    <router-link to="/medication-requests/create">MedicationRequest</router-link>

    <div class="group-title">查詢</div>
    <router-link to="/query/by-organization">依機構查病患</router-link>
    <router-link to="/query/by-patient-id">依 ID 查病患</router-link>

    <div class="group-title">臨床決策支援</div>
    <router-link to="/cds-hooks">CDS Hooks 卡片</router-link>
  </nav>

  <main class="main">
    <router-view />
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from './api';
import { currentEnv } from './store';

// 靜態預設值，開機後以後端 /api/config/fhir-servers 的清單覆蓋
const servers = ref([
  { key: 'twcore', label: '台灣 TW Core 測試站', url: 'https://twcore.hapi.fhir.tw/fhir' },
  { key: 'hapi-org', label: 'HAPI 國際公開站（R4）', url: 'https://hapi.fhir.org/baseR4' }
]);

const currentUrl = computed(
  () => servers.value.find((s) => s.key === currentEnv.value)?.url || ''
);

onMounted(async () => {
  try {
    const r = await api.get('/config/fhir-servers');
    if (r.status === 200 && Array.isArray(r.data.servers)) {
      servers.value = r.data.servers;
    }
  } catch {
    // 後端未啟動時維持靜態清單
  }
});
</script>
