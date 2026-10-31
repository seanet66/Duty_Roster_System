# AGENTS.md — 離線值日生排班系統

## 專案型態
- 整個系統只有一個檔案：`值日生排班管理系統.html`（CSS + 5 個分頁 + 原生 JS 全在同一檔內，外層 IIFE，零框架、零依賴、不得引入 CDN）。升級時保留單一檔案架構或以日期另存新版。
- 無 package.json、無 build/test/lint、非 git repo。驗證方式 = 開瀏覽器實測，或起本地 HTTP server 連結瀏覽器測試。
- 需求權威來源：`值日生排班系統_詳細開發規格.md`。改排班行為前必讀 §4 排班規則，改完對照 §6 驗收清單；§7 為已知未完成項。
- 首頁 hero 有署名「Designed by 林永松」，勿移除。

## 資料層
- 全部狀態在瀏覽器 `localStorage`，key = `offlineDutyRoster_v1`，結構：`{settings, students[], holidays[], assignments, users[], viewMonth}`。資料不在 HTML 檔內，不能只複製檔案移機，靠 JSON 備份匯出/還原（還原前必須驗證結構，失敗不可覆蓋 state）。
- `settings` 預設值（title「勞動力發展署桃竹苗分署」、subtitle「雲端網管與資安(幼獅)第2期」、`dailyCount: 2`）在 `defaults` 常數；`loadState()` 會把舊儲存資料中「空標題或舊預設標題」自動遷移成新預設，已自訂的標題不覆蓋；啟動時會確保 `users` 陣列存在且包含預設管理員。
- 學號一律**字串**保存（保留 001 前置零），排序用 `localeCompare('zh-Hant',{numeric:true})` 自然排序。
- `Date` 一律以中午 12 點建立：`new Date(y, m-1, d, 12)`，避免時區偏移。
- 所有動態內容輸出前必經 `esc()`；XML 匯出另用 `escXml`。
- 修改 students / holidays / settings 後需 `ensureAssignments()` 重算班表。

## 帳號權限與安全性（2026/10 新增）
- **登入畫面與認證**：
  - 未登入時主頁面 `#appMain` 保持 `hidden`，顯示全螢幕 `#loginOverlay`。登入成功後存入 `sessionStorage`（key: `offlineDutyRoster_session`）。
  - 預設管理員帳號：`skynet99`，預設密碼：`iamagoodstudent`，角色：`admin`，為系統保留帳號不可刪除。提供給其他班級使用時可直接以此密碼登入後自行修改。
- **帳號角色與權限隔離**：
  - `admin`（系統管理員）：擁有完整功能，包含「學員資料」、「系統設定」、「假日管理」、「匯入／匯出」、手動調整值日生、匯出 Excel/PDF、重新排班等。
  - `user`（一般使用者/學生）：僅能瀏覽首頁班表。系統導覽列自動隱藏其他 4 個分頁；首頁自動隱藏「匯出本月 Excel」、「列印／另存 PDF」、「重新自動排班」；班表內的指定下拉選單轉為純文字「唯讀」；嘗試訪問其他分頁會被攔截導回首頁。
- **密碼原則與強制改密碼**：
  - 密碼原則：長度強制規範為 **8 至 20 個字元**（因應自訂密碼彈性，Admin 新增、Admin 重置、使用者自訂均受檢驗與提示）。
  - Admin 新增帳號預設 `firstLogin: true`。使用者首次登入時，登入遮罩隱藏並彈出「首次登入：請修改密碼」Modal，完成設定後方可解鎖進入首頁。
  - Admin 可於「系統設定」內為忘記密碼的使用者進行密碼重置。
- **閒置自動登出機制與即時狀態顯示（2026/10 新增）**：
  - 於「系統設定」提供「閒置自動登出時間（分鐘）」輸入項（`settings.autoLogoutMinutes`，預設為 10 分鐘，範圍 0 至 99 分鐘）。
  - 設定為 `0` 表示停用自動登出。
  - 系統監聽使用者鍵盤、滑鼠、滾動與觸控事件，當閒置時間達到設定分鐘數時，自動清除登入 session、彈出逾時提示並導回登入畫面。
  - **首頁即時閒置狀態顯示**：登入後首頁頂部 pill 區塊即時顯示目前已閒置多久與剩餘自動登出時間（如 `⏳ 閒置：1分20秒 (剩 8分40秒)`），倒數 3 分鐘顯示黃色警示，倒數 1 分鐘顯示紅色高亮警示；若設定為 0 分鐘則顯示 `(未啟用登出)`。

## 排班規則（勿重新發明）
- 範圍：開始日~結束日（含端點，原稱開訓日／結訓日）內的上課日；週六日與假日管理中 type=holiday 跳過，type=workday 可覆寫週末；同日假資料唯一。
- **每日排 1 位 或 2 位值日生切換（2026/10 新增）**：
  - `settings.dailyCount` 控制為 `1` 或 `2`（預設為 2）。由 Admin 於「系統設定」切換。
  - 設為 1 位時：每日排班為 `{studentId, studentId2: null, manual}`，輪替 cursor 每次 `+1`；首頁與匯出表格欄位自動切換為單一「值日生」欄位。
  - 設為 2 位時：每日排班為 `{studentId, studentId2, manual}`，輪替 cursor 每次 `+2`。
