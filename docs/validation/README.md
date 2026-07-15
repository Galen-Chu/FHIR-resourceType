# 驗證證據（Validation Evidence）

本目錄存放七種 ResourceType 的 TW Core JSON 與驗證結果，作為「資源合規」的證明。

## 目錄結構

```
docs/validation/
├─ resources/            # builder 產出的七種資源 JSON（validate-all.js 自動產生）
├─ reports/
│  ├─ twcore/            # twcore.hapi.fhir.tw $validate 的 OperationOutcome 報告
│  └─ hapi-org/          # hapi.fhir.org $validate 的 OperationOutcome 報告
├─ screenshots/          # validator.fhir.org 驗證截圖（手動放入）
└─ logs/                 # 實際寫入測試站的結構化交換 Log（手動放入）
```

## 如何重新產生

```bash
cd server

# 只產出七種資源 JSON
npm run validate

# 產出 JSON 並對 twcore 測試站執行 $validate（報告存 reports/twcore/）
npm run validate -- --env twcore

# 對兩個環境都執行
npm run validate -- --env all
```

## 手動補充的證據

1. **validator.fhir.org 截圖**：把 `resources/` 內的 JSON 貼到
   [validator.fhir.org](https://validator.fhir.org/)，將「無紅字」結果截圖存到
   `screenshots/`（檔名建議：`{resource}-validator-org.png`）。
2. **實際寫入 Log**：啟動 server 完整跑一次七資源建立流程後，
   將 `server/logs/exchange.log` 複製到 `logs/` 目錄。
   Log 每行含時間、目標環境、方法、路徑、HTTP status、resource id 與耗時。
