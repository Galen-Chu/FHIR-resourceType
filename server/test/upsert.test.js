jest.mock('../src/fhirClient');

const express = require('express');
const request = require('supertest');
const fhirClient = require('../src/fhirClient');
const createRoute = require('../src/routes/createRoute');
const buildOrganization = require('../src/builders/organization');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/organizations', createRoute('Organization', buildOrganization));
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  fhirClient.resolveEnv.mockImplementation((env) => env || 'twcore');
});

describe('PUT /api/organizations（Upsert）', () => {
  test('未帶 externalId 回 400，不會呼叫 FHIR Server', async () => {
    const app = makeApp();
    const res = await request(app).put('/api/organizations').send({ name: '仁愛醫院' });

    expect(res.status).toBe(400);
    expect(res.body.outcome.issue[0].code).toBe('required');
    expect(fhirClient.upsert).not.toHaveBeenCalled();
  });

  test('HAPI 回 201 時 outcome 為 created', async () => {
    fhirClient.upsert.mockResolvedValue({ status: 201, data: { id: 'org-1' } });
    const app = makeApp();

    const res = await request(app)
      .put('/api/organizations')
      .send({ name: '仁愛醫院', externalId: 'HOSP-A' });

    expect(res.status).toBe(201);
    expect(res.body.outcome).toBe('created');
    expect(fhirClient.upsert).toHaveBeenCalledWith(
      'Organization',
      expect.objectContaining({
        identifier: [expect.objectContaining({ value: 'HOSP-A' })]
      }),
      expect.objectContaining({ value: 'HOSP-A' }),
      'twcore'
    );
  });

  test('HAPI 回 200 時 outcome 為 updated（identifier 已存在）', async () => {
    fhirClient.upsert.mockResolvedValue({ status: 200, data: { id: 'org-1' } });
    const app = makeApp();

    const res = await request(app)
      .put('/api/organizations')
      .send({ name: '仁愛醫院（已更名）', externalId: 'HOSP-A' });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('updated');
  });

  test('FHIR Server 回一般 4xx/5xx（非 412）時原樣附上 OperationOutcome', async () => {
    // 412（多筆匹配）自 v4 第 3 項起會被轉譯為 409，見 test/dedupe.test.js；
    // 這裡測試其他狀態碼仍維持原樣透傳
    fhirClient.upsert.mockResolvedValue({
      status: 422,
      data: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid' }] }
    });
    const app = makeApp();

    const res = await request(app)
      .put('/api/organizations')
      .send({ name: '仁愛醫院', externalId: 'HOSP-BAD' });

    expect(res.status).toBe(422);
    expect(res.body.outcome.resourceType).toBe('OperationOutcome');
  });

  test('同一個 externalId 併發 2 個請求，依序呼叫 fhirClient.upsert（Race Condition 防禦）', async () => {
    const callOrder = [];
    fhirClient.upsert.mockImplementation(async (resourceType, resource) => {
      const label = resource.identifier[0].value;
      callOrder.push(`start:${label}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
      callOrder.push(`end:${label}`);
      return { status: 200, data: { id: 'org-1' } };
    });
    const app = makeApp();

    await Promise.all([
      request(app).put('/api/organizations').send({ name: 'A', externalId: 'SAME-ID' }),
      request(app).put('/api/organizations').send({ name: 'B', externalId: 'SAME-ID' })
    ]);

    expect(callOrder).toEqual(['start:SAME-ID', 'end:SAME-ID', 'start:SAME-ID', 'end:SAME-ID']);
  });

  test('不同 externalId 的併發請求不互相阻塞', async () => {
    const callOrder = [];
    fhirClient.upsert.mockImplementation(async (resourceType, resource) => {
      const label = resource.identifier[0].value;
      const ms = label === 'SLOW' ? 30 : 5;
      callOrder.push(`start:${label}`);
      await new Promise((resolve) => setTimeout(resolve, ms));
      callOrder.push(`end:${label}`);
      return { status: 201, data: { id: label } };
    });
    const app = makeApp();

    await Promise.all([
      request(app).put('/api/organizations').send({ name: 'A', externalId: 'SLOW' }),
      request(app).put('/api/organizations').send({ name: 'B', externalId: 'FAST' })
    ]);

    // FAST（5ms）應該比 SLOW（30ms）先結束，代表兩者平行、沒有排隊等待
    expect(callOrder).toEqual(['start:SLOW', 'start:FAST', 'end:FAST', 'end:SLOW']);
  });
});

describe('POST /api/organizations（既有建立行為不受影響）', () => {
  test('未帶 externalId 時每次都是新資源（隨機 identifier）', async () => {
    fhirClient.post.mockResolvedValue({ status: 201, data: { id: 'org-x' } });
    const app = makeApp();

    const res1 = await request(app).post('/api/organizations').send({ name: '仁愛醫院' });
    const res2 = await request(app).post('/api/organizations').send({ name: '仁愛醫院' });

    const call1 = fhirClient.post.mock.calls[0][1];
    const call2 = fhirClient.post.mock.calls[1][1];
    expect(call1.identifier[0].value).not.toBe(call2.identifier[0].value);
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(fhirClient.upsert).not.toHaveBeenCalled();
  });
});
