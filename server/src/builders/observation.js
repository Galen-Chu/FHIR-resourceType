// Observation（Observation-twcore）— 生命徵象
// 核心欄位：code（LOINC）、status（final）、valueQuantity
// 關鍵 reference：subject → Patient、encounter → Encounter
const { makeIdentifier, meta, reference } = require('./common');

function buildObservation(input = {}) {
  return {
    resourceType: 'Observation',
    meta: meta('Observation'),
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
          code: input.loincCode || '8867-4',
          display: input.loincDisplay || 'Heart rate'
        }
      ],
      text: input.codeText || input.loincDisplay || '心率'
    },
    subject: reference('Patient', input.patientId),
    encounter: reference('Encounter', input.encounterId),
    effectiveDateTime: input.effectiveDateTime || new Date().toISOString(),
    valueQuantity: {
      value: input.value !== undefined ? Number(input.value) : 72,
      unit: input.unit || 'beats/minute',
      system: 'http://unitsofmeasure.org',
      code: input.unitCode || input.unit || '/min'
    }
  };
}

module.exports = buildObservation;
