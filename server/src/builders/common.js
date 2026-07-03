// Builder 共用工具
// identifier 設計（已確認）：不使用真實個資／機構代碼，
// system 採測試專用命名空間 urn:test:tw-exchange:{resource}-id，value 由後端隨機亂數產生
const crypto = require('crypto');
const { PROFILES } = require('../config');

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

module.exports = { makeIdentifier, meta, reference, randomValue };
