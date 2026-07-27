// IG Profile 切換：與 fhirClient.resolveEnv 平行的解析邏輯，
// 差別在於 env 決定「寫去哪個 Server」、ig 決定「用哪組 Profile 組裝資源」
const config = require('./config');

function resolveIG(ig) {
  return config.IG_PROFILES[ig] ? ig : config.DEFAULT_IG;
}

module.exports = { resolveIG };
