// Practitioner（Practitioner-twcore）
// 核心欄位：identifier、name（family/given）、gender
const { makeIdentifier, meta, requireFields } = require('./common');

function buildPractitioner(input = {}, ig) {
  requireFields(input, ['family', 'given', 'gender']);
  const { family, given } = input;
  return {
    resourceType: 'Practitioner',
    meta: meta('Practitioner', ig),
    identifier: [makeIdentifier('practitioner', 'tw-prac')],
    active: true,
    name: [
      {
        text: `${family}${given}`,
        family,
        given: [given]
      }
    ],
    gender: input.gender
  };
}

module.exports = buildPractitioner;
