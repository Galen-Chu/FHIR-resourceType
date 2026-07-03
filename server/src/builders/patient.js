// Patient（Patient-twcore）
// 核心欄位：identifier、name、gender、birthDate、address / telecom
// 關鍵 reference：managingOrganization → Organization
const { makeIdentifier, meta, reference } = require('./common');

function buildPatient(input = {}) {
  const family = input.family || '陳';
  const given = input.given || '小明';
  const resource = {
    resourceType: 'Patient',
    meta: meta('Patient'),
    identifier: [makeIdentifier('patient', 'tw-pat')],
    active: true,
    name: [
      {
        text: `${family}${given}`,
        family,
        given: [given]
      }
    ],
    gender: input.gender || 'male',
    birthDate: input.birthDate || '1990-01-01'
  };

  if (input.phone) {
    resource.telecom = [{ system: 'phone', value: input.phone, use: 'mobile' }];
  }
  if (input.address) {
    resource.address = [{ text: input.address, country: 'TW' }];
  }
  if (input.organizationId) {
    resource.managingOrganization = reference('Organization', input.organizationId);
  }
  return resource;
}

module.exports = buildPatient;
