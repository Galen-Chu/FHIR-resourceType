// FHIR 交換測試系統 — Express 中介 API
// 三層式架構：Vue 前端 → Express（proxy / 組裝層，不落地資料庫）→ HAPI FHIR 測試伺服器
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./logger');

const app = express();

app.use(cors());
app.use(express.json());
// morgan 記錄 HTTP 存取層；logger.js 記錄 FHIR 交換細節
app.use(morgan('[:date[iso]]  :method :url :status :response-time ms'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', fhirBaseUrl: config.FHIR_BASE_URL });
});

app.use('/api/organizations', require('./routes/organizations'));
app.use('/api/practitioners', require('./routes/practitioners'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/encounters', require('./routes/encounters'));
app.use('/api/conditions', require('./routes/conditions'));
app.use('/api/observations', require('./routes/observations'));
app.use('/api/medication-requests', require('./routes/medicationRequests'));

app.use((req, res) => {
  res.status(404).json({ status: 404, error: `找不到路徑：${req.method} ${req.originalUrl}` });
});

app.listen(config.PORT, () => {
  logger.info(`FHIR Exchange Test Server 啟動於 http://localhost:${config.PORT}`);
  logger.info(`FHIR Base URL: ${config.FHIR_BASE_URL}`);
});
