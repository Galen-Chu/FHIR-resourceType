#!/usr/bin/env node
// 驗證證據產出工具（講評建議 1）
//
// 1. 以 builder 產出七種 ResourceType 的 TW Core JSON → docs/validation/resources/
// 2. 對指定環境呼叫 HAPI 的 $validate 操作，將 OperationOutcome 驗證報告
//    存到 docs/validation/reports/{env}/，並在終端輸出彙總表
//
// 用法：
//   node scripts/validate-all.js                 # 只產 JSON，不打 $validate
//   node scripts/validate-all.js --env twcore    # 產 JSON + 對 twcore 驗證
//   node scripts/validate-all.js --env all       # 產 JSON + 對兩個環境都驗證
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const fhirClient = require('../src/fhirClient');

const builders = {
  organization: require('../src/builders/organization'),
  practitioner: require('../src/builders/practitioner'),
  patient: require('../src/builders/patient'),
  encounter: require('../src/builders/encounter'),
  condition: require('../src/builders/condition'),
  observation: require('../src/builders/observation'),
  medicationRequest: require('../src/builders/medicationRequest')
};

// 範例輸入：reference 用 placeholder id（$validate 預設不解析 reference 存在性）
const SAMPLE_INPUTS = {
  organization: { name: '仁愛醫院' },
  practitioner: { family: '王', given: '大明', gender: 'male' },
  patient: {
    family: '陳',
    given: '小明',
    gender: 'male',
    birthDate: '1990-01-01',
    phone: '0912345678',
    address: '臺北市大安區仁愛路一段 1 號',
    organizationId: 'example-organization-id'
  },
  encounter: {
    patientId: 'example-patient-id',
    organizationId: 'example-organization-id',
    practitionerId: 'example-practitioner-id',
    status: 'finished',
    periodStart: '2026-07-01T09:00:00+08:00',
    periodEnd: '2026-07-01T09:30:00+08:00'
  },
  condition: {
    patientId: 'example-patient-id',
    encounterId: 'example-encounter-id',
    icd10Code: 'J06.9',
    icd10Display: 'Acute upper respiratory infection, unspecified',
    codeText: '急性上呼吸道感染',
    onsetDateTime: '2026-07-01T09:10:00+08:00'
  },
  observation: {
    patientId: 'example-patient-id',
    encounterId: 'example-encounter-id',
    loincCode: '8867-4',
    loincDisplay: 'Heart rate',
    codeText: '心率',
    value: 72,
    unit: 'beats/minute',
    unitCode: '/min',
    effectiveDateTime: '2026-07-01T09:15:00+08:00'
  },
  medicationRequest: {
    patientId: 'example-patient-id',
    encounterId: 'example-encounter-id',
    practitionerId: 'example-practitioner-id',
    medicationCode: 'ACET500',
    medicationDisplay: 'Acetaminophen 500mg tablet',
    medicationText: '普拿疼 500mg 錠劑',
    dosageText: '每日三次，每次一錠，飯後服用',
    authoredOn: '2026-07-01T09:20:00+08:00'
  }
};

const DOCS_DIR = path.join(__dirname, '..', '..', 'docs', 'validation');

function summarizeOutcome(outcome) {
  const counts = { error: 0, warning: 0, information: 0 };
  for (const issue of outcome.issue || []) {
    if (counts[issue.severity] !== undefined) counts[issue.severity] += 1;
  }
  return counts;
}

async function main() {
  const args = process.argv.slice(2);
  const envArgIdx = args.indexOf('--env');
  const envArg = envArgIdx >= 0 ? args[envArgIdx + 1] : null;
  const envs =
    envArg === 'all'
      ? Object.keys(config.FHIR_SERVERS)
      : envArg
        ? [envArg]
        : [];

  for (const env of envs) {
    if (!config.FHIR_SERVERS[env]) {
      console.error(`未知環境：${env}（可用：${Object.keys(config.FHIR_SERVERS).join(', ')}、all）`);
      process.exit(1);
    }
  }

  // 1. 產出七種資源 JSON
  const resourcesDir = path.join(DOCS_DIR, 'resources');
  fs.mkdirSync(resourcesDir, { recursive: true });
  const resources = {};
  for (const [name, builder] of Object.entries(builders)) {
    const resource = builder(SAMPLE_INPUTS[name], config.DEFAULT_IG);
    resources[name] = resource;
    const file = path.join(resourcesDir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(resource, null, 2) + '\n');
    console.log(`✔ 產出 ${path.relative(process.cwd(), file)}（${resource.resourceType}）`);
  }

  if (!envs.length) {
    console.log('\n未指定 --env，僅產出 JSON。加上 --env twcore|hapi-org|all 可執行 $validate。');
    return;
  }

  // 2. 對各環境執行 $validate
  let hasError = false;
  for (const env of envs) {
    const reportDir = path.join(DOCS_DIR, 'reports', env);
    fs.mkdirSync(reportDir, { recursive: true });
    console.log(`\n=== $validate @ ${env}（${config.FHIR_SERVERS[env].url}）===`);

    for (const [name, resource] of Object.entries(resources)) {
      try {
        const r = await fhirClient.post(`/${resource.resourceType}/$validate`, resource, env);
        const outcome = r.data;
        fs.writeFileSync(
          path.join(reportDir, `${name}.json`),
          JSON.stringify(outcome, null, 2) + '\n'
        );
        const c = summarizeOutcome(outcome);
        const mark = c.error > 0 ? '✖' : '✔';
        if (c.error > 0) hasError = true;
        console.log(
          `${mark} ${resource.resourceType.padEnd(18)} HTTP ${r.status}  ` +
            `error=${c.error} warning=${c.warning} info=${c.information}`
        );
      } catch (err) {
        hasError = true;
        console.log(`✖ ${resource.resourceType.padEnd(18)} 呼叫失敗：${err.message}`);
      }
    }
  }

  console.log(
    hasError
      ? '\n有資源未通過驗證，請檢視 docs/validation/reports/ 內的 OperationOutcome。'
      : '\n全部資源驗證完成，報告已存 docs/validation/reports/。'
  );
}

main();
