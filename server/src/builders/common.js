// Builder 共用工具
// identifier 設計（已確認）：不使用真實個資／機構代碼，
// system 採測試專用命名空間 urn:test:tw-exchange:{resource}-id，value 由後端隨機亂數產生
const crypto = require('crypto');
const { PROFILES } = require('../config');

// 欄位驗證失敗時由 route 層轉為 400 + OperationOutcome（貼近聯測實況，
// 不以預設值靜默補齊，避免「前端沒把資料帶到」的 bug 被掩蓋）
// code 對應 FHIR OperationOutcome 的 IssueType：
//   required — 缺必填欄位（預設）；value — 欄位有值但格式/內容不合法
class ValidationError extends Error {
  constructor(missing, { message, code = 'required' } = {}) {
    super(message || `缺少必填欄位：${missing.join('、')}`);
    this.name = 'ValidationError';
    this.missing = missing;
    this.code = code;
  }
}

function requireFields(input, fields) {
  const missing = fields.filter(
    (f) => input[f] === undefined || input[f] === null || input[f] === ''
  );
  if (missing.length) throw new ValidationError(missing);
}

function randomValue(prefix) {
  return `${prefix}-${crypto.randomInt(10000000, 99999999)}`;
}

function makeIdentifier(resourceKey, prefix) {
  return {
    system: `urn:test:tw-exchange:${resourceKey}-id`,
    value: randomValue(prefix)
  };
}

function meta(resourceType) {
  return { profile: [PROFILES[resourceType]] };
}

function reference(resourceType, id) {
  return { reference: `${resourceType}/${id}` };
}

module.exports = { makeIdentifier, meta, reference, randomValue, requireFields, ValidationError };
