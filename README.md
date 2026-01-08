# 外贸数据看板（汇率 + 原材料）

## 本地运行
```bash
npm i
npm run fetch:data
npm run dev
```

## 结构
- `src/TradeDashboard.jsx`：前端页面（只读 `public/trade-data.json`）
- `scripts/fetch_trade_data.mjs`：Node 抓取脚本（写入 `public/trade-data.json`）
- `.github/workflows/fetch-trade-data.yml`：GitHub Actions 每日定时抓取

## 数据范围（按最新清单）

### 汇率
- USD/CNY（即时）
- USD/CNY（中间价）
- USD/BRL（即时）
- BRL/CNY（即时，基于 XE 汇率计算）

### 原材料
- AU99.99
- AG99.99
- 1#电解铜
- A00铝
- 热轧卷板
- 螺纹钢(HRB400)
- 铁矿石 62%FE 粉矿
- 0#锌
- PP(聚丙烯-拉丝级)
- ABS(通用级)
- PVC(SG-5)
- 碳酸锂
- 瓦楞纸
- WTI / 布伦特原油

## 说明
- 页面已改成“浅色 + 蓝色科技感”风格
- 所有卡片的 `数据源` 都是可点击跳转
- 趋势图提供分组（精选/金属/钢铁/化工/能源/纸），避免一次显示过多曲线
