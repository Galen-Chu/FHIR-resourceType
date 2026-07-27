// FHIR 交換測試系統 — Express 中介 API
// 三層式架構：Vue 前端 → Express（proxy / 組裝層，不落地資料庫）→ HAPI FHIR 測試伺服器
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./logger');
const gatewayAuth = require('./middleware/gatewayAuth');

const app = express();

app.use(cors());
app.use(express.json());
// morgan 記錄 HTTP 存取層；logger.js 記錄 FHIR 交換細節
app.use(morgan('[:date[iso]]  :method :url :status :response-time ms'));

// Gateway 自身鑑權（v4）：未設定 GATEWAY_API_KEY 時完全不啟用；
// 只保護 /api，CDS Hooks（/cds-services）依規格是給臨床系統即時呼叫，
// 鑑權機制不同，不在本次範圍
app.use('/api', gatewayAuth);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', defaultEnv: config.DEFAULT_FHIR_ENV, servers: config.FHIR_SERVERS });
});

// 提供前端環境選擇器的清單
app.get('/api/config/fhir-servers', (req, res) => {
  res.json({
    default: config.DEFAULT_FHIR_ENV,
    servers: Object.entries(config.FHIR_SERVERS).map(([key, s]) => ({
      key,
      label: s.label,
      url: s.url
    }))
  });
});

// 提供前端 IG 選擇器的清單（v4：IG Profile 切換矩陣）
app.get('/api/config/fhir-igs', (req, res) => {
  res.json({
    default: config.DEFAULT_IG,
    igs: Object.entries(config.IG_PROFILES).map(([key, ig]) => ({
      key,
      label: ig.label
    }))
  });
});

// CDS Hooks 依規格掛在根路徑（discovery: GET /cds-services）
app.use('/cds-services', require('./cds'));

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
  for (const [key, s] of Object.entries(config.FHIR_SERVERS)) {
    const isDefault = key === config.DEFAULT_FHIR_ENV ? '（預設）' : '';
    logger.info(`FHIR 環境 [${key}]${isDefault}: ${s.url}`);
  }
});
