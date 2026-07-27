// 七種資源共用的建立端點模式：
// POST /api/{resource} → builder 組裝 TW Core JSON → 轉呼叫 HAPI FHIR
// → 回應整理成一致的 { id, status, resourceType } 格式
// PUT  /api/{resource} → Upsert（conditional update）：依 externalId 判斷
// 已存在則更新、不存在則新增；同 externalId 的併發寫入序列化，防止 Race Condition
const express = require('express');
const fhirClient = require('../fhirClient');
const { resolveIG } = require('../igResolver');
const { withKeyLock } = require('../utils/keyedQueue');
const logger = require('../logger');
const { ValidationError } = require('../builders/common');

// 欄位驗證失敗時回傳與 FHIR Server 一致的 OperationOutcome 格式，
// 前端紅色結果卡片可直接顯示。code 沿用 ValidationError 的 IssueType
// （required：缺欄位／value：格式不合法），diagnostics 對應調整措辭
function validationOutcome(err) {
  const label = err.code === 'value' ? 'invalid field value(s)' : 'missing required field(s)';
  return {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: 'error',
        code: err.code,
        details: { text: err.message },
        diagnostics: `${label}: ${err.missing.join(', ')}`
      }
    ]
  };
}

// POST 與 PUT 共用的組裝 + 呼叫 FHIR Server + 回應整理邏輯：
// - extraFields：成功時附加的額外欄位（PUT 用來附 outcome: created/updated）
// - errorOverride：非 2xx 時可覆寫 status/outcome（PUT 用來把 412 多筆匹配
//   轉譯為更明確的 409 重複資料錯誤，見 docs/v4-design.md 第 3 節設計 C）
async function submitResource(req, res, resourceType, builder, callFhir, extraFields, errorOverride) {
  const env = fhirClient.resolveEnv(req.get('X-FHIR-Env'));
  const ig = resolveIG(req.get('X-FHIR-IG'));
  try {
    const resource = builder(req.body || {}, ig);
    const r = await callFhir(resource, env);

    if (r.status >= 200 && r.status < 300) {
      res.status(r.status).json({
        resourceType,
        id: r.data.id,
        status: r.status,
        env,
        ig,
        ...(extraFields ? extraFields(r) : {})
      });
    } else {
      // 4xx/5xx：帶回 OperationOutcome 供前端顯示錯誤訊息（除非被 errorOverride 覆寫）
      const override = errorOverride ? errorOverride(r) : null;
      res.status(override ? override.status : r.status).json({
        resourceType,
        status: override ? override.status : r.status,
        env,
        ig,
        outcome: override ? override.outcome : r.data
      });
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      logger.error(`${req.method} /${resourceType} 欄位驗證失敗`, { missing: err.missing });
      res.status(400).json({ resourceType, status: 400, outcome: validationOutcome(err) });
      return;
    }
    logger.error(`${req.method} /${resourceType} failed`, { message: err.message });
    res.status(502).json({
      resourceType,
      status: 502,
      error: `FHIR Server 呼叫失敗：${err.message}`
    });
  }
}

function createRoute(resourceType, builder) {
  const router = express.Router();

  // 產生組裝後的 TW Core JSON（不呼叫 FHIR Server）
  // 供前端顯示、複製到 FHIR Validator 手動驗證資料格式
  router.post('/preview', (req, res) => {
    const ig = resolveIG(req.get('X-FHIR-IG'));
    try {
      const resource = builder(req.body || {}, ig);
      logger.info(`⊙ Preview ${resourceType} JSON（未送出，ig=${ig}）`);
      res.json(resource);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ resourceType, status: 400, outcome: validationOutcome(err) });
        return;
      }
      res.status(400).json({ status: 400, error: `JSON 組裝失敗：${err.message}` });
    }
  });

  router.post('/', (req, res) =>
    submitResource(req, res, resourceType, builder, (resource, env) =>
      fhirClient.post(`/${resourceType}`, resource, env)
    )
  );

  // Upsert：需要呼叫端提供穩定的 externalId（病歷號、機構代碼等），
  // 否則每次都會被視為新資源、PUT 語意就沒有意義
  router.put('/', async (req, res) => {
    const externalId = req.body && req.body.externalId;
    if (!externalId) {
      const err = new ValidationError(['externalId'], {
        message: 'Upsert 需要提供穩定的 externalId（病歷號／機構代碼等），否則每次都會被視為新資源'
      });
      res.status(400).json({ resourceType, status: 400, outcome: validationOutcome(err) });
      return;
    }

    await withKeyLock(`${resourceType}:${externalId}`, () =>
      submitResource(
        req,
        res,
        resourceType,
        builder,
        (resource, env) => fhirClient.upsert(resourceType, resource, resource.identifier[0], env),
        (r) => ({ outcome: r.status === 201 ? 'created' : 'updated' }),
        (r) =>
          r.status === 412
            ? {
                status: 409,
                outcome: {
                  resourceType: 'OperationOutcome',
                  issue: [
                    {
                      severity: 'error',
                      code: 'duplicate',
                      details: {
                        text: `externalId=${externalId} 對應多筆既有資源，可能為外部資料重複，需人工複核`
                      }
                    }
                  ]
                }
              }
            : null
      )
    );
  });

  return router;
}

module.exports = createRoute;
