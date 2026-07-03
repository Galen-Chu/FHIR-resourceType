// 已建立資源登錄簿：供後續步驟的下拉選單使用（patientId / encounterId / ...）
// 以 localStorage 保存，重新整理不遺失
import { reactive, watch } from 'vue';

const STORAGE_KEY = 'fhir-exchange-created-resources';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export const createdResources = reactive({
  Organization: [],
  Practitioner: [],
  Patient: [],
  Encounter: [],
  Condition: [],
  Observation: [],
  MedicationRequest: [],
  ...load()
});

watch(
  createdResources,
  (val) => localStorage.setItem(STORAGE_KEY, JSON.stringify(val)),
  { deep: true }
);

export function registerResource(resourceType, id, label) {
  if (!id) return;
  if (!createdResources[resourceType]) createdResources[resourceType] = [];
  if (createdResources[resourceType].some((r) => r.id === id)) return;
  createdResources[resourceType].push({ id, label: label || id });
}
