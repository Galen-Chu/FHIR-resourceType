// Patient（Patient-twcore）
// 核心欄位：identifier、name、gender、birthDate、address / telecom
// 關鍵 reference：managingOrganization → Organization
const { makeIdentifier, meta, reference, requireFields } = require('./common');
const { toIsoDate } = require('./dateUtils');

function buildPatient(input = {}) {
  requireFields(input, ['family', 'given', 'gender', 'birthDate', 'organizationId']);
  const { family, given } = input;
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
    gender: input.gender,
    birthDate: toIsoDate(input.birthDate, 'birthDate'),
    managingOrganization: reference('Organization', input.organizationId)
  };

  if (input.phone) {
    resource.telecom = [{ system: 'phone', value: input.phone, use: 'mobile' }];
  }
  if (input.address) {
    resource.address = [{ text: input.address, country: 'TW' }];
  }
  return resource;
}

module.exports = buildPatient;
