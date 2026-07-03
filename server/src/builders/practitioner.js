// Practitioner（Practitioner-twcore）
// 核心欄位：identifier、name（family/given）、gender
const { makeIdentifier, meta } = require('./common');

function buildPractitioner(input = {}) {
  const family = input.family || '王';
  const given = input.given || '大明';
  return {
    resourceType: 'Practitioner',
    meta: meta('Practitioner'),
    identifier: [makeIdentifier('practitioner', 'tw-prac')],
    active: true,
    name: [
      {
        text: `${family}${given}`,
        family,
        given: [given]
      }
    ],
    gender: input.gender || 'male'
  };
}

module.exports = buildPractitioner;
