// 結構化 log：七種資源共用同一套格式
// [2026-07-03 10:13:10] [twcore] → POST /Encounter
// [2026-07-03 10:13:10] [twcore] ← 201 Created Encounter/tw-enc-5510 (455ms)
// 同步輸出到 console 與 logs/exchange.log（存證用，可用 LOG_FILE 環境變數改路徑）
const fs = require('fs');
const path = require('path');

const LOG_FILE = process.env.LOG_FILE || path.join(process.cwd(), 'logs', 'exchange.log');
let logFileReady = false;

function writeFile(line) {
  try {
    if (!logFileReady) {
      fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
      logFileReady = true;
    }
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    // 檔案寫入失敗不影響服務，console 仍有完整輸出
  }
}

function out(line) {
  console.log(line);
  writeFile(line);
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function summarize(resource) {
  if (!resource || typeof resource !== 'object') return '';
  const parts = [`resourceType=${resource.resourceType}`];
  if (resource.identifier && resource.identifier[0]) {
    parts.push(`identifier=${resource.identifier[0].value}`);
  }
  if (resource.subject) parts.push(`subject=${resource.subject.reference}`);
  if (resource.encounter) parts.push(`encounter=${resource.encounter.reference}`);
  return parts.join(' ');
}

module.exports = {
  // 請求前：時間、目標環境、方法、路徑、組裝後的 resource 摘要
  request(method, path, resource, env) {
    const tag = env ? ` [${env}]` : '';
    out(`[${timestamp()}]${tag}  → ${method} ${path}${resource ? '  ' + summarize(resource) : ''}`);
  },

  // 回應後：HTTP status、resource id 或錯誤訊息、耗時 (ms)
  response(status, statusText, detail, ms, env) {
    const tag = env ? ` [${env}]` : '';
    out(`[${timestamp()}]${tag}  ← ${status} ${statusText}  ${detail}  (${ms}ms)`);
  },

  info(message, data) {
    out(`[${timestamp()}]  ${message}${data !== undefined ? ' ' + JSON.stringify(data) : ''}`);
  },

  error(message, data) {
    const line = `[${timestamp()}]  ✖ ${message}${data !== undefined ? ' ' + JSON.stringify(data) : ''}`;
    console.error(line);
    writeFile(line);
  }
};
