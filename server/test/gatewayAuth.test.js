// gatewayAuth 讀取 config.GATEWAY_API_KEY（config.js 在 require 時就讀入
// process.env），用 jest.isolateModules 搭配先設 env var 再 require，
// 讓每個測試案例都能拿到套用不同 GATEWAY_API_KEY 的獨立模組實例
function loadMiddleware(apiKey) {
  let middleware;
  jest.isolateModules(() => {
    if (apiKey) {
      process.env.GATEWAY_API_KEY = apiKey;
    } else {
      delete process.env.GATEWAY_API_KEY;
    }
    middleware = require('../src/middleware/gatewayAuth');
  });
  return middleware;
}

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

afterEach(() => {
  delete process.env.GATEWAY_API_KEY;
});

describe('gatewayAuth', () => {
  test('未設定 GATEWAY_API_KEY 時完全不啟用，直接放行（維持既有免鑑權行為）', () => {
    const gatewayAuth = loadMiddleware(null);
    const next = jest.fn();
    const res = makeRes();

    gatewayAuth({ get: () => undefined }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('設定 GATEWAY_API_KEY 後，缺 X-Gateway-Key header 回 401', () => {
    const gatewayAuth = loadMiddleware('secret-123');
    const next = jest.fn();
    const res = makeRes();

    gatewayAuth({ get: () => undefined }, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('設定 GATEWAY_API_KEY 後，header 值錯誤回 401', () => {
    const gatewayAuth = loadMiddleware('secret-123');
    const next = jest.fn();
    const res = makeRes();

    gatewayAuth({ get: () => 'wrong-key' }, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('設定 GATEWAY_API_KEY 後，header 值正確則放行', () => {
    const gatewayAuth = loadMiddleware('secret-123');
    const next = jest.fn();
    const res = makeRes();

    gatewayAuth({ get: () => 'secret-123' }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
