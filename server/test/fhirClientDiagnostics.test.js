// 驗證 fhirClient 的診斷 log（v4 第 3 項設計 B / C）：
// 401/403 記錄鑑權失敗診斷、412（僅 upsert）記錄去重診斷。
// 每個測試都用 jest.resetModules() + doMock 拿一份全新的 fhirClient 實例，
// 避免 clientFor() 內部的 axios client 快取跨測試互相污染
let fhirClient;
let logger;
let mockHttp;

beforeEach(() => {
  jest.resetModules();

  mockHttp = {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    interceptors: { request: { use: jest.fn() } }
  };

  jest.doMock('axios', () => ({ create: jest.fn(() => mockHttp) }));
  jest.doMock('../src/logger', () => ({
    request: jest.fn(),
    response: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }));

  fhirClient = require('../src/fhirClient');
  logger = require('../src/logger');
});

describe('鑑權失敗診斷（401/403）', () => {
  test('POST 收到 401 時記錄鑑權失敗診斷', async () => {
    mockHttp.post.mockResolvedValue({ status: 401, statusText: 'Unauthorized', data: {} });
    await fhirClient.post('/Patient', { resourceType: 'Patient' }, 'twcore');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('鑑權失敗'), expect.any(Object));
  });

  test('GET 收到 403 時記錄鑑權失敗診斷', async () => {
    mockHttp.get.mockResolvedValue({ status: 403, statusText: 'Forbidden', data: {} });
    await fhirClient.get('/Patient', undefined, 'twcore');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('鑑權失敗'), expect.any(Object));
  });

  test('正常 2xx 回應不會觸發鑑權診斷', async () => {
    mockHttp.post.mockResolvedValue({ status: 201, statusText: 'Created', data: { id: 'x' } });
    await fhirClient.post('/Patient', { resourceType: 'Patient' }, 'twcore');
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('去重診斷（412，僅 upsert）', () => {
  test('upsert 收到 412 時記錄去重診斷，附上完整 identifier', async () => {
    mockHttp.put.mockResolvedValue({ status: 412, statusText: 'Precondition Failed', data: {} });
    await fhirClient.upsert(
      'Organization',
      { resourceType: 'Organization' },
      { system: 'urn:test:tw-exchange:organization-id', value: 'HOSP-A' },
      'twcore'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('重複資料'),
      expect.objectContaining({ identifier: 'urn:test:tw-exchange:organization-id|HOSP-A' })
    );
  });

  test('upsert 成功（201）不會觸發去重診斷', async () => {
    mockHttp.put.mockResolvedValue({ status: 201, statusText: 'Created', data: { id: 'x' } });
    await fhirClient.upsert(
      'Organization',
      { resourceType: 'Organization' },
      { system: 'urn:test', value: 'HOSP-A' },
      'twcore'
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
