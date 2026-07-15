// Condition（Condition-twcore）— 診斷
// 核心欄位：code（ICD-10）、clinicalStatus、onsetDateTime
// 關鍵 reference：subject → Patient、encounter → Encounter
const { makeIdentifier, meta, reference, requireFields } = require('./common');

function buildCondition(input = {}) {
  requireFields(input, ['patientId', 'encounterId', 'icd10Code']);
  return {
    resourceType: 'Condition',
    meta: meta('Condition'),
    identifier: [makeIdentifier('condition', 'tw-cond')],
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: input.clinicalStatus || 'active'
        }
      ]
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: 'encounter-diagnosis',
            display: 'Encounter Diagnosis'
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: 'http://hl7.org/fhir/sid/icd-10-cm',
          code: input.icd10Code,
          ...(input.icd10Display ? { display: input.icd10Display } : {})
        }
      ],
      text: input.codeText || input.icd10Display || input.icd10Code
    },
    subject: reference('Patient', input.patientId),
    encounter: reference('Encounter', input.encounterId),
    onsetDateTime: input.onsetDateTime || new Date().toISOString()
  };
}

module.exports = buildCondition;
