# FHIR 交換測試系統（FHIR Exchange Test System）

依據《FHIR 交換測試系統 架構設計規格書（DRAFT v1.0）》建置的完整實作專案，
並依講評回饋持續迭代（見文末[版本演進紀錄](#版本演進紀錄)）。
一次性建置七種 ResourceType，符合 **TW Core IG** 規範，可在
**台灣 TW Core 測試站**與 **HAPI 國際公開站**之間自由切換寫入/查詢目標，
並提供 JSON 規格預覽、驗證證據產出工具與 CDS Hooks 臨床決策支援端點。

| 項目 | 內容 |
| --- | --- |
| 前端 | Vue 3 + Vite（vue-router、axios） |
| 後端 | Express（axios、cors、dotenv、morgan） |
| ResourceType | 共 7 種（皆掛 TW Core Profile） |
| FHIR Server | 雙環境可切換：`twcore.hapi.fhir.tw/fhir`（預設）/ `hapi.fhir.org/baseR4`（FHIR R4） |
| 臨床決策支援 | CDS Hooks（patient-view、order-select） |
| 驗證 | JSON 規格預覽、`$validate` 批次驗證工具、結構化 Log 存證 |

## 系統架構

三層式：**Vue 前端 → Express 中介 API → FHIR Server（雙環境）**。
Express 不落地資料庫，僅作為 proxy / 組裝層，所有資源實際存放在遠端 FHIR Server。
同一套 route / builder / log 模式套用在全部七種資源。

```
┌───────────────────────┐   ┌────────────────────────────┐   ┌───────────────────────────┐
│ Frontend (Vue 3)      │   │ Express API                │   │ FHIR Server（X-FHIR-Env）  │
│ ├ 環境選擇器           │ → │ ├ Route 層 × 7             │ → │ [twcore]（預設）           │
│ ├ 建立資源表單 × 7     │   │ │  /api/{resource}         │   │  twcore.hapi.fhir.tw/fhir │
│ │  含 JSON 規格預覽    │   │ │  /api/{resource}/preview │   │  已載入 TW Core 驗證規則   │
│ ├ 建立結果卡片         │   │ ├ Resource Builder × 7     │   │ [hapi-org]                │
│ │  id / status / env  │   │ │  TW Core JSON 組裝        │   │  hapi.fhir.org/baseR4     │
│ ├ 查詢頁面 × 2        │   │ │  必填欄位驗證             │   │  國際公開沙盒              │
│ └ CDS Hooks 卡片頁    │   │ ├ CDS Hooks /cds-services  │   └───────────────────────────┘
│                       │   │ ├ FHIR Client（依環境路由） │
│                       │   │ └ Logger（console + 檔案）  │
└───────────────────────┘   └────────────────────────────┘
```

## 情境

一位病患到醫院**門診就醫**：機構與醫師資料已存在 → 建立病患 →
開立**一次就診（Encounter）** → 醫師記錄**診斷（Condition）**與**生命徵象（Observation）**
→ 開立**用藥醫囑（MedicationRequest）**。七種資源一次建置完成，不分階段。
開立藥囑與檢視病患時，可透過 CDS Hooks 取得重複用藥警示與生命徵象超標提醒。

## 目錄結構

```
├─ server/
│  ├─ src/
│  │  ├─ index.js               # Express 進入點（/api + /cds-services）
│  │  ├─ config.js              # 雙環境 FHIR Server 清單、TW Core Profile URLs
│  │  ├─ fhirClient.js          # axios wrapper：依環境路由、預留 auth header 擴充點
│  │  ├─ logger.js              # 結構化輸出：console + logs/exchange.log 存證
│  │  ├─ builders/              # TW Core JSON 組裝 × 7
│  │  │  ├─ common.js           #   identifier / meta / reference / 必填驗證共用工具
│  │  │  ├─ organization.js … medicationRequest.js
│  │  ├─ routes/                # 7 資源 route + 2 查詢端點
│  │  │  ├─ createRoute.js      #   共用工廠：建立 + preview + 400 OperationOutcome
│  │  │  └─ organizations.js … medicationRequests.js
│  │  └─ cds/                   # CDS Hooks
│  │     ├─ index.js            #   discovery 與服務路由
│  │     ├─ patientSummary.js   #   patient-view：摘要 + 生命徵象警示
│  │     └─ medicationCheck.js  #   order-select：重複用藥檢查
│  ├─ scripts/
│  │  └─ validate-all.js        # 驗證證據產出工具（npm run validate）
│  ├─ logs/exchange.log         # 交換存證 log（執行時自動產生，gitignore）
│  ├─ .env.example
│  └─ package.json
├─ client/
│  ├─ src/
│  │  ├─ views/                 # 7 建立 + 2 查詢 + 1 CDS Hooks 頁面
│  │  │  ├─ CreateOrganization.vue … CreateMedicationRequest.vue
│  │  │  ├─ QueryByOrganization.vue / QueryByPatientId.vue
│  │  │  └─ CdsHooks.vue
│  │  ├─ components/
│  │  │  ├─ ResourceResultCard.vue   # 綠 = 2xx；紅 = 4xx/5xx + OperationOutcome
│  │  │  └─ JsonPreviewPanel.vue     # 產生 / 複製 / 下載 TW Core JSON
│  │  ├─ store.js               # 環境狀態 + 依環境隔離的已建立資源登錄簿
│  │  ├─ api.js / router.js / App.vue / main.js / style.css
│  ├─ .env.example
│  └─ package.json
├─ docs/
│  └─ validation/               # 驗證證據：resources / reports / screenshots / logs
└─ README.md
```

## 快速開始

前後端分別開發、獨立啟動。

### 1. 啟動後端（http://localhost:3000）

```bash
cd server
npm install
cp .env.example .env     # FHIR_URL_TWCORE / FHIR_URL_HAPI_ORG / FHIR_ENV / PORT
npm run dev              # nodemon；log 同步輸出 console 與 logs/exchange.log
```

### 2. 啟動前端（http://localhost:5173）

```bash
cd client
npm install
cp .env.example .env     # VITE_API_BASE=http://localhost:3000/api
npm run dev
```

## 建立順序 · 相依圖

```
1 Organization        — 醫事機構，最先建立
└─ 2 Practitioner     — 醫事人員（獨立建立，不綁定機構）
   └─ 3 Patient       — managingOrganization → Organization
      └─ 4 Encounter  — subject → Patient，serviceProvider → Organization，participant → Practitioner
         ├─ 5 Condition          — subject → Patient，encounter → Encounter
         ├─ 6 Observation        — subject → Patient，encounter → Encounter
         └─ 7 MedicationRequest  — subject → Patient，encounter → Encounter，requester → Practitioner
```

建立 Encounter / Condition / Observation / MedicationRequest 時，request body
需帶入前一步驟取得的 id（patientId、encounterId、practitionerId）；
前端以「已建立資源登錄簿」（localStorage，依環境隔離）自動提供下拉選單。

## API 設計

七種資源共用同一種端點模式：`POST /api/{resource}` 建立、內部轉呼叫 FHIR Server，
回應整理成一致的 `{ id, status, resourceType, env }` 格式。

| 方法 | Express 端點 | 轉呼叫 |
| --- | --- | --- |
| POST | `/api/organizations` | `POST /Organization` |
| POST | `/api/practitioners` | `POST /Practitioner` |
| POST | `/api/patients` | `POST /Patient` |
| POST | `/api/encounters` | `POST /Encounter` |
| POST | `/api/conditions` | `POST /Condition` |
| POST | `/api/observations` | `POST /Observation` |
| POST | `/api/medication-requests` | `POST /MedicationRequest` |
| POST | `/api/{resource}/preview` | —（僅組裝 JSON，不呼叫 FHIR Server） |
| GET | `/api/organizations/:id/patients` | `GET /Patient?organization={id}` |
| GET | `/api/patients/:id` | `GET /Patient/{id}` |
| GET | `/api/config/fhir-servers` | —（環境清單，供前端選擇器） |
| GET | `/api/health` | —（服務狀態與環境設定） |

成功回應範例（回傳給前端）：

```json
{ "resourceType": "Encounter", "id": "tw-enc-5510", "status": 201, "env": "twcore" }
```

錯誤處理：

- **缺必填欄位**：不以預設值靜默補齊，回 `400` 並附 FHIR `OperationOutcome`
  （`issue[0].details.text` 列出缺漏欄位），與聯測實況一致
- **FHIR Server 回 4xx/5xx**：原樣附上 `OperationOutcome`，前端紅色卡片顯示錯誤訊息

### JSON 規格預覽（Validator 手動驗證）

每個建立頁面都提供「**產生 JSON**」按鈕：以與「送出建立」完全相同的表單資料呼叫
`POST /api/{resource}/preview`，回傳後端 builder 組裝後的 TW Core JSON（含
`meta.profile`），**不會寫入 FHIR Server**。畫面上可直接**複製**或**下載 .json**，
貼到 [validator.fhir.org](https://validator.fhir.org/) 或以 HAPI `$validate`
操作手動驗證資料格式是否符合 TW Core IG。

> 注意：identifier.value 由後端隨機亂數產生，因此每次預覽產生的 identifier
> 會與實際送出建立時不同（結構相同）。

## FHIR Server 環境切換

前端側邊欄可切換資源寫入/查詢的目標環境，選擇隨每個請求以 `X-FHIR-Env` header
帶到後端（per-request、無共享狀態）：

| 環境 key | 名稱 | Base URL |
| --- | --- | --- |
| `twcore`（預設） | 台灣 TW Core 測試站 | `https://twcore.hapi.fhir.tw/fhir` |
| `hapi-org` | HAPI 國際公開站（R4） | `https://hapi.fhir.org/baseR4` |

- 「已建立資源登錄簿」依環境隔離：twcore 建立的資源 id 不會出現在 hapi-org 的
  下拉選單，避免跨環境無效 reference
- 交換 Log 每行標記目標環境（`[twcore]` / `[hapi-org]`），建立結果卡片顯示 `env`
- 環境清單與 URL 可用環境變數覆蓋（`FHIR_URL_TWCORE`、`FHIR_URL_HAPI_ORG`、`FHIR_ENV`）
- 資源內容（TW Core profile 宣告）不因環境改變；hapi.fhir.org 未載入 TW Core
  驗證規則，兩站的 `$validate` 結果差異本身即為互通性測試的觀察點

## CDS Hooks

在既有讀取路徑上提供 [CDS Hooks](https://cds-hooks.hl7.org/) 臨床決策支援端點
（依規格掛在伺服器根路徑，非 `/api` 之下）：

| 端點 | Hook | 說明 |
| --- | --- | --- |
| `GET /cds-services` | — | Discovery：列出可用服務 |
| `POST /cds-services/patient-summary` | `patient-view` | 彙整病患的 Condition / Observation / MedicationRequest；生命徵象超出正常範圍（心率 60–100、收縮壓 90–140、舒張壓 60–90、體溫 36–38、呼吸 12–20）時回傳 warning 卡片 |
| `POST /cds-services/medication-duplicate-check` | `order-select` | 比對草稿藥囑（標準 `draftOrders` Bundle 或簡化欄位 `medicationText`）與病患現有 active MedicationRequest，重複時回傳 warning 卡片 |

呼叫範例：

```bash
curl -X POST http://localhost:3000/cds-services/patient-summary \
  -H 'Content-Type: application/json' \
  -H 'X-FHIR-Env: twcore' \
  -d '{ "hook": "patient-view", "hookInstance": "demo-1",
        "context": { "patientId": "<Patient id>" } }'
```

回應為標準 CDS Hooks `{ cards: [...] }` 格式（`summary` / `indicator` / `detail` /
`source`）。前端「CDS Hooks 卡片」頁面可直接選擇病患呼叫兩個服務並渲染
info / warning / critical 卡片。環境依 `X-FHIR-Env` header 決定
（亦支援 request body 的 `fhirServer` 欄位比對）。

## Server 端 Log 規格（交換存證）

每次呼叫 FHIR Server 前後都輸出結構化 log，七種資源與 CDS Hooks 共用同一套格式，
同步寫入 console 與 `server/logs/exchange.log`（`LOG_FILE` 環境變數可改路徑）：

```
[2026-07-15 10:12:04] [twcore]  → POST /Patient  resourceType=Patient identifier=tw-pat-20318841
[2026-07-15 10:12:05] [twcore]  ← 201 Created  Patient/tw-pat-2031  (812ms)
[2026-07-15 10:14:22] [hapi-org]  → GET /Patient
[2026-07-15 10:14:22] [hapi-org]  ← 200 OK  Bundle · total=6  (340ms)
[2026-07-15 10:15:01] [twcore]  → GET /Patient/tw-pat-9999
[2026-07-15 10:15:01] [twcore]  ← 404 Not Found  OperationOutcome: 找不到指定資源  (120ms)
```

- **請求前**：時間、目標環境、方法、路徑、組裝後的 resource 摘要
- **回應後**：HTTP status、resource id 或錯誤訊息、耗時 (ms)
- **實作**：`morgan` 記錄 HTTP 存取層；自訂 `logger.js` 記錄 FHIR 交換細節與檔案存證

## 驗證證據（docs/validation/）

`server` 內建驗證證據產出工具：

```bash
cd server
npm run validate                  # 產出七種資源 JSON → docs/validation/resources/
npm run validate -- --env twcore  # 加打 HAPI $validate，報告存 docs/validation/reports/twcore/
npm run validate -- --env all     # 對兩個環境都驗證
```

完整的證據組成（詳見 [docs/validation/README.md](docs/validation/README.md)）：

1. `resources/` — builder 產出的七種 TW Core JSON（隨 repo 提供）
2. `reports/{env}/` — 各環境 `$validate` 的 OperationOutcome 報告（執行工具後產生）
3. `screenshots/` — validator.fhir.org「無紅字」驗證截圖（手動放入）
4. `logs/` — 實際寫入測試站的交換 Log（複製 `server/logs/exchange.log`）

## 七大 TW Core 資源

| Resource | Profile | 核心欄位 | 關鍵 reference |
| --- | --- | --- | --- |
| Organization | [Organization-hosp-twcore](https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Organization-hosp-twcore) | identifier、name、type（hosp）、active | — |
| Practitioner | [Practitioner-twcore](https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Practitioner-twcore) | identifier、name（family/given）、gender | — |
| Patient | [Patient-twcore](https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Patient-twcore) | identifier、name、gender、birthDate、address / telecom | managingOrganization |
| Encounter | [Encounter-twcore](https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Encounter-twcore) | status（in-progress/finished）、class（門診 AMB）、period | subject / serviceProvider / participant |
| Condition | [Condition-twcore](https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Condition-twcore) | code（ICD-10）、clinicalStatus、onsetDateTime | subject / encounter |
| Observation | [Observation-twcore](https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Observation-twcore) | code（LOINC）、status（final）、valueQuantity | subject / encounter |
| MedicationRequest | [MedicationRequest-twcore](https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/MedicationRequest-twcore) | status（active）、medicationCodeableConcept、dosageInstruction | subject / encounter / requester |

## 已確認事項（規格書 §09）

1. **identifier 設計** — 不使用真實個資／機構代碼。`identifier.system` 採測試專用
   命名空間 `urn:test:tw-exchange:{resource}-id`，`identifier.value` 由後端隨機亂數產生
   （因此 preview 與實際送出的 identifier 值不同、結構相同）。
2. **PractitionerRole** — 不建立正式 PractitionerRole 關聯；`Encounter.participant`
   直接引用 Practitioner。
3. **驗證機制** — HAPI 測試站暫不需要 API Key／Bearer Token；`fhirClient.js` 已預留
   auth header 擴充點（設定 `FHIR_AUTH_TOKEN` 環境變數即自動帶入）。
4. **資源範圍** — 不分階段，一次建置七種 ResourceType。

## 版本演進紀錄

### v1 — 依規格書完成系統建置

- 三層式架構：Vue 3 前端（7 建立表單 + 2 查詢頁）→ Express 中介 API
  （route 工廠 × 7、TW Core builder × 7、fhirClient、logger）→ twcore 測試站
- 統一回應格式 `{ id, status, resourceType }`、紅綠結果卡片、
  已建立資源登錄簿（localStorage）、結構化 console log

### v2 — JSON 規格預覽

- 新增 `POST /api/{resource}/preview`：只組裝 TW Core JSON、不寫入 FHIR Server
- 前端每個建立頁提供「產生 JSON」面板，可複製 / 下載 .json 供 Validator 手動驗證；
  預覽與實際送出共用同一套 builder，結構保證一致

### v3 — 講評回饋五項建議

依講評（2026-07-14）建議與擴充需求，依「必填驗證 → 環境切換 → Log 存證 →
驗證證據 → CDS Hooks」順序完成：

| # | 對應講評 | 內容 |
| --- | --- | --- |
| 1 | 建議 4 | builder 必填驗證：移除掩蓋空輸入的預設值，缺欄位回 400 + OperationOutcome |
| 2 | 新需求（建議 5） | FHIR Server 環境切換：twcore ⇄ hapi.fhir.org，登錄簿依環境隔離 |
| 3 | 建議 2 | 交換 Log 同步寫入 `logs/exchange.log`，每行標記目標環境 |
| 4 | 建議 1 | `npm run validate`：批次產出資源 JSON 與 `$validate` 報告至 `docs/validation/` |
| 5 | 建議 3 | CDS Hooks：discovery + patient-summary（生命徵象警示）+ medication-duplicate-check（重複用藥） |
