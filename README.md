# FHIR 交換測試系統（FHIR Exchange Test System）

依據《FHIR 交換測試系統 架構設計規格書（DRAFT v1.0）》建置的完整實作專案。
一次性建置七種 ResourceType，符合 **TW Core IG** 規範，資料實際寫入
[twcore.hapi.fhir.tw](https://twcore.hapi.fhir.tw/fhir) 測試伺服器。

| 項目 | 技術 |
| --- | --- |
| 前端 | Vue 3 + Vite（+ vue-router、axios） |
| 後端 | Express（axios、cors、dotenv、morgan） |
| ResourceType | 共 7 種 |
| FHIR Server | HAPI 測試站 `https://twcore.hapi.fhir.tw/fhir`（FHIR R4） |

## 系統架構

三層式：**Vue 前端 → Express 中介 API → 台灣 HAPI FHIR 測試伺服器**。
Express 不落地資料庫，僅作為 proxy / 組裝層，所有資源實際存放在遠端 FHIR Server。
同一套 route / builder / log 模式套用在全部七種資源。

```
┌─────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│ Frontend (Vue 3)    │   │ Express API              │   │ FHIR Server              │
│ ├ 建立資源表單 × 7   │ → │ ├ Route 層 × 7           │ → │ twcore.hapi.fhir.tw/fhir │
│ ├ 建立結果卡片       │   │ │  /api/{resource}       │   │ 遠端測試站 · 公開沙盒     │
│ │  id / status 顯示  │   │ ├ Resource Builder × 7   │   │ 已載入 TW Core Profile   │
│ └ 查詢頁面          │   │ │  TW Core JSON 組裝      │   │ 驗證規則                 │
│    Org 病患清單 /    │   │ ├ FHIR Client            │   └──────────────────────────┘
│    單筆查詢         │   │ │  axios wrapper          │
└─────────────────────┘   │ └ Logger console 結構化輸出│
                          └──────────────────────────┘
```

## 情境

一位病患到醫院**門診就醫**：機構與醫師資料已存在 → 建立病患 →
開立**一次就診（Encounter）** → 醫師記錄**診斷（Condition）**與**生命徵象（Observation）**
→ 開立**用藥醫囑（MedicationRequest）**。七種資源一次建置完成，不分階段。

## 目錄結構

```
├─ server/
│  ├─ src/
│  │  ├─ index.js               # Express 進入點
│  │  ├─ config.js              # FHIR_BASE_URL、TW Core Profile URLs
│  │  ├─ fhirClient.js          # axios wrapper（預留 auth header 擴充點）
│  │  ├─ logger.js              # console 結構化輸出
│  │  ├─ builders/              # TW Core JSON 組裝 × 7
│  │  │  ├─ common.js           #   identifier / meta / reference 共用工具
│  │  │  ├─ organization.js
│  │  │  ├─ practitioner.js
│  │  │  ├─ patient.js
│  │  │  ├─ encounter.js
│  │  │  ├─ condition.js
│  │  │  ├─ observation.js
│  │  │  └─ medicationRequest.js
│  │  └─ routes/                # 對應 7 個 builder + 2 查詢端點
│  ├─ .env.example
│  └─ package.json
├─ client/
│  ├─ src/
│  │  ├─ views/                 # 7 建立 + 2 查詢頁面
│  │  │  ├─ CreateOrganization.vue
│  │  │  ├─ CreatePractitioner.vue
│  │  │  ├─ CreatePatient.vue
│  │  │  ├─ CreateEncounter.vue
│  │  │  ├─ CreateCondition.vue
│  │  │  ├─ CreateObservation.vue
│  │  │  ├─ CreateMedicationRequest.vue
│  │  │  ├─ QueryByOrganization.vue
│  │  │  └─ QueryByPatientId.vue
│  │  ├─ components/
│  │  │  └─ ResourceResultCard.vue   # 綠色 = 2xx；紅色 = 4xx/5xx + OperationOutcome
│  │  ├─ store.js               # 已建立資源登錄簿（下拉選單資料來源）
│  │  ├─ api.js / router.js / App.vue / main.js
│  ├─ .env.example
│  └─ package.json
└─ README.md
```

## 快速開始

前後端分別開發、獨立啟動。

### 1. 啟動後端（http://localhost:3000）

```bash
cd server
npm install
cp .env.example .env     # FHIR_BASE_URL=https://twcore.hapi.fhir.tw/fhir, PORT=3000
npm run dev              # nodemon，含 console log
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
前端以「已建立資源登錄簿」（localStorage）自動提供下拉選單。

## API 設計

七種資源共用同一種端點模式：`POST /api/{resource}` 建立、內部轉呼叫 HAPI FHIR，
回應整理成一致的 `{ id, status, resourceType }` 格式。

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

成功回應範例（回傳給前端）：

```json
{ "resourceType": "Encounter", "id": "tw-enc-5510", "status": 201 }
```

失敗（4xx/5xx）時附上 FHIR 的 `OperationOutcome`，前端以紅色卡片顯示錯誤訊息。

### JSON 規格預覽（Validator 手動驗證）

每個建立頁面都提供「**產生 JSON**」按鈕：以與「送出建立」完全相同的表單資料呼叫
`POST /api/{resource}/preview`，回傳後端 builder 組裝後的 TW Core JSON（含
`meta.profile`），**不會寫入 FHIR Server**。畫面上可直接**複製**或**下載 .json**，
貼到 [validator.fhir.org](https://validator.fhir.org/) 或以 HAPI `$validate`
操作手動驗證資料格式是否符合 TW Core IG。

> 注意：identifier.value 由後端隨機亂數產生，因此每次預覽產生的 identifier
> 會與實際送出建立時不同（結構相同）。

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

## Server 端 Console Log 規格

每次呼叫 FHIR Server 前後都輸出結構化 log，七種資源共用同一套格式：

```
[2026-07-03 10:12:04]  → POST /Patient  resourceType=Patient identifier=tw-pat-20318841
[2026-07-03 10:12:05]  ← 201 Created  Patient/tw-pat-2031  (812ms)
[2026-07-03 10:15:01]  → GET /Patient/tw-pat-9999
[2026-07-03 10:15:01]  ← 404 Not Found  OperationOutcome: 找不到指定資源  (120ms)
```

- **請求前**：時間、方法、路徑、組裝後的 resource 摘要
- **回應後**：HTTP status、resource id 或錯誤訊息、耗時 (ms)
- **實作**：`morgan` 記錄 HTTP 存取層；自訂 `logger.js` 記錄 FHIR 交換細節

## FHIR Server 環境切換

前端側邊欄可切換資源寫入/查詢的目標環境，選擇隨每個請求以 `X-FHIR-Env` header 帶到後端：

| 環境 key | 名稱 | Base URL |
| --- | --- | --- |
| `twcore`（預設） | 台灣 TW Core 測試站 | `https://twcore.hapi.fhir.tw/fhir` |
| `hapi-org` | HAPI 國際公開站（R4） | `https://hapi.fhir.org/baseR4` |

- 「已建立資源登錄簿」依環境隔離：twcore 建立的資源 id 不會出現在 hapi-org 的
  下拉選單，避免跨環境無效 reference
- 交換 Log 每行標記目標環境（`[twcore]` / `[hapi-org]`）
- 環境清單與 URL 可用環境變數覆蓋（`FHIR_URL_TWCORE`、`FHIR_URL_HAPI_ORG`、`FHIR_ENV`）

## CDS Hooks

在既有讀取路徑上提供 [CDS Hooks](https://cds-hooks.hl7.org/) 臨床決策支援端點
（掛在伺服器根路徑，非 `/api` 之下）：

| 端點 | Hook | 說明 |
| --- | --- | --- |
| `GET /cds-services` | — | Discovery：列出可用服務 |
| `POST /cds-services/patient-summary` | `patient-view` | 彙整病患的 Condition / Observation / MedicationRequest；生命徵象超出正常範圍（心率 60–100、收縮壓 90–140、舒張壓 60–90、體溫 36–38、呼吸 12–20）時回傳 warning 卡片 |
| `POST /cds-services/medication-duplicate-check` | `order-select` | 比對草稿藥囑與病患現有 active MedicationRequest，重複時回傳 warning 卡片 |

呼叫範例：

```bash
curl -X POST http://localhost:3000/cds-services/patient-summary \
  -H 'Content-Type: application/json' \
  -H 'X-FHIR-Env: twcore' \
  -d '{ "hook": "patient-view", "hookInstance": "demo-1",
        "context": { "patientId": "<Patient id>" } }'
```

回應為標準 CDS Hooks `{ cards: [...] }` 格式（`summary` / `indicator` / `detail` /
`source`）。前端「CDS Hooks 卡片」頁面可直接選擇病患呼叫兩個服務並渲染卡片。
環境依 `X-FHIR-Env` header 決定（亦支援 request body 的 `fhirServer` 欄位比對）。

## 驗證證據（docs/validation/）

`server` 內建驗證證據產出工具：

```bash
cd server
npm run validate                  # 產出七種資源 JSON → docs/validation/resources/
npm run validate -- --env twcore  # 加打 HAPI $validate，報告存 docs/validation/reports/twcore/
npm run validate -- --env all     # 對兩個環境都驗證
```

另可把 `docs/validation/resources/` 的 JSON 貼到
[validator.fhir.org](https://validator.fhir.org/) 截圖存證；
實際寫入的交換 Log 會同步存到 `server/logs/exchange.log`，
複製到 `docs/validation/logs/` 即完成存證。詳見
[docs/validation/README.md](docs/validation/README.md)。

## 已確認事項（規格書 §09）

1. **identifier 設計** — 不使用真實個資／機構代碼。`identifier.system` 採測試專用
   命名空間 `urn:test:tw-exchange:{resource}-id`，`identifier.value` 由後端隨機亂數產生。
2. **PractitionerRole** — 不建立正式 PractitionerRole 關聯；`Encounter.participant`
   直接引用 Practitioner。
3. **驗證機制** — HAPI 測試站暫不需要 API Key／Bearer Token；`fhirClient.js` 已預留
   auth header 擴充點（設定 `FHIR_AUTH_TOKEN` 環境變數即自動帶入）。
4. **資源範圍** — 不分階段，一次建置七種 ResourceType。
