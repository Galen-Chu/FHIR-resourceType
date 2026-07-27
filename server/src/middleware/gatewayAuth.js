// Gateway 自身的鑑權（v4，呼應「網關系統」本身也需要鑑權，而不是只有
// 轉呼叫上游 FHIR Server 時的鑑權）。未設定 GATEWAY_API_KEY 時完全不啟用，
// 維持既有免鑑權行為；設定後每個 /api 請求需帶對應的 X-Gateway-Key header
const config = require('../config');

module.exports = function gatewayAuth(req, res, next) {
  if (!config.GATEWAY_API_KEY) return next();

  const key = req.get('X-Gateway-Key');
  if (key !== config.GATEWAY_API_KEY) {
    res.status(401).json({
      status: 401,
      error: '缺少或錯誤的 X-Gateway-Key'
    });
    return;
  }
  next();
};
