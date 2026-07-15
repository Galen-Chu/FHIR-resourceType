// CDS Hooks 端點（https://cds-hooks.hl7.org/，規格 1.0/2.0 相容的最小實作）
// - GET  /cds-services                     Discovery：列出可用服務
// - POST /cds-services/patient-summary     patient-view hook：病患摘要 + 生命徵象警示
// - POST /cds-services/medication-duplicate-check
//                                          order-select hook：重複用藥檢查
// 資料來源為既有讀取路徑（fhirClient → 選定環境的 FHIR Server），不落地資料庫
const express = require('express');
const config = require('../config');
const fhirClient = require('../fhirClient');
const logger = require('../logger');
const { buildPatientSummaryCards } = require('./patientSummary');
const { buildMedicationDuplicateCards } = require('./medicationCheck');

const router = express.Router();

const SERVICES = [
  {
    hook: 'patient-view',
    id: 'patient-summary',
    title: '病患摘要與生命徵象警示',
    description:
      '開啟病患畫面時，彙整該病患的診斷（Condition）、生命徵象（Observation）與用藥醫囑（MedicationRequest），生命徵象超出正常範圍時回傳 warning 卡片。'
  },
  {
    hook: 'order-select',
    id: 'medication-duplicate-check',
    title: '重複用藥檢查',
    description:
      '選擇藥囑時，比對病患現有 active MedicationRequest，發現同名／同代碼藥品時回傳 warning 卡片。'
  }
];

// 環境決定順序：X-FHIR-Env header → request body 的 fhirServer 欄位比對 → 預設環境
function resolveEnv(req) {
  const headerEnv = req.get('X-FHIR-Env');
  if (headerEnv && config.FHIR_SERVERS[headerEnv]) return headerEnv;
  const fhirServer = req.body && req.body.fhirServer;
  if (fhirServer) {
    const match = Object.entries(config.FHIR_SERVERS).find(([, s]) => s.url === fhirServer);
    if (match) return match[0];
  }
  return config.DEFAULT_FHIR_ENV;
}

// Discovery
router.get('/', (req, res) => {
  res.json({ services: SERVICES });
});

router.post('/patient-summary', async (req, res) => {
  const env = resolveEnv(req);
  const context = (req.body && req.body.context) || {};
  if (!context.patientId) {
    res.status(400).json({ error: 'context.patientId 為必填' });
    return;
  }
  try {
    const cards = await buildPatientSummaryCards(fhirClient, context.patientId, env);
    res.json({ cards });
  } catch (err) {
    logger.error('CDS patient-summary failed', { message: err.message });
    res.status(502).json({ error: `FHIR Server 呼叫失敗：${err.message}` });
  }
});

router.post('/medication-duplicate-check', async (req, res) => {
  const env = resolveEnv(req);
  const context = (req.body && req.body.context) || {};
  if (!context.patientId) {
    res.status(400).json({ error: 'context.patientId 為必填' });
    return;
  }
  try {
    const cards = await buildMedicationDuplicateCards(fhirClient, context, env);
    res.json({ cards });
  } catch (err) {
    logger.error('CDS medication-duplicate-check failed', { message: err.message });
    res.status(502).json({ error: `FHIR Server 呼叫失敗：${err.message}` });
  }
});

module.exports = router;
