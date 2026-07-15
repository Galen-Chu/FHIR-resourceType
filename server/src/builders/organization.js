// Organization（Organization-hosp-twcore）
// 核心欄位：identifier、name、type（hosp）、active
const { makeIdentifier, meta, requireFields } = require('./common');

function buildOrganization(input = {}) {
  requireFields(input, ['name']);
  return {
    resourceType: 'Organization',
    meta: meta('Organization'),
    identifier: [makeIdentifier('organization', 'tw-org')],
    active: input.active !== undefined ? Boolean(input.active) : true,
    type: [
      {
        coding: [
          {
            system: 'https://twcore.mohw.gov.tw/ig/twcore/CodeSystem/organization-type',
            code: 'hosp',
            display: 'Hospital'
          }
        ],
        text: '醫院'
      }
    ],
    name: input.name
  };
}

module.exports = buildOrganization;
