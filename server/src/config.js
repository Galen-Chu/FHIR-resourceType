require('dotenv').config();

module.exports = {
  FHIR_BASE_URL: process.env.FHIR_BASE_URL || 'https://twcore.hapi.fhir.tw/fhir',
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
