# v4 技術設計草案 — Node 端寫入強健度擴充

對應 [README 擴充藍圖](../README.md#擴充藍圖v4-已完成v5-設計規劃中) 的六個 v4
項目（**已全部完成**）。開發時依 1→6 順序逐項實作，本文件先把介面、
資料結構與邊界情境定案，避免邊做邊改動到已完成項目的介面。

> 文件內第 5 節原本提到的「v5 系統合流」規劃已變更：異構資料清洗改為
> 在獨立的 `FHIR-bioMedData` repo 開發，不併入本 repo。相關段落保留
> 作為設計構想紀錄，不代表目前的開發計畫，詳見 README 版本演進紀錄。

所有項目維持現有慣例：CommonJS、手刻工具函式（不隨意引入重量套件）、
builder / route 工廠 / fhirClient 單一出口的既有分層不變。

---

## 1. Upsert 覆寫機制 + Race Condition 防禦 ✅ 已完成

> 實作與設計稿一致。唯一補充：`PUT` 端點明確要求 `externalId`（設計稿
> 有提到「conditional update 需要穩定 identifier 才有意義」，但沒明講
> 遇到未帶的情況要怎麼處理）——實作時補上：未帶 `externalId` 直接回
> `400`，避免呼叫端誤用 PUT 卻拿到一個其實每次都在 create 新資源、
> 完全沒有 Upsert 效果的端點。
>
> 已知限制：此開發環境的沙箱網路對外被擋，無法對真正的 HAPI 測試站做
> live round-trip 驗證，僅以 mock `fhirClient` 的 Jest 測試驗證
> Gateway 端邏輯（identifier 組裝、序列化佇列、狀態碼轉譯）。

### 現況問題

`POST /api/{resource}` 目前一律呼叫 FHIR Server 的 `POST /{resourceType}`
建立新資源；`identifier.value` 由 `builders/common.js` 的 `makeIdentifier()`
隨機產生（見 `common.js:24-33`）。這代表**同一個病患重複送出兩次，會在
FHIR Server 裡產生兩筆不同 id 的 Patient**——沒有「已存在則更新」的判斷。

### 設計：用 FHIR 原生 conditional update 實作 Upsert

不在 Gateway 自己刻一套「先查詢、再判斷、再寫入」的邏輯，而是直接使用
FHIR 規格內建的 **conditional update**（`PUT /{resourceType}?identifier={system}|{value}`）：
HAPI Server 收到後會自己用 `identifier` 搜尋，0 筆則新增、1 筆則更新、
多筆則回 `412 Precondition Failed`。這是業界對「Upsert 語意」的標準做法，
比自己刻查詢+判斷更可靠（搜尋與寫入在 Server 端是原子操作）。

**先決條件（重要，影響 builder 介面）**：conditional update 需要一個
**穩定**的 identifier 才有意義，但目前 `makeIdentifier()` 每次呼叫都隨機
產生新值，等於每次都是「新病患」，Upsert 永遠不會命中。因此本項需要
同步調整 builder 輸入介面：

```js
// builders/common.js
function makeIdentifier(resourceKey, prefix, externalId) {
  return {
    system: `urn:test:tw-exchange:${resourceKey}-id`,
    value: externalId || randomValue(prefix)   // 有外部識別碼就用它，否則維持現有隨機行為
  };
}
```

`buildPatient(input)` 等 7 個 builder 改為 `makeIdentifier('patient', 'tw-pat', input.externalId)`。
`externalId` 為選填——前端不填時行為與現在完全一致（相容既有 7 個建立表單）；
填了才會啟用「同一個 externalId 視為同一筆資源」的 Upsert 語意。

> 展示情境建議先聚焦 **Patient / Organization / Practitioner** 三種資源
> （對應病歷號、機構代碼、醫事人員證號這類天然穩定識別碼）；
> Encounter / Condition / Observation / MedicationRequest 這類事件型資源
> 機制一併實作，但 demo 敘事上不必強調（較少「同一筆事件重複送出」的情境）。

### API 設計

新增 `PUT /api/{resource}`（沿用既有 `createRoute.js` 工廠，同一支 router 上加一個 method）：

```js
router.put('/', async (req, res) => {
  const env = fhirClient.resolveEnv(req.get('X-FHIR-Env'));
  const resource = builder(req.body || {});
  const identifierValue = resource.identifier[0].value;

  await withKeyLock(identifierValue, async () => {
    const r = await fhirClient.upsert(resourceType, resource, identifierValue, env);
    // HAPI: 201 = 新增、200 = 更新
    const outcome = r.status === 201 ? 'created' : 'updated';
    res.status(r.status).json({ resourceType, id: r.data.id, status: r.status, outcome, env });
  });
});
```

`fhirClient.js` 新增：

```js
async function upsert(resourceType, resource, identifierValue, env) {
  const e = resolveEnv(env);
  const path = `/${resourceType}?identifier=${encodeURIComponent(identifierValue)}`;
  logger.request('PUT', path, resource, e);
  const started = Date.now();
  const r = await clientFor(e).put(path, resource);
  logger.response(r.status, r.statusText, describeResult(r), Date.now() - started, e);
  return r;
}
```

### Race Condition 防禦：per-identifier 序列化佇列

即使 HAPI 端的搜尋+寫入是原子操作，Gateway 自己仍可能在極短時間內對
**同一個 identifier** 送出兩個並發 PUT（例如前端使用者連點兩次）。用一個
不需額外套件的 in-memory keyed mutex 把同 key 的請求排隊處理：

```js
// server/src/utils/keyedQueue.js
const queues = new Map();

function withKeyLock(key, fn) {
  const prev = queues.get(key) || Promise.resolve();
  const next = prev.then(fn, fn).finally(() => {
    if (queues.get(key) === next) queues.delete(key); // 清理，避免 Map 無限增長
  });
  queues.set(key, next);
  return next;
}

module.exports = { withKeyLock };
```

不同 identifier 之間完全平行、互不阻塞；同一個 identifier 的請求嚴格排隊，
確保「先查後寫」的視窗內不會被同一 key 的另一個請求插入。

### 邊界情境

| 情境 | 行為 |
| --- | --- |
| 首次寫入（無同 identifier 資源） | HAPI 回 201，`outcome: 'created'` |
| identifier 已存在 1 筆 | HAPI 回 200，`outcome: 'updated'` |
| identifier 對應多筆（資料異常） | HAPI 回 412 → Gateway 轉譯為 `409` + `OperationOutcome`（見第 3 項鑑權與去重防禦） |
| 同 identifier 併發 2 個請求 | 序列化佇列排隊，不會產生 race |
| 未帶 externalId | 行為等同現有隨機 identifier，走既有 `POST` 建立路徑不受影響 |

### 測試（Jest，本項起導入）

```
server/test/upsert.test.js
├─ 首次 PUT → created
├─ 相同 identifier 再 PUT 一次 → updated
├─ withKeyLock 併發 2 支 PUT 同 key → 依序執行（用 mock fhirClient 驗證呼叫順序）
└─ 不同 key 的 PUT 不互相阻塞（計時驗證平行）
```

---

## 2. IG Profile 切換矩陣 ✅ 已完成

> 實作與設計稿一致，另加了 `GET /api/config/fhir-igs` 與前端 IG 選擇器
> UI（設計稿原本只提到「前端側邊欄加一個 IG 選擇器」，實作時一併完成
> 對應的後端清單端點，比照既有 `/api/config/fhir-servers` 的模式）。

### 現況問題

`config.js` 的 `PROFILES` 是寫死的一組 TW Core Profile URL，`builders/common.js`
的 `meta(resourceType)` 直接讀這組固定值。目前「環境切換」只換了
FHIR Server 主機（`twcore` / `hapi-org`），資源內容（`meta.profile`）不會變——
README 已知限制裡也明講「兩站的 `$validate` 結果差異即為觀察點」，但這代表
還沒有真正「切換不同 Core IG」的能力。

### 設計：IG_PROFILES 矩陣 + 獨立於環境的切換 header

```js
// config.js
IG_PROFILES: {
  'tw-core': {
    label: 'TW Core IG',
    profiles: {
      Organization: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Organization-hosp-twcore',
      Patient: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Patient-twcore',
      // ...既有 7 種資源
    }
  },
  'r4-base': {
    label: 'FHIR R4 Base（無自訂 Profile）',
    profiles: {}   // meta.profile 留空，符合 hapi.fhir.org 未載入 TW Core 驗證規則的現況
  }
},
DEFAULT_IG: process.env.FHIR_IG || 'tw-core',
```

`builders/common.js` 的 `meta()` 改為接受 IG key：

```js
function meta(resourceType, ig) {
  const profile = config.IG_PROFILES[ig]?.profiles[resourceType];
  return profile ? { profile: [profile] } : undefined; // r4-base 時不掛 meta
}
```

7 個 builder 的函式簽名從 `buildPatient(input)` 改為 `buildPatient(input, ig)`，
內部呼叫改為 `meta('Patient', ig)`。呼叫端（`createRoute.js`）解析新的
`X-FHIR-IG` header（與既有 `X-FHIR-Env` 平行的模式）：

```js
function resolveIG(header) {
  return config.IG_PROFILES[header] ? header : config.DEFAULT_IG;
}
// router.post('/', ...): const ig = resolveIG(req.get('X-FHIR-IG'));
//                        const resource = builder(req.body || {}, ig);
```

### 與既有雙環境切換的關係

`X-FHIR-Env`（寫入哪個 Server）與 `X-FHIR-IG`（用哪組 Profile 組裝資源）
是兩個獨立維度，可以交叉組合：

| env | ig | 意義 |
| --- | --- | --- |
| twcore | tw-core | 現況（預設） |
| hapi-org | r4-base | 純國際 R4 沙盒，不掛任何自訂 Profile |
| hapi-org | tw-core | 故意拿 TW Core 資源打國際站，觀察 `$validate` 差異（規格書原本就想做的互通性測試） |
| twcore | r4-base | 觀察 TW Core 測試站對「不掛 Profile 的陽春資源」的驗證反應 |

前端側邊欄在既有環境選擇器旁加一個 IG 選擇器，`store.js` 沿用「依環境隔離
已建立資源登錄簿」的同一套模式（IG 不需要隔離登錄簿，只影響組裝內容）。

### 測試

```
server/test/igMatrix.test.js
├─ ig=tw-core → meta.profile 為對應 TW Core URL
├─ ig=r4-base → 無 meta 欄位
└─ 未帶 X-FHIR-IG header → 使用 DEFAULT_IG
```

---

## 3. 鑑權與去重防禦 ✅ 已完成

> 實作與設計稿一致，三個子設計（Gateway 鑑權 / 上游鑑權診斷 / 412→409
> 去重轉譯）皆已完成。小訂正：下方「現況」(b) 點的描述不夠精確——
> 4xx/5xx 原本就會照 FHIR Server 實際回傳的 status code 透傳（只有
> 網路例外才會轉成 502），只是缺少一行明確診斷 log；已在 `fhirClient.js`
> 補上，不影響既有的回應格式。

### 現況

`fhirClient.js` 已有 `FHIR_AUTH_TOKEN` 擴充點（interceptor 自動帶 Bearer
Token），但（a）Express Gateway 本身的 `/api/*` 端點完全開放、無任何鑑權；
（b）4xx/5xx 一律回傳 502，401/403 與其他錯誤無法區分；（c）沒有處理
「外部資料重複」的情境。

### 設計 A：Gateway 端 API Key 鑑權（新增，屬於「網關系統」本身的鑑權）

```js
// server/src/middleware/gatewayAuth.js
const config = require('../config');

module.exports = function gatewayAuth(req, res, next) {
  if (!config.GATEWAY_API_KEY) return next(); // 未設定則不啟用，維持現有免鑑權行為
  const key = req.get('X-Gateway-Key');
  if (key !== config.GATEWAY_API_KEY) {
    return res.status(401).json({
      status: 401,
      error: '缺少或錯誤的 X-Gateway-Key'
    });
  }
  next();
};
```

`index.js` 在 `app.use('/api', ...)` 之前掛上（僅保護 `/api`，`/cds-services`
維持現況，因為 CDS Hooks 規格上是給臨床系統即時呼叫，鑑權機制不同不在本次範圍）。
預設不設定 `GATEWAY_API_KEY` 時完全不影響現有行為，屬於選用強化。

### 設計 B：上游 FHIR Server 鑑權失敗的明確診斷（呼應「URL 鑑權排查」戰績）

`fhirClient.js` 的 `post`/`get`/`upsert` 統一在回應後加一層判斷：

```js
if (r.status === 401 || r.status === 403) {
  logger.error(`FHIR Server 鑑權失敗 [${e}]`, {
    hint: config.FHIR_AUTH_TOKEN ? '檢查 Token 是否過期或 scope 不足' : '未設定 FHIR_AUTH_TOKEN，該環境是否需要鑑權？'
  });
}
```

不改變回應格式（仍照現有邏輯把 4xx/5xx 原樣附 `OperationOutcome` 給前端），
差異只在 log 多一行明確診斷，讓「排查鑑權問題」有結構化線索可查——
這是對應自傳「近期我成功解決外部廠商數據冗餘與 URL 鑑權排查」最直接的佐證。

### 設計 C：去重防禦（銜接第 1 項的 412）

```js
// fhirClient.upsert() 內
if (r.status === 412) {
  logger.error(`Upsert 偵測到重複資料 [${e}]`, { identifier: identifierValue });
}
```

`createRoute.js` 的 `PUT` handler 把 412 轉譯為更明確的 409：

```js
if (r.status === 412) {
  return res.status(409).json({
    resourceType, status: 409, env,
    outcome: {
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error', code: 'duplicate',
        details: { text: `identifier=${identifierValue} 對應多筆既有資源，可能為外部資料重複，需人工複核` }
      }]
    }
  });
}
```

### 測試

```
server/test/gatewayAuth.test.js   — 有/無 X-Gateway-Key 的 401 行為
server/test/dedupe.test.js        — mock fhirClient 回 412 → route 回 409 + 明確訊息
```

---

## 4. ISO 8601 時間格式校準層 ✅ 已完成

> 實作與設計稿唯一的差異：`toIsoDate`/`toIsoDateTime` 改用手動曆法檢查
> （年/月/日拆解 + 月份天數表），而非設計稿原本設想的
> `Number.isNaN(new Date(v).getTime())`——後者對 `2024-02-30` 這類不存在
> 的日期會被 `Date` 靜默捲動成 `2024-03-01`、不會回傳 `NaN`，測試階段才
> 發現這個落差，已在 `server/test/dateUtils.test.js` 加對應迴歸測試。

### 現況

`builders/patient.js` 的 `birthDate`、`encounter.js` 的 `period.start/end`
等日期欄位皆直接透傳前端送來的字串，沒有格式驗證。

### 設計

```js
// server/src/builders/dateUtils.js
const { ValidationError } = require('./common'); // 沿用既有錯誤類別與 400 回應路徑

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

function toIsoDate(value, fieldName) {
  const v = String(value || '').trim().replace(/\//g, '-');
  if (!DATE_RE.test(v) || Number.isNaN(new Date(v).getTime())) {
    throw new ValidationError([`${fieldName}（需為 YYYY-MM-DD，實際：${value}）`]);
  }
  return v;
}

function toIsoDateTime(value, fieldName) {
  const v = String(value || '').trim();
  if (!DATETIME_RE.test(v) || Number.isNaN(new Date(v).getTime())) {
    throw new ValidationError([`${fieldName}（需為 ISO 8601 日期時間，實際：${value}）`]);
  }
  return v;
}

module.exports = { toIsoDate, toIsoDateTime };
```

套用範圍（僅結構化輸入的格式校驗，不含民國年等異質格式轉換——那屬於
異構資料清洗範疇，於獨立的 `FHIR-bioMedData` repo 處理）：

| Builder | 欄位 | 函式 |
| --- | --- | --- |
| `patient.js` | `birthDate` | `toIsoDate` |
| `encounter.js` | `period.start` / `period.end` | `toIsoDateTime` |
| `condition.js` | `onsetDateTime` | `toIsoDateTime` |

沿用現有 `ValidationError` → route 層自動轉 `400` + `OperationOutcome`
的既有錯誤處理路徑，不需要新的錯誤格式。

### 測試

```
server/test/dateUtils.test.js
├─ 合法 YYYY-MM-DD / YYYY/MM/DD（自動轉換分隔符） → 通過
├─ 不合法格式（79/01/02 民國年、日期不存在如 2024-02-30） → 拋 ValidationError
└─ 合法 ISO 8601 datetime（含時區） → 通過
```

---

## 5. CLI + Streamlit 即時監控台 ✅ 已完成

> 實作與設計稿大致一致，一項計畫外的補充：CDS Hooks 觸發次數原本設計
> 「若 log 有 CDS 呼叫記錄」才統計，但 `cds/index.js` 原本只有失敗時
> 才呼叫 `logger.error`，成功呼叫完全沒留下痕跡，統計出來會永遠是 0、
> 是個空承諾的假數據。已補上兩行 `logger.info` 標記，讓這個統計真的有
> 意義；用實際觸發一次 CDS Hook 呼叫驗證過統計會正確更新。

### 定位

獨立唯讀輔助工具，只讀 `server/logs/exchange.log`，**不呼叫任何 API、
不參與主資料流**——維持核心系統 Node.js/Vue 技術棧的單一性。也是這個
repo 第一個引入 Pytest 的地方，呼應自傳原文用字。

### 檔案結構

```
monitor/
├─ requirements.txt      # streamlit, pandas
├─ parser.py             # log 行解析（純函式，可獨立測試）
├─ dashboard.py          # Streamlit 進入點
└─ tests/
   └─ test_parser.py     # Pytest
```

### parser.py（可測試的核心邏輯）

```python
import re
from dataclasses import dataclass
from typing import Optional

REQUEST_RE = re.compile(
    r"\[(?P<ts>[^\]]+)\]\s*\[(?P<env>[^\]]+)\]\s*→\s*(?P<method>\w+)\s+(?P<path>\S+)"
)
RESPONSE_RE = re.compile(
    r"\[(?P<ts>[^\]]+)\]\s*\[(?P<env>[^\]]+)\]\s*←\s*(?P<status>\d+)\s+\S+\s+(?P<detail>.*?)\s+\((?P<ms>\d+)ms\)"
)

@dataclass
class LogEvent:
    ts: str
    env: str
    kind: str          # 'request' | 'response'
    method: Optional[str] = None
    path: Optional[str] = None
    status: Optional[int] = None
    detail: Optional[str] = None
    ms: Optional[int] = None

def parse_line(line: str) -> Optional[LogEvent]:
    if m := REQUEST_RE.match(line):
        return LogEvent(ts=m['ts'], env=m['env'], kind='request', method=m['method'], path=m['path'])
    if m := RESPONSE_RE.match(line):
        return LogEvent(ts=m['ts'], env=m['env'], kind='response',
                         status=int(m['status']), detail=m['detail'], ms=int(m['ms']))
    return None
```

### dashboard.py（示意，實作時再細化）

- 用 `st.file_uploader` 或直接讀 `LOG_FILE` 環境變數指定路徑（跟 Express
  的 `LOG_FILE` 環境變數同名，一個 `.env` 設定兩邊共用）
- 每 N 秒重新讀取新增行（簡單 `st.rerun()` + `time.sleep` 輪詢即可，不需要
  額外的 websocket 套件）
- 畫面：
  - 即時 log 串流表格（最新在上）
  - 依環境（twcore / hapi-org）分組的建立數長條圖
  - 成功（2xx）/ 失敗（4xx/5xx）比例圓餅圖
  - 平均回應時間（ms）折線圖
  - CDS Hooks 觸發次數（若 log 有 CDS 呼叫記錄）

### 測試

```
monitor/tests/test_parser.py
├─ 合法 request 行 → 正確解析 method/path/env
├─ 合法 response 行 → 正確解析 status/ms/detail
└─ 不符格式的行 → 回傳 None（容錯，不中斷 tail）
```

---

## 6. CI/CD 與版本釋出控制 ✅ 已完成

> 實作與設計稿一致，`working-directory` 改用 `defaults.run` 設定（等效，
> 寫法更簡潔）。版本號決策：v4 六項全部向下相容、未變更既有 API 行為，
> 依語意化版本規則判斷為 MINOR（`1.0.0` → `1.1.0`），不是設計稿列的兩個
> 選項之一的 `1.6.0`（那個編號規則沒有語意化版本上的意義）或 `2.0.0`
> （沒有 breaking change，用 MAJOR 不合理）。三個 CI job 的指令都已用
> `npm ci`（而非 `npm install`，更貼近 CI 實際行為）在本機跑過一次
> 確認會成功；`act`（本地跑 GitHub Actions 的工具）在此開發環境未安裝，
> 無法對 YAML 本身做端到端驗證，僅驗證了各 job 實際執行的指令。

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  server:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: server
      - run: npm test
        working-directory: server

  client:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: client
      - run: npm run build
        working-directory: client

  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt pytest
        working-directory: monitor
      - run: pytest
        working-directory: monitor
```

`npm run validate`（打真實 twcore/hapi.fhir.org）需要外部網路且非冪等（會
真的寫入測試站），**不**放進 CI 阻塞流程，維持手動執行、證據存進
`docs/validation/` 的現有作法。

### 版本釋出控制

- `server/package.json`、`client/package.json` 的 `version` 欄位隨每個
  v4 子項完成同步遞增（例如 `1.0.0` → `1.1.0` … 六項全部完成後打 `1.6.0`
  或直接 `2.0.0`，視語意化版本規則決定是否算 breaking change）
- 新增根目錄 `CHANGELOG.md`（Keep a Changelog 格式），把現有 v1-v3 與
  規劃中的 v4-v5 都補上條目，與 README 版本演進紀錄互相對照但各自服務
  不同讀者（README 講「為什麼」、CHANGELOG 講「哪個版本改了什麼」）
- 每個 v4 子項完成、合併進 main 後，於 GitHub 開一個對應的 Release 並打
  tag（如 `v1.1.0`），Release Notes 直接引用該項在 README 擴充藍圖裡的說明

---

## 實作順序與相依關係

```
4. ISO 8601 校準層 ──┐
                      ├─→ 1. Upsert 機制（builder 輸出的日期需先校準過再寫入）
2. IG Profile 矩陣 ───┘
3. 鑑權與去重防禦 ← 依賴 1.（412 → 409 轉譯需要 upsert 端點先存在）
5. Streamlit 監控台 — 獨立，無相依，可隨時插入開發
6. CI/CD — 建議最後做（每個項目都有自己的測試後，CI 才有東西可跑）
```

實務建議開發順序：**4 → 2 → 1 → 3 → 5 → 6**
（先把 builder 層兩個獨立小改動做完，再做互相依賴的 Upsert + 鑑權去重，
監控台與 CI/CD 隨時可以穿插）。
