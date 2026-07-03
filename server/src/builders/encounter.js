// Encounter（Encounter-twcore）— 門診就醫（AMB）
// 核心欄位：status（in-progress/finished）、class（AMB）、period
// 關鍵 reference：subject → Patient、serviceProvider → Organization、participant → Practitioner
// 已確認：不建立 PractitionerRole，participant 直接引用 Practitioner
const { makeIdentifier, meta, reference } = require('./common');

function buildEncounter(input = {}) {
  const now = new Date().toISOString();
  const resource = {
    resourceType: 'Encounter',
    meta: meta('Encounter'),
    identifier: [makeIdentifier('encounter', 'tw-enc')],
    status: input.status || 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory'
    },
    subject: reference('Patient', input.patientId),
    period: {
      start: input.periodStart || now,
      ...(input.periodEnd ? { end: input.periodEnd } : {})
    }
  };

  if (input.practitionerId) {
    resource.participant = [
      {
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                code: 'ATND',
                display: 'attender'
              }
            ]
          }
        ],
        individual: reference('Practitioner', input.practitionerId)
      }
    ];
  }
  if (input.organizationId) {
    resource.serviceProvider = reference('Organization', input.organizationId);
  }
  return resource;
}

module.exports = buildEncounter;
