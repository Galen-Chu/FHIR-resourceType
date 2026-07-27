const { resolveIG } = require('../src/igResolver');
const { meta } = require('../src/builders/common');
const buildPatient = require('../src/builders/patient');
const buildOrganization = require('../src/builders/organization');
const config = require('../src/config');

describe('resolveIG', () => {
  test('已知 IG key 原樣回傳', () => {
    expect(resolveIG('tw-core')).toBe('tw-core');
    expect(resolveIG('r4-base')).toBe('r4-base');
  });

  test('未知 / 未帶 header 時退回 DEFAULT_IG', () => {
    expect(resolveIG('unknown-ig')).toBe(config.DEFAULT_IG);
    expect(resolveIG(undefined)).toBe(config.DEFAULT_IG);
  });
});

describe('meta()', () => {
  test('tw-core → 掛對應的 TW Core Profile URL', () => {
    expect(meta('Patient', 'tw-core')).toEqual({
      profile: ['https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Patient-twcore']
    });
  });

  test('r4-base → 不掛 meta（陽春 FHIR 資源）', () => {
    expect(meta('Patient', 'r4-base')).toBeUndefined();
  });

  test('未帶 ig 時退回 DEFAULT_IG（tw-core）的行為', () => {
    expect(meta('Organization', undefined)).toEqual({
      profile: [config.IG_PROFILES['tw-core'].profiles.Organization]
    });
  });
});

describe('builder 與 IG 矩陣整合', () => {
  const patientInput = {
    family: '王', given: '小明', gender: 'male',
    birthDate: '1990-01-02', organizationId: 'org-1'
  };

  test('ig=tw-core 組裝出的 Patient 帶 meta.profile', () => {
    const resource = buildPatient(patientInput, 'tw-core');
    expect(resource.meta).toEqual({
      profile: ['https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Patient-twcore']
    });
  });

  test('ig=r4-base 組裝出的 Patient 不帶 meta', () => {
    const resource = buildPatient(patientInput, 'r4-base');
    expect(resource.meta).toBeUndefined();
  });

  test('未帶 ig 時維持既有行為（掛 tw-core Profile，向下相容舊呼叫方式）', () => {
    const resource = buildOrganization({ name: '仁愛醫院' });
    expect(resource.meta).toEqual({
      profile: [config.IG_PROFILES['tw-core'].profiles.Organization]
    });
  });

  test('env（Server）與 ig（Profile）是獨立維度：同一組 input 換 ig 只影響 meta，不影響其他欄位', () => {
    const twCore = buildPatient(patientInput, 'tw-core');
    const r4Base = buildPatient(patientInput, 'r4-base');
    const { meta: _m1, identifier: _i1, ...restTwCore } = twCore;
    const { meta: _m2, identifier: _i2, ...restR4Base } = r4Base;
    expect(restTwCore).toEqual(restR4Base);
  });
});
