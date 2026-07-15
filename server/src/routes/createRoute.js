// 七種資源共用的建立端點模式：
// POST /api/{resource} → builder 組裝 TW Core JSON → 轉呼叫 HAPI FHIR
// → 回應整理成一致的 { id, status, resourceType } 格式
const express = require('express');
const fhirClient = require('../fhirClient');
const logger = require('../logger');
const { ValidationError } = require('../builders/common');

// 缺必填欄位時回傳與 FHIR Server 一致的 OperationOutcome 格式，
// 前端紅色結果卡片可直接顯示
function validationOutcome(err) {
  return {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: 'error',
        code: 'required',
        details: { text: err.message },
        diagnostics: `missing required field(s): ${err.missing.join(', ')}`
      }
    ]
  };
}

function createRoute(resourceType, builder) {
  const router = express.Router();

  // 產生組裝後的 TW Core JSON（不呼叫 FHIR Server）
  // 供前端顯示、複製到 FHIR Validator 手動驗證資料格式
  router.post('/preview', (req, res) => {
    try {
      const resource = builder(req.body || {});
      logger.info(`⊙ Preview ${resourceType} JSON（未送出）`);
      res.json(resource);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ resourceType, status: 400, outcome: validationOutcome(err) });
        return;
      }
      res.status(400).json({ status: 400, error: `JSON 組裝失敗：${err.message}` });
    }
  });

  router.post('/', async (req, res) => {
    const env = fhirClient.resolveEnv(req.get('X-FHIR-Env'));
    try {
      const resource = builder(req.body || {});
      const r = await fhirClient.post(`/${resourceType}`, resource, env);

      if (r.status >= 200 && r.status < 300) {
        res.status(r.status).json({
          resourceType,
          id: r.data.id,
          status: r.status,
          env
        });
      } else {
        // 4xx/5xx：帶回 OperationOutcome 供前端顯示錯誤訊息
        res.status(r.status).json({
          resourceType,
          status: r.status,
          env,
          outcome: r.data
        });
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        logger.error(`POST /${resourceType} 必填欄位檢查失敗`, { missing: err.missing });
        res.status(400).json({ resourceType, status: 400, outcome: validationOutcome(err) });
        return;
      }
      logger.error(`POST /${resourceType} failed`, { message: err.message });
      res.status(502).json({
        resourceType,
        status: 502,
        error: `FHIR Server 呼叫失敗：${err.message}`
      });
    }
  });

  return router;
}

module.exports = createRoute;
