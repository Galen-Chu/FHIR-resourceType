// 驗證 v4 第 4 項（ISO 8601 校準層）確實被 builder 呼叫、且 ValidationError
// 會被既有的必填欄位驗證機制（400 + OperationOutcome）一致處理
const buildPatient = require('../src/builders/patient');
const buildEncounter = require('../src/builders/encounter');
const buildCondition = require('../src/builders/condition');
const { ValidationError } = require('../src/builders/common');

const basePatientInput = {
  family: '王', given: '小明', gender: 'male',
  birthDate: '1990-01-02', organizationId: 'org-1'
};

const baseEncounterInput = { patientId: 'pat-1', organizationId: 'org-1', practitionerId: 'prac-1' };

const baseConditionInput = { patientId: 'pat-1', encounterId: 'enc-1', icd10Code: 'J00' };

describe('buildPatient — 日期校準', () => {
  test('合法 birthDate 直接組裝成功', () => {
    const resource = buildPatient(basePatientInput);
    expect(resource.birthDate).toBe('1990-01-02');
  });

  test('民國年格式的 birthDate 應被拒絕（400 對應的 ValidationError）', () => {
    expect(() => buildPatient({ ...basePatientInput, birthDate: '79/01/02' }))
      .toThrow(ValidationError);
  });

  test('不存在的日期（2/30）應被拒絕', () => {
    expect(() => buildPatient({ ...basePatientInput, birthDate: '1990-02-30' }))
      .toThrow(ValidationError);
  });
});

describe('buildEncounter — 日期校準', () => {
  test('未帶 periodStart 時使用當下時間（既有行為不變）', () => {
    const resource = buildEncounter(baseEncounterInput);
    expect(resource.period.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('合法 periodStart/periodEnd 通過校準', () => {
    const resource = buildEncounter({
      ...baseEncounterInput,
      periodStart: '2026-07-15T09:00:00Z',
      periodEnd: '2026-07-15T09:30:00Z'
    });
    expect(resource.period.start).toBe('2026-07-15T09:00:00Z');
    expect(resource.period.end).toBe('2026-07-15T09:30:00Z');
  });

  test('格式不合法的 periodStart 應被拒絕', () => {
    expect(() => buildEncounter({ ...baseEncounterInput, periodStart: '2026/07/15' }))
      .toThrow(ValidationError);
  });
});

describe('buildCondition — 日期校準', () => {
  test('未帶 onsetDateTime 時使用當下時間（既有行為不變）', () => {
    const resource = buildCondition(baseConditionInput);
    expect(resource.onsetDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('格式不合法的 onsetDateTime 應被拒絕', () => {
    expect(() => buildCondition({ ...baseConditionInput, onsetDateTime: 'not-a-date' }))
      .toThrow(ValidationError);
  });
});
