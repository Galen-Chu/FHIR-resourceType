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

  // TW Core IG Profile canonical URLs（meta.profile 用）
  PROFILES: {
    Organization: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Organization-hosp-twcore',
    Practitioner: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Practitioner-twcore',
    Patient: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Patient-twcore',
    Encounter: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Encounter-twcore',
    Condition: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Condition-twcore',
    Observation: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Observation-twcore',
    MedicationRequest: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/MedicationRequest-twcore'
  }
};
