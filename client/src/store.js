// 環境切換 + 已建立資源登錄簿
// - currentEnv：目前選擇的 FHIR Server 環境（twcore / hapi-org），存 localStorage
// - 登錄簿依環境隔離：twcore 建立的資源 id 在 hapi-org 上不存在，
//   切換環境後下拉選單只顯示該環境建立過的資源，避免跨環境無效 reference
import { reactive, ref, computed, watch } from 'vue';

const ENV_KEY = 'fhir-exchange-env';
const STORAGE_KEY = 'fhir-exchange-created-resources';

export const currentEnv = ref(localStorage.getItem(ENV_KEY) || 'twcore');
watch(currentEnv, (v) => localStorage.setItem(ENV_KEY, v));

const RESOURCE_TYPES = [
  'Organization',
  'Practitioner',
  'Patient',
  'Encounter',
  'Condition',
  'Observation',
  'MedicationRequest'
];

function emptyRegistry() {
  return Object.fromEntries(RESOURCE_TYPES.map((t) => [t, []]));
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    // 相容舊版扁平格式（未分環境）：視為 twcore 的登錄簿
    if (Array.isArray(raw.Organization)) return { twcore: raw };
    return raw;
  } catch {
    return {};
  }
}

const registries = reactive(load());

function registryFor(env) {
  if (!registries[env]) registries[env] = emptyRegistry();
  for (const t of RESOURCE_TYPES) {
    if (!registries[env][t]) registries[env][t] = [];
  }
  return registries[env];
}

// 各頁面下拉選單的資料來源：永遠對應目前環境
export const createdResources = computed(() => registryFor(currentEnv.value));

watch(
  registries,
  () => localStorage.setItem(STORAGE_KEY, JSON.stringify(registries)),
  { deep: true }
);

export function registerResource(resourceType, id, label) {
  if (!id) return;
  const registry = registryFor(currentEnv.value);
  if (registry[resourceType].some((r) => r.id === id)) return;
  registry[resourceType].push({ id, label: label || id });
}
