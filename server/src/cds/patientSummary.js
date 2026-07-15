// patient-view hook：病患摘要卡片 + 生命徵象超標警示
const SOURCE = { label: 'FHIR Exchange Test System' };

// 生命徵象正常範圍（LOINC code → 範圍）
const VITAL_RANGES = {
  '8867-4': { label: '心率', min: 60, max: 100 },
  '8480-6': { label: '收縮壓', min: 90, max: 140 },
  '8462-4': { label: '舒張壓', min: 60, max: 90 },
  '8310-5': { label: '體溫', min: 36, max: 38 },
  '9279-1': { label: '呼吸速率', min: 12, max: 20 }
};

function entriesOf(bundle) {
  return ((bundle && bundle.entry) || []).map((e) => e.resource).filter(Boolean);
}

function nameOf(patient) {
  const n = (patient.name && patient.name[0]) || {};
  return n.text || `${n.family || ''}${(n.given || []).join('')}` || '(未命名)';
}

async function buildPatientSummaryCards(fhirClient, patientId, env) {
  const [patientRes, conditionRes, observationRes, medicationRes] = await Promise.all([
    fhirClient.get(`/Patient/${encodeURIComponent(patientId)}`, undefined, env),
    fhirClient.get('/Condition', { patient: patientId }, env),
    fhirClient.get('/Observation', { patient: patientId }, env),
    fhirClient.get('/MedicationRequest', { patient: patientId }, env)
  ]);

  if (patientRes.status === 404) {
    return [
      {
        summary: `找不到病患 Patient/${patientId}`,
        indicator: 'warning',
        detail: `目標環境（${env}）上查無此病患，請確認 id 與環境是否一致。`,
        source: SOURCE
      }
    ];
  }

  const patient = patientRes.data;
  const conditions = entriesOf(conditionRes.data);
  const observations = entriesOf(observationRes.data);
  const medications = entriesOf(medicationRes.data);

  const cards = [];

  // 摘要卡片（info）
  const conditionLines = conditions.map(
    (c) => `- ${(c.code && c.code.text) || '未知診斷'}（${(c.clinicalStatus?.coding?.[0]?.code) || '-'}）`
  );
  const medicationLines = medications
    .filter((m) => m.status === 'active')
    .map((m) => `- ${(m.medicationCodeableConcept && m.medicationCodeableConcept.text) || '未知藥品'}`);

  cards.push({
    summary: `${nameOf(patient)}：診斷 ${conditions.length} 筆、生命徵象 ${observations.length} 筆、active 用藥 ${medicationLines.length} 筆`,
    indicator: 'info',
    detail: [
      `**病患**：${nameOf(patient)}（${patient.gender || '-'}，${patient.birthDate || '-'}）`,
      '',
      `**診斷（Condition）**`,
      conditionLines.length ? conditionLines.join('\n') : '- 無',
      '',
      `**active 用藥（MedicationRequest）**`,
      medicationLines.length ? medicationLines.join('\n') : '- 無'
    ].join('\n'),
    source: SOURCE
  });

  // 生命徵象警示卡片（warning）：每個 LOINC code 取最新一筆檢查是否超標
  const latestByCode = {};
  for (const obs of observations) {
    const code = obs.code?.coding?.[0]?.code;
    if (!code || !obs.valueQuantity) continue;
    const t = obs.effectiveDateTime || '';
    if (!latestByCode[code] || t > (latestByCode[code].effectiveDateTime || '')) {
      latestByCode[code] = obs;
    }
  }

  for (const [code, obs] of Object.entries(latestByCode)) {
    const range = VITAL_RANGES[code];
    if (!range) continue;
    const value = obs.valueQuantity.value;
    if (value < range.min || value > range.max) {
      const direction = value > range.max ? '高於' : '低於';
      cards.push({
        summary: `${range.label} ${value} ${obs.valueQuantity.unit || ''} ${direction}正常範圍（${range.min}–${range.max}）`,
        indicator: 'warning',
        detail:
          `最新一筆 ${range.label}（LOINC ${code}）為 **${value} ${obs.valueQuantity.unit || ''}**，` +
          `${direction}正常範圍 ${range.min}–${range.max}。\n\n測量時間：${obs.effectiveDateTime || '-'}（Observation/${obs.id}）`,
        source: SOURCE
      });
    }
  }

  return cards;
}

module.exports = { buildPatientSummaryCards, VITAL_RANGES };
