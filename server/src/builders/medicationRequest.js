// MedicationRequest（MedicationRequest-twcore）— 用藥醫囑
// 核心欄位：status（active）、medicationCodeableConcept、dosageInstruction
// 關鍵 reference：subject → Patient、encounter → Encounter、requester → Practitioner
const { makeIdentifier, meta, reference } = require('./common');

function buildMedicationRequest(input = {}) {
  return {
    resourceType: 'MedicationRequest',
    meta: meta('MedicationRequest'),
    identifier: [makeIdentifier('medication-request', 'tw-medrq')],
    status: input.status || 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [
        {
          system: 'urn:test:tw-exchange:medication-code',
          code: input.medicationCode || 'ACET500',
          display: input.medicationDisplay || 'Acetaminophen 500mg tablet'
        }
      ],
      text: input.medicationText || input.medicationDisplay || '普拿疼 500mg 錠劑'
    },
    subject: reference('Patient', input.patientId),
    encounter: reference('Encounter', input.encounterId),
    requester: reference('Practitioner', input.practitionerId),
    authoredOn: input.authoredOn || new Date().toISOString(),
    dosageInstruction: [
      {
        text: input.dosageText || '每日三次，每次一錠，飯後服用',
        timing: {
          repeat: {
            frequency: input.frequency !== undefined ? Number(input.frequency) : 3,
            period: 1,
            periodUnit: 'd'
          }
        },
        route: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '26643006',
              display: 'Oral route'
            }
          ],
          text: '口服'
        }
      }
    ]
  };
}

module.exports = buildMedicationRequest;
