// 結構化 console log：七種資源共用同一套格式
// [2026-07-03 10:13:10] → POST /Encounter
// [2026-07-03 10:13:10] ← 201 Created Encounter/tw-enc-5510 (455ms)

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
  // 請求前：時間、方法、路徑、組裝後的 resource 摘要
  request(method, path, resource) {
    console.log(`[${timestamp()}]  → ${method} ${path}${resource ? '  ' + summarize(resource) : ''}`);
  },

  // 回應後：HTTP status、resource id 或錯誤訊息、耗時 (ms)
  response(status, statusText, detail, ms) {
    console.log(`[${timestamp()}]  ← ${status} ${statusText}  ${detail}  (${ms}ms)`);
  },

  info(message, data) {
    console.log(`[${timestamp()}]  ${message}`, data !== undefined ? JSON.stringify(data) : '');
  },

  error(message, data) {
    console.error(`[${timestamp()}]  ✖ ${message}`, data !== undefined ? JSON.stringify(data) : '');
  }
};