- **幹部跳過**：職稱非「學員」（班長/副班長/服務股長）不排值日；所有排班相關名單一律用 `eligibleStudents()`（= sortedStudents 過濾 role==='學員'）。手動指定下拉、第一位值日生下拉也只用這份名單。
- 學號改動須同步：assignments 的引用、settings.firstStudentId；刪除學員須清理 assignments。
- editMode：
  - A = 手動指定後自該組/該位下一位依學號接續（1位或2位自動適配 cursor）；
  - B = 手動日期固定、其餘重排（避開手動日期學員）；
  - C = 整表重算（需 confirm，C 模式手動不保留）。

## 假日管理與自動更新（2026/10 優化）
- **自動更新國定假日**：
  - API 來源：`https://api.pin-yi.me/taiwan-calendar`（預設）。
  - **URL 規範**：請求年度時**結尾必須加斜線**（例如 `.../2027/`），避免伺服器 301 轉址時丟失 CORS 標頭而引發 `Failed to fetch` 錯誤。
  - 自動識別假日：一般假日新增為 `type: 'holiday'`，週末補班日新增為 `type: 'workday'`；一般正常無備註週末不冗餘寫入。自動更新的假日帶有 `source: 'api'`，在介面上顯示標籤為 `(自動)`。
  - 限速保護：每次跨年度請求設有 650ms 延遲。手動新增之假日優先保留不覆蓋。
- **批次清空功能（防呆）**：
  - **學員管理**：提供「清空所有學員」按鈕，需手動輸入「全部刪除」文字確認方可執行。
  - **假日管理**：提供「清空所有假日」（輸入「全部刪除」確認）與「僅清除自動更新假日」（一鍵只刪除 `source==='api'` 之資料，保留手動假）。

## 介面與導覽（2026/10 優化）
- **日曆式年月選擇器**：首頁月份切換改為 `<input type="month">`（可直接點擊彈出日曆直接跳選年與月），並搭配 `◀`、`▶` 與「本月」快速跳轉鍵。
- **即時時鐘與深色/淺色主題模式**：
  - 登入頁與首頁均具備即時時鐘：格式為西元年月日 + 星期 + 24 小時制（例如 `2026/10/30 (星期五) 20:30:15`），每秒更新。
  - 登入頁右上角與首頁頁首均提供「深色 / 淺色模式切換按鈕」，支援自動偵測作業系統偏好並以 `localStorage`（key: `offlineDutyRoster_theme`）保存使用者選擇。
- UI 全為繁體中文（zh-Hant）；職稱選項固定 `ROLE_OPTIONS` 四值。

## 匯出/匯入慣例
- 匯出的日期過濾：`guardExport()` 先檢查開訓/結訓日與是否產生得上課日；`monthOrFull()` 本月無排班日時**自動 fallback 匯出完整課程班表**。
- **PDF 匯出為每月一頁的月曆**（A4 橫向，@page 於 CSS 頂層，`break-after:page` 分頁）：`printRoster()` 產出 `.pc-month` 區塊；動態格高計算 `rowh=Math.max(20,Math.min(34,Math.floor(148/rows)))`。依 `dailyCount` 自動適配 1 位或 2 位學員顯示。
- CSV 匯入/匯出為 UTF-8 + BOM；Excel 匯出是 XML Spreadsheet 2003 格式（.xls，非原生 xlsx）。JSON 備份含 version 與 exportedAt，包含使用者帳號與設定完整匯出還原。
- **Supabase 專業雲端即時資料庫與多班級架構（PostgreSQL，2026/10 升級）**：
  - 系統全面升級串接至 Supabase 雲端資料庫（REST API + RLS + 即時同步），徹底解決單機 LocalStorage 移機困擾。
  - **多班級隔離（Multi-tenancy）**：系統支援以網址參數 `?class=班級代號`（如 `?class=class02`，預設為 `default`）進行多班級資料完全隔離。首頁頂部 pill 顯示目前班級，各班級的學員、假日、排班及使用者獨立運作。
  - **前端雙軌自動保底**：當管理員排班或修改學員時，自動推送至 Supabase；所有同學開啟網頁時自動拉取最新雲端排班。即使離線或網路異常，自動無縫退回本機 localStorage 安全保底。

## 驗證與環境抓手
- 合成測試法：本地 node HTTP server + 內建瀏覽器；以 `evaluate` 寫入 seed localStorage（含 settings/students/holidays/users）→ reload 測試。
- 語法檢查：抽出 `<script>` 後 `node --check`。
- 工作目錄在 Windows，PowerShell 查看中文檔名/內容前先設 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`，否則亂碼。
