# 記帳小豬 🐷

一個「好用、可愛、會讓人想每天打開」的個人記帳 App。
純前端 PWA — 不需要後端、不需要 npm、不需要建置，用瀏覽器打開就能用，資料只存在你自己的裝置。

---

## 為什麼是這樣設計的

三個核心決定，都是為了「**5 秒內完成一筆記帳**」與「**一週沒開也能秒懂財務狀況**」：

1. **「記帳」不佔導航分頁** — 改成任何頁面都能按的浮動 ➕，彈出底部面板，3 次觸碰完成一筆。
2. **「預算」不佔導航分頁** — 預算是「設一次、天天看進度」，所以進度長在首頁與統計頁，設定收在「我的」。
   空出來的位置給了**固定支出**，因為它比預算更常看。
3. **不做假的推播提醒** — 純前端 PWA 沒有可靠的背景推播（沒有後端、iOS 限制多）。
   改成**打開 App 就一定看得到**的到期橫幅、首頁「未來 7 天將扣款」與固定支出頁倒數。

---

## 主要功能

### 首頁 🏠
本月總支出／收入／剩餘可用（有預算就顯示預算剩餘）、預算環形進度、**今天還能花多少**、
到期扣款一鍵確認、今日／本週支出、本月累積趨勢、預算進度、最近消費、連續天數與成就。

### 快速記帳 ➕
- 自製數字鍵盤，支援 `＋` 連加（60 ＋ 40 → 100）
- 預設今天／支出／上次用的付款方式，打開就能輸入
- 類別可依「常用優先」自動排序（也可切換成自訂順序）
- **一鍵重複記帳**：自動學習你最常記的組合（例：`☕星巴克 $95`），1 次觸碰完成

### 固定支出 🔁
- 每週／每月／每季／每年／自訂（每 N 天・週・月・年）
- **每月固定支出（月均）**：把季繳、年繳自動攤平成月均
- 未來 30 天扣款時間軸、固定支出組成長條
- 到期時一鍵「記一筆／改金額／跳過」；也可以逐項開啟 ⚡ 自動記帳
- 輸入名稱時**自動猜類別**（Netflix → 訂閱、房租 → 居住、健身房 → 娛樂…）

### 統計 📊
- `本週｜本月｜本季｜今年` 自由切換，可往前翻上一期
- 與上一期比較、甜甜圈圖、柱狀圖、類別排行（含增減）、付款方式佔比
- **會說人話的洞察**：「購物比上個月多了 $796，是增加最多的類別」
- 點類別 → 該類別明細、分佈、「花在哪些地方」排行

### 預算 🎯
總預算 + 分類預算，可設定「每月沿用」。
80% 提醒、超支用溫和的橘色與鼓勵語氣，不用嚴肅紅字。

### 搜尋與篩選 🔍
關鍵字（備註／類別／付款方式／金額／日期）＋ 日期區間、金額範圍、類別、付款方式多選。

### 讓人持續使用的設計 ✨
連續記帳天數、12 個小成就、每週小結、月底回顧卡片、可愛的鼓勵文字。

---

## 怎麼使用

### 直接打開
用瀏覽器打開 `index.html` 就能用（不需要伺服器）。

### 用本機伺服器（建議，才能啟用 PWA 離線）
```bash
python3 -m http.server 8000
# 或 npx serve .
```
然後打開 http://localhost:8000/expense/

### 裝到手機主畫面
1. 把整個資料夾部署到任何靜態空間（GitHub Pages／Netlify／Vercel）
2. 手機瀏覽器打開 `你的網址/expense/`
3. 選「加入主畫面」，就會像原生 App 一樣（可離線）

---

## 資料儲存

所有資料存在瀏覽器的 `localStorage`（key：`moneybuddy.v1`），**只存在你自己的裝置上**，
不會上傳到任何伺服器。

⚠️ **換手機或清除瀏覽器資料前，先到「我的 › 匯出備份（JSON）」存一份。**
也可以匯出 CSV 給 Excel／Google 試算表用。

---

## 資料結構

```js
Transaction     { id, type, amount, categoryId, paymentMethodId, date, note, recurringId, createdAt, updatedAt }
Category        { id, name, emoji, color, type, order, isArchived, isSystem, usageCount }
PaymentMethod   { id, name, emoji, kind, isArchived }
RecurringExpense{ id, name, type, amount, categoryId, paymentMethodId,
                  freq:{unit, interval, dayOfMonth, weekday},
                  startDate, endDate, nextDueDate, autoPost, isActive, note, lastPostedDate }
Budget          budgets['YYYY-MM' | 'default'] = { total, categories:{ [categoryId]: amount } }
Settings        { currency, monthStartDay, weekStartsOn, theme, catSort,
                  lastPaymentId, streak:{count,best,lastDate}, achievements[], lastReviewMonth }
```

刪除類別時若已有紀錄，會讓你選「封存」或「搬到其他類別」，**舊紀錄不會變成孤兒**。
`schemaVersion` + `Schema.migrate()` 讓未來加欄位不會弄壞舊資料。

---

## 專案結構

```
index.html              單頁 App（hash 路由）
manifest.webmanifest    PWA 設定
sw.js                   Service Worker（網路優先，離線可用）
icon.svg                App 圖示

css/tokens.css          色彩／圓角／陰影變數（含深色模式）
css/base.css            重置與版面骨架
css/components.css      卡片／按鈕／sheet／圖表／toast
css/views.css           各頁面版面

js/utils.js             日期、金額、期間計算（支援自訂月結日）
js/schema.js            資料模型、預設類別、版本遷移
js/store.js             單一狀態源 + localStorage + 發布訂閱（頁面間資料同步）
js/repo.js              CRUD、週期扣款引擎、連續天數、成就
js/query.js             彙總引擎（期間統計、分類佔比、趨勢、搜尋、常用組合）
js/insights.js          洞察文案（比上期多／少、預算提醒、月底回顧）
js/charts.js            自繪 SVG 甜甜圈／柱狀／折線／環形進度（零依賴）
js/ui.js                sheet、toast、confirm、吉祥物、動畫
js/views/               entry / home / stats / recurring / list / catdetail / manage / achieve / me
js/app.js               路由、事件委派、初始化
```

**沒有任何外部套件**：圖表自己畫 SVG，離線 100% 可用、體積接近 0、風格完全可控。
JS 用傳統 `<script>` 分檔（不是 ES module），所以直接雙擊 `index.html` 也能跑。

---

## 未來可以怎麼擴充

- 換 IndexedDB 或接雲端同步 → 只要改 `js/repo.js` 這一層
- 加多幣別 → `Settings.currency` 已預留
- 加真的推播 → 需要後端；目前的到期邏輯（`Repo.dueList()`）可以直接接上
