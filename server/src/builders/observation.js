// Observation（Observation-twcore）— 生命徵象
// 核心欄位：code（LOINC）、status（final）、valueQuantity
// 關鍵 reference：subject → Patient、encounter → Encounter
const { makeIdentifier, meta, reference, requireFields } = require('./common');

function buildObservation(input = {}, ig) {
  requireFields(input, ['patientId', 'encounterId', 'loincCode', 'value']);
  return {
    resourceType: 'Observation',
    meta: meta('Observation', ig),
    identifier: [makeIdentifier('observation', 'tw-obs')],
    status: input.status || 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: input.loincCode,
          ...(input.loincDisplay ? { display: input.loincDisplay } : {})
        }
      ],
      text: input.codeText || input.loincDisplay || input.loincCode
    },
    subject: reference('Patient', input.patientId),
    encounter: reference('Encounter', input.encounterId),
    effectiveDateTime: input.effectiveDateTime || new Date().toISOString(),
    valueQuantity: {
      value: Number(input.value),
      unit: input.unit || '',
      system: 'http://unitsofmeasure.org',
      code: input.unitCode || input.unit || ''
    }
  };
}

module.exports = buildObservation;
