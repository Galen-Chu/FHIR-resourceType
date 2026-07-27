// axios wrapper：所有 FHIR Server 呼叫的單一出口
// 統一 header、耗時計算與結構化 log；預留 auth header 擴充點
// 支援多環境：每次呼叫可帶 env（twcore / hapi-org），未帶時用預設環境
const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

const clients = {};

function resolveEnv(env) {
  return config.FHIR_SERVERS[env] ? env : config.DEFAULT_FHIR_ENV;
}

function clientFor(env) {
  if (!clients[env]) {
    const http = axios.create({
      baseURL: config.FHIR_SERVERS[env].url,
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

    clients[env] = http;
  }
  return clients[env];
}

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

async function post(path, resource, env) {
  const e = resolveEnv(env);
  logger.request('POST', path, resource, e);
  const started = Date.now();
  const r = await clientFor(e).post(path, resource);
  logger.response(r.status, r.statusText, describeResult(r), Date.now() - started, e);
  return r;
}

async function get(path, params, env) {
  const e = resolveEnv(env);
  logger.request('GET', path, null, e);
  const started = Date.now();
  const r = await clientFor(e).get(path, { params });
  logger.response(r.status, r.statusText, describeResult(r), Date.now() - started, e);
  return r;
}

// Upsert：FHIR conditional update（PUT /{resourceType}?identifier=system|value）。
// HAPI 依 identifier 搜尋後自己判斷新增或更新（0 筆新增／1 筆更新／多筆 412），
// 搜尋與寫入在 Server 端是原子操作——比 Gateway 自己刻「先查後寫」更可靠
async function upsert(resourceType, resource, identifier, env) {
  const e = resolveEnv(env);
  const query = `identifier=${encodeURIComponent(`${identifier.system}|${identifier.value}`)}`;
  const path = `/${resourceType}?${query}`;
  logger.request('PUT', path, resource, e);
  const started = Date.now();
  const r = await clientFor(e).put(path, resource);
  logger.response(r.status, r.statusText, describeResult(r), Date.now() - started, e);
  return r;
}

module.exports = { post, get, upsert, resolveEnv };
