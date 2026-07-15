<template>
  <h2>CDS Hooks</h2>
  <p class="subtitle">
    臨床決策支援卡片 — discovery：<code>GET /cds-services</code>，
    服務以既有讀取路徑查詢目前環境的 FHIR Server
  </p>

  <!-- 服務 1：patient-view -->
  <div class="form-card">
    <h3 class="cds-service-title">病患摘要與生命徵象警示<span class="hook-tag">patient-view</span></h3>
    <div class="form-row">
      <label>病患</label>
      <select v-model="patientId">
        <option disabled value="">— 選擇已建立的 Patient —</option>
        <option v-for="p in createdResources.Patient" :key="p.id" :value="p.id">{{ p.label }}</option>
      </select>
    </div>
    <button class="primary" :disabled="loadingSummary || !patientId" @click="callPatientSummary">
      {{ loadingSummary ? '呼叫中…' : '呼叫 patient-summary' }}
    </button>
  </div>

  <!-- 服務 2：order-select -->
  <div class="form-card">
    <h3 class="cds-service-title">重複用藥檢查<span class="hook-tag">order-select</span></h3>
    <div class="form-row">
      <label>病患</label>
      <select v-model="orderPatientId">
        <option disabled value="">— 選擇已建立的 Patient —</option>
        <option v-for="p in createdResources.Patient" :key="p.id" :value="p.id">{{ p.label }}</option>
      </select>
    </div>
    <div class="form-row">
      <label>欲開立藥品名稱</label>
      <input v-model="draftMedicationText" placeholder="例如：普拿疼 500mg 錠劑" />
      <div class="hint">與病患現有 active MedicationRequest 比對是否重複</div>
    </div>
    <button
      class="primary"
      :disabled="loadingDuplicate || !orderPatientId || !draftMedicationText"
      @click="callDuplicateCheck"
    >
      {{ loadingDuplicate ? '呼叫中…' : '呼叫 medication-duplicate-check' }}
    </button>
  </div>

  <div v-if="error" class="result-card error">
    <div class="status-line">✖ {{ error.status }}</div>
    <div class="detail">{{ error.message }}</div>
  </div>

  <template v-if="cards.length">
    <p class="subtitle">回傳 {{ cards.length }} 張卡片</p>
    <div v-for="(card, i) in cards" :key="i" class="cds-card" :class="card.indicator">
      <div class="cds-card-summary">
        <span class="cds-indicator">{{ INDICATOR_LABEL[card.indicator] || card.indicator }}</span>
        {{ card.summary }}
      </div>
      <div class="cds-card-detail" v-html="renderDetail(card.detail)"></div>
      <div class="cds-card-source">source: {{ card.source?.label }}</div>
    </div>
  </template>
</template>

<script setup>
import { ref } from 'vue';
import { cdsApi } from '../api';
import { createdResources } from '../store';

const INDICATOR_LABEL = { info: 'ℹ INFO', warning: '⚠ WARNING', critical: '✖ CRITICAL' };

// CDS Hooks 的 card.detail 為 markdown；此處僅支援粗體與換行，先跳脫 HTML 再轉換
function renderDetail(md) {
  const escaped = String(md || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

const patientId = ref('');
const orderPatientId = ref('');
const draftMedicationText = ref('');
const cards = ref([]);
const error = ref(null);
const loadingSummary = ref(false);
const loadingDuplicate = ref(false);

async function invoke(serviceId, context, loadingRef) {
  loadingRef.value = true;
  error.value = null;
  cards.value = [];
  try {
    const r = await cdsApi.post(`/cds-services/${serviceId}`, {
      hook: serviceId === 'patient-summary' ? 'patient-view' : 'order-select',
      hookInstance: crypto.randomUUID(),
      context
    });
    if (r.status >= 200 && r.status < 300) {
      cards.value = r.data.cards || [];
    } else {
      error.value = { status: r.status, message: r.data.error || '呼叫失敗' };
    }
  } catch (err) {
    error.value = { status: 0, message: err.message };
  } finally {
    loadingRef.value = false;
  }
}

function callPatientSummary() {
  invoke('patient-summary', { patientId: patientId.value }, loadingSummary);
}

function callDuplicateCheck() {
  invoke(
    'medication-duplicate-check',
    { patientId: orderPatientId.value, medicationText: draftMedicationText.value },
    loadingDuplicate
  );
}
</script>
