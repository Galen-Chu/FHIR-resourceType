// POST /api/patients     → POST /Patient
// GET  /api/patients/:id → GET /Patient/{id}（查詢 B）
const fhirClient = require('../fhirClient');
const logger = require('../logger');
const buildPatient = require('../builders/patient');
const createRoute = require('./createRoute');

const router = createRoute('Patient', buildPatient);

router.get('/:id', async (req, res) => {
  try {
    const r = await fhirClient.get(`/Patient/${encodeURIComponent(req.params.id)}`);

    if (r.status >= 200 && r.status < 300) {
      res.json({ status: r.status, patient: r.data });
    } else {
      // 找不到時回傳 404，並附上 FHIR 的 OperationOutcome 訊息
      res.status(r.status).json({ status: r.status, outcome: r.data });
    }
  } catch (err) {
    logger.error('GET patient by id failed', { message: err.message });
    res.status(502).json({ status: 502, error: `FHIR Server 呼叫失敗：${err.message}` });
  }
});

module.exports = router;
