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

describe('PUT /api/organizations — 去重防禦（412 → 409）', () => {
  test('HAPI 回 412（identifier 對應多筆既有資源）時轉譯為 409 + 明確訊息', async () => {
    fhirClient.upsert.mockResolvedValue({
      status: 412,
      data: {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'multiple-matches' }]
      }
    });
    const app = makeApp();

    const res = await request(app)
      .put('/api/organizations')
      .send({ name: '仁愛醫院', externalId: 'HOSP-DUP' });

    expect(res.status).toBe(409);
    expect(res.body.outcome.resourceType).toBe('OperationOutcome');
    expect(res.body.outcome.issue[0].code).toBe('duplicate');
    expect(res.body.outcome.issue[0].details.text).toContain('HOSP-DUP');
    expect(res.body.outcome.issue[0].details.text).toContain('多筆既有資源');
  });

  test('412 以外的狀態碼不受影響，維持原樣透傳（不會被誤轉譯成 409）', async () => {
    fhirClient.upsert.mockResolvedValue({
      status: 400,
      data: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid' }] }
    });
    const app = makeApp();

    const res = await request(app)
      .put('/api/organizations')
      .send({ name: '仁愛醫院', externalId: 'HOSP-BAD' });

    expect(res.status).toBe(400);
    expect(res.body.outcome.issue[0].code).toBe('invalid');
  });

  test('POST（一般建立）路徑不受 412 轉譯邏輯影響', async () => {
    fhirClient.post.mockResolvedValue({
      status: 412,
      data: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'multiple-matches' }] }
    });
    const app = makeApp();

    const res = await request(app).post('/api/organizations').send({ name: '仁愛醫院' });

    // POST 沒有 errorOverride，412 應原樣透傳，不會變成 409
    expect(res.status).toBe(412);
  });
});
