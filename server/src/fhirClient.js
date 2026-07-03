// axios wrapper：所有 FHIR Server 呼叫的單一出口
// 統一 header、耗時計算與結構化 log；預留 auth header 擴充點
const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

const http = axios.create({
  baseURL: config.FHIR_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  },
  // 4xx/5xx 不丟例外，由 route 層統一整理回應
  validateStatus: () => true
});

// auth 擴充點：HAPI 測試站目前免驗證；未來設定 FHIR_AUTH_TOKEN 即自動帶入
http.interceptors.request.use((req) => {
  if (config.FHIR_AUTH_TOKEN) {
    req.headers.Authorization = `Bearer ${config.FHIR_AUTH_TOKEN}`;
  }
  return req;
});

function describeResult(r) {
  const data = r.data || {};
  if (data.resourceType === 'OperationOutcome') {
    const issue = (data.issue && data.issue[0]) || {};
    const text = (issue.details && issue.details.text) || issue.diagnostics || 'unknown issue';
    return `OperationOutcome: ${text}`;
  }
  if (data.resourceType === 'Bundle') {
    return `Bundle · total=${data.total !== undefined ? data.total : (data.entry || []).length}`;
  }
  if (data.resourceType && data.id) {
    return `${data.resourceType}/${data.id}`;
  }
  return '';
}

async function post(path, resource) {
  logger.request('POST', path, resource);
  const started = Date.now();
  const r = await http.post(path, resource);
  logger.response(r.status, r.statusText, describeResult(r), Date.now() - started);
  return r;
}

async function get(path, params) {
  logger.request('GET', path);
  const started = Date.now();
  const r = await http.get(path, { params });
  logger.response(r.status, r.statusText, describeResult(r), Date.now() - started);
  return r;
}

module.exports = { post, get };
