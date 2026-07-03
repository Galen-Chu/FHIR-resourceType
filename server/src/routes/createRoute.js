// 七種資源共用的建立端點模式：
// POST /api/{resource} → builder 組裝 TW Core JSON → 轉呼叫 HAPI FHIR
// → 回應整理成一致的 { id, status, resourceType } 格式
const express = require('express');
const fhirClient = require('../fhirClient');
const logger = require('../logger');

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
      res.status(400).json({ status: 400, error: `JSON 組裝失敗：${err.message}` });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const resource = builder(req.body || {});
      const r = await fhirClient.post(`/${resourceType}`, resource);

      if (r.status >= 200 && r.status < 300) {
        res.status(r.status).json({
          resourceType,
          id: r.data.id,
          status: r.status
        });
      } else {
        // 4xx/5xx：帶回 OperationOutcome 供前端顯示錯誤訊息
        res.status(r.status).json({
          resourceType,
          status: r.status,
          outcome: r.data
        });
      }
    } catch (err) {
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
