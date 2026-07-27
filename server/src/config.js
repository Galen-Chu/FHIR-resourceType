require('dotenv').config();

module.exports = {
  // 可切換的 FHIR Server 環境：前端以 X-FHIR-Env header 指定，未指定時用 DEFAULT_FHIR_ENV
  FHIR_SERVERS: {
    twcore: {
      label: '台灣 TW Core 測試站',
      url: process.env.FHIR_URL_TWCORE || 'https://twcore.hapi.fhir.tw/fhir'
    },
    'hapi-org': {
      label: 'HAPI 國際公開站（R4）',
      url: process.env.FHIR_URL_HAPI_ORG || 'https://hapi.fhir.org/baseR4'
    }
  },
  DEFAULT_FHIR_ENV: process.env.FHIR_ENV || 'twcore',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  // 預留驗證擴充點：HAPI 測試站目前不需要 token，未來啟用時由環境變數帶入
  FHIR_AUTH_TOKEN: process.env.FHIR_AUTH_TOKEN || null,
  // Gateway 自身的鑑權（v4）：未設定時 /api 完全開放，維持現有行為；
  // 設定後每個 /api 請求需帶 X-Gateway-Key header 且值需相符
  GATEWAY_API_KEY: process.env.GATEWAY_API_KEY || null,

  // IG Profile 切換矩陣：前端以 X-FHIR-IG header 指定，未指定時用 DEFAULT_IG。
  // 與 X-FHIR-Env（寫入哪個 Server）是獨立維度，可交叉組合（見 docs/v4-design.md 第 2 節）
  IG_PROFILES: {
    'tw-core': {
      label: 'TW Core IG',
      profiles: {
        Organization: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Organization-hosp-twcore',
        Practitioner: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Practitioner-twcore',
        Patient: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Patient-twcore',
        Encounter: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Encounter-twcore',
        Condition: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Condition-twcore',
        Observation: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Observation-twcore',
        MedicationRequest: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/MedicationRequest-twcore'
      }
    },
    'r4-base': {
      label: 'FHIR R4 Base（無自訂 Profile）',
      profiles: {} // meta.profile 留空，對應 hapi.fhir.org 未載入 TW Core 驗證規則的現況
    }
  },
  DEFAULT_IG: process.env.FHIR_IG || 'tw-core'
};
