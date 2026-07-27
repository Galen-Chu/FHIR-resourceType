# Changelog

本專案的版本紀錄遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)
格式，版本號採用[語意化版本](https://semver.org/lang/zh-TW/)。

這裡聚焦「哪個版本改了什麼」；完整的背景說明（為什麼做、設計取捨）見
[README 版本演進紀錄](README.md#版本演進紀錄) 與 [docs/v4-design.md](docs/v4-design.md)。

## [Unreleased]

### 規劃中（v5）

- 與 `FHIR-bioMedData`（Python 清洗引擎）合流，新增異構資料清洗前置層
  （`POST /api/ingest/{resource}`），補上「接收異構外部資料源」的能力

## [1.1.0] — v4：寫入強健度擴充

全部為向下相容的新增功能，未變更既有 API 行為，故為 MINOR 版本。

### Added

- `PUT /api/{resource}`：以 FHIR conditional update 實作 Upsert，依
  選填的 `externalId` 判斷新增或更新；per-identifier 序列化佇列防止
  Race Condition
- IG Profile 切換矩陣：`X-FHIR-IG` header（`tw-core` / `r4-base`），
  與既有 `X-FHIR-Env` 獨立運作、可交叉組合；`GET /api/config/fhir-igs`
- Gateway 自身鑑權（`GATEWAY_API_KEY` / `X-Gateway-Key`，選用）；上游
  401/403 鑑權失敗診斷 log；Upsert 遇 412 多筆匹配轉譯為 409 去重錯誤
- ISO 8601 時間格式校準層（`birthDate`、`period`、`onsetDateTime`），
  含手動曆法檢查攔截不存在的日期（如 2/30、非閏年 2/29）
- `monitor/`：獨立 CLI + Streamlit 即時監控台（Python），讀取
  `exchange.log` 視覺化建立數、成功率、回應時間、CDS Hooks 觸發次數
- CI（GitHub Actions）：server（Jest）、client（build）、monitor（Pytest）
  三個平行 job
- server 首次導入 Jest（53 個測試）；monitor 首次導入 Pytest（16 個測試）

### Changed

- `ValidationError` 新增 FHIR IssueType 區分 `required`（缺欄位）與
  `value`（格式不合法）
- 7 個 builder 的函式簽名新增選填的 `ig` 參數
  （`meta(resourceType)` → `meta(resourceType, ig)`），未帶時退回
  預設 IG，向下相容既有呼叫方式
- `server/src/cds/index.js` 新增 CDS Hook 觸發標記 log，供監控台統計

## [1.0.0] — v1–v3：初版建置與講評回饋

### Added

- 三層式架構：Vue 3 前端（7 建立表單 + 2 查詢頁）→ Express 中介 API
  → HAPI FHIR 測試伺服器；七大 TW Core ResourceType
- JSON 規格預覽（`POST /api/{resource}/preview`）
- builder 必填驗證：缺欄位回 400 + OperationOutcome
- FHIR Server 環境切換：`twcore` ⇄ `hapi.fhir.org`，登錄簿依環境隔離
- 結構化交換 Log（`server/logs/exchange.log`）
- 驗證證據產出工具（`npm run validate`）
- CDS Hooks：`patient-summary`（生命徵象警示）、
  `medication-duplicate-check`（重複用藥檢查）
