// order-select hook：重複用藥檢查
// context.draftOrders（FHIR Bundle）或簡化欄位 context.medicationText / medicationCode
// 與病患現有 active MedicationRequest 比對
const SOURCE = { label: 'FHIR Exchange Test System' };

function entriesOf(bundle) {
  return ((bundle && bundle.entry) || []).map((e) => e.resource).filter(Boolean);
}

function medicationKeyOf(medicationRequest) {
  const concept = medicationRequest.medicationCodeableConcept || {};
  return {
    code: concept.coding?.[0]?.code || null,
    text: concept.text || null
  };
}

// 從 context 取出草稿藥囑（支援標準 draftOrders Bundle 與簡化欄位）
function draftMedicationsOf(context) {
  const drafts = [];
  for (const resource of entriesOf(context.draftOrders)) {
    if (resource.resourceType === 'MedicationRequest') {
      drafts.push(medicationKeyOf(resource));
    }
  }
  if (context.medicationText || context.medicationCode) {
    drafts.push({ code: context.medicationCode || null, text: context.medicationText || null });
  }
  return drafts;
}

async function buildMedicationDuplicateCards(fhirClient, context, env) {
  const drafts = draftMedicationsOf(context);
  if (!drafts.length) {
    return [
      {
        summary: '未提供草稿藥囑，無法執行重複用藥檢查',
        indicator: 'info',
        detail: '請在 context.draftOrders（Bundle）或 context.medicationText 提供欲開立的藥品。',
        source: SOURCE
      }
    ];
  }

  const r = await fhirClient.get(
    '/MedicationRequest',
    { patient: context.patientId, status: 'active' },
    env
  );
  const existing = entriesOf(r.data)
    .filter((m) => m.status === 'active')
    .map((m) => ({ id: m.id, ...medicationKeyOf(m) }));

  const cards = [];
  for (const draft of drafts) {
    const duplicates = existing.filter(
      (m) =>
        (draft.code && m.code && draft.code === m.code) ||
        (draft.text && m.text && draft.text === m.text)
    );
    if (duplicates.length) {
      cards.push({
        summary: `重複用藥警示：「${draft.text || draft.code}」已有 active 醫囑`,
        indicator: 'warning',
        detail:
          `病患已有下列 active MedicationRequest 與本次開立重複：\n` +
          duplicates.map((d) => `- ${d.text || d.code}（MedicationRequest/${d.id}）`).join('\n'),
        source: SOURCE
      });
    }
  }

  if (!cards.length) {
    cards.push({
      summary: `無重複用藥（已比對 ${existing.length} 筆 active 醫囑）`,
      indicator: 'info',
      detail: '本次開立的藥品與病患現有 active MedicationRequest 無重複。',
      source: SOURCE
    });
  }
  return cards;
}

module.exports = { buildMedicationDuplicateCards };
