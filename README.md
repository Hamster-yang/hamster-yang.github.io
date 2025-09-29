# 楊上賢 (Hamsteryang) - Medical AI Portfolio

專注於醫學影像處理與深度學習研究的個人作品集網站，採用駭客 / 終端機風格設計。

## 主要特色

### 視覺效果
- **Matrix 風格粒子背景**: 綠色矩陣風格的互動式粒子系統
- **終端機介面**: 模擬真實終端機的互動式技能展示
- **駭客配色**: 經典綠色螢光 (#00ff41) 搭配深色背景
- **網格背景**: 賽博朋克風格的背景網格線
- **發光效果**: 霓虹燈風格的光暈和陰影效果

### 動畫效果
- **滾動動畫**: 元素在進入視窗時淡入並向上移動
- **懸停效果**: 卡片和按鈕的互動式懸停動畫
- **平滑過渡**: 所有元素變化都使用流暢的過渡效果
- **視差滾動**: 裝飾形狀隨滑鼠移動產生視差效果
- **時間軸動畫**: 工作經驗以動態時間軸方式呈現

### 互動功能
- **響應式導航欄**: 固定導航欄，滾動時變化樣式
- **漢堡選單**: 移動裝置友善的折疊式選單
- **平滑錨點**: 點擊導航連結平滑滾動到對應區塊
- **滑鼠追蹤**: 裝飾元素跟隨滑鼠移動

### 區塊內容
1. **Hero Section**: 終端機風格的個人簡介與技能展示
2. **About ($ cat about.txt)**: 教育背景、醫學影像 AI 專業、研究興趣
3. **Experience ($ history)**: 動態時間軸展示工作經歷與實習經驗
4. **Skills ($ ls -la /skills/)**: 醫學影像 AI、程式開發、其他專長
5. **Contact ($ echo "Contact")**: 社交媒體和聯絡資訊

## 技術棧

- **HTML5**: 語意化標籤結構
- **CSS3**: 
  - CSS Variables 統一管理配色
  - Flexbox 和 Grid 佈局
  - CSS Animations 和 Transitions
  - Backdrop Filter 玻璃效果
- **JavaScript**: 
  - Particles.js 粒子背景
  - Intersection Observer API 滾動動畫
  - 事件監聽和 DOM 操作
- **Google Fonts**: Poppins 字體
- **Bootstrap Icons**: 圖示庫

## 文件結構

```
├── index.html                 # 主頁面
├── css/
│   ├── styles.css            # 基礎樣式和導航欄
│   └── styles-extended.css   # 各區塊詳細樣式
├── js/
│   └── scripts.js            # JavaScript 互動功能
├── assets/
│   ├── favicon.ico           # 網站圖示
│   └── profile_big.png       # 個人照片
└── README.md                 # 說明文件
```

## 瀏覽器支援

- Chrome (推薦)
- Firefox
- Safari
- Edge
- 支援移動裝置

## 自訂指南

### 更改配色
編輯 `css/styles.css` 中的 CSS 變數:
```css
:root {
    --primary-color: #00ff41;    /* 駭客綠 */
    --secondary-color: #00d4aa;  /* 青色 */
    --accent-color: #00ffff;     /* 螢光青 */
    --text-color: #00ff41;       /* 文字顏色 */
}
```

### 修改粒子效果
編輯 `js/scripts.js` 中的 particlesJS 配置:
```javascript
particles: {
    number: { value: 100 },  /* 粒子數量 */
    color: { value: '#00ff41' },  /* 矩陣綠 */
}
```

### 更新內容
直接編輯 `index.html` 中對應的區塊內容。

## 效能優化

- 使用 CDN 載入外部資源
- CSS 分檔載入減少首次載入時間
- 使用 CSS transforms 優化動畫效能
- Intersection Observer 延遲動畫觸發

## 部署

此網站為靜態網站，可直接部署到:
- GitHub Pages
- Netlify
- Vercel
- 任何靜態網站託管服務

## 授權

Copyright © 2024 Hamsteryang. All rights reserved.

## 關於作者

**楊上賢 (Hamsteryang)**
- 國立彰化師範大學資訊工程學系 碩士生
- 專注於醫學影像處理與深度學習研究
- 醫療 AI、聯邦學習、影像分割領域研究者

### 聯絡方式
- GitHub: [@Hamster-yang](https://github.com/Hamster-yang)
- Instagram: [@ysh.6201](https://www.instagram.com/ysh.6201/)
- Telegram: [@Hamster_yang](https://t.me/Hamster_yang)