import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_PATH = path.resolve(__dirname, "../public/trade-data.json");

function toBeijingISO(d = new Date()) {
  const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return bj.toISOString().replace("Z", "+08:00");
}

function nowISO() {
  return toBeijingISO();
}

function todayISO() {
  // 用北京时间计算当天日期
  const bj = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const yyyy = bj.getUTCFullYear();
  const mm = String(bj.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(bj.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeNum(x) {
  if (x === null || x === undefined) return null;
  const cleaned = String(x).replace(/,/g, "").replace(/\s+/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

async function fetchText(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "User-Agent": "trade-dashboard/1.0 (+https://github.com)",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "User-Agent": "trade-dashboard/1.0 (+https://github.com)",
      "Accept": "application/json,text/plain,*/*",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function withRetry(fn, { tries = 3, sleepMs = 800 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, sleepMs * (i + 1)));
    }
  }
  throw lastErr;
}

// --- FX spot via XE ---
async function fetchXeRate(from, to) {
  const url = `https://www.xe.com/zh-cn/currencyconverter/convert/?Amount=1&From=${encodeURIComponent(from)}&To=${encodeURIComponent(to)}`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const re = new RegExp(`1\\.00\\s*${from}\\s*=\\s*([0-9.,\\s]+)\\s*${to}`, "i");
  const m = text.match(re);
  if (!m || !m[1]) throw new Error(`XE parse failed for ${from}->${to}`);
  return safeNum(m[1]);
}

async function getSpotFxFromXe() {
  const [usdCny, usdBrl, brlCny] = await Promise.all([
    withRetry(() => fetchXeRate("USD", "CNY")),
    withRetry(() => fetchXeRate("USD", "BRL")),
    withRetry(() => fetchXeRate("BRL", "CNY")),
  ]);
  return {
    usdCny,
    usdBrl,
    brlCny,
    sources: {
      spot: "https://www.xe.com/zh-cn/currencyconverter/",
    },
  };
}

// --- USD/CNY mid via chinamoney ccpr.json ---
function* walk(obj) {
  if (Array.isArray(obj)) {
    for (const x of obj) yield* walk(x);
    return;
  }
  if (obj && typeof obj === "object") {
    yield obj;
    for (const k of Object.keys(obj)) yield* walk(obj[k]);
  }
}

function extractUsdCnyMidFromJson(json) {
  const hits = [];
  for (const o of walk(json)) {
    if (!o || typeof o !== "object") continue;
    const pairStr = String(o.ccyPair ?? o.currencyPair ?? o.vrtEName ?? o.vrtEname ?? o.pair ?? o.name ?? "");
    const blob = (pairStr + " " + JSON.stringify(o)).toUpperCase();
    const isTarget =
      /USD\s*\/\s*CNY/.test(blob) ||
      /USD\s*CNY/.test(blob) ||
      /美元\s*\/\s*人民币/.test(pairStr) ||
      /美元\s*\/\s*人民币/.test(blob);
    if (!isTarget) continue;

    const rate =
      safeNum(o.middleRate) ??
      safeNum(o.centralParity) ??
      safeNum(o.parity) ??
      safeNum(o.mid) ??
      safeNum(o.price) ??
      safeNum(o.value) ??
      safeNum(o.last);

    if (rate !== null) hits.push(rate);
  }
  return hits.length ? hits[0] : null;
}

async function getUsdCnyMid() {
  const endpoints = [
    "https://iftp.chinamoney.com.cn/r/cms/www/chinamoney/data/fx/ccpr.json",
    "https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/fx/ccpr.json",
  ];
  for (const url of endpoints) {
    try {
      const json = await withRetry(() => fetchJson(url), { tries: 3, sleepMs: 1000 });
      const mid = extractUsdCnyMidFromJson(json);
      if (mid !== null) return mid;
    } catch {}
  }
  return null;
}

// --- commodities ---


async function getAuAgSmm() {
  // 数据源：上海有色 SMM H5 贵金属
  // 黄金：99黄金价格（998.4 CNY/g）
  // 白银：Ag99.99白银价格（19420 CNY/kg）
  const url = "https://hq.smm.cn/h5/precious-metals-price";
  const html = await fetchText(url);
  const $ = cheerio.load(html);

  const toNum = (s) => {
    const v = safeNum(String(s).replace(/[^\d.,-]/g, ""));
    return v == null ? null : v;
  };

  // 1) 优先按表格行解析：名称 | 价格范围 | 均价 | 涨跌 | 单位 | 日期
  const rows = [];
  $("tr").each((_, tr) => {
    const tds = $(tr)
      .find("td,th")
      .toArray()
      .map((el) => $(el).text().replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (tds.length >= 5) rows.push(tds);
  });

  function findAvgByName(nameIncludes) {
    for (const cells of rows) {
      const name = cells[0] || "";
      if (!nameIncludes.some((k) => name.includes(k))) continue;

      // 一般结构：0=名称 1=价格范围 2=均价 3=涨跌 4=单位 5=日期
      // 但 H5 站点有时列会变化：因此做多策略取值
      const avgCell = cells[2] ?? "";
      const rangeCell = cells[1] ?? "";
      let avg = toNum(avgCell);

      // 如果均价列不是纯数字（可能是 “998.4 - 998.4”），则从范围里取第一个数字
      if (avg == null) {
        const m = String(avgCell).match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)/);
        avg = safeNum(m?.[1]);
      }
      if (avg == null) {
        const m = String(rangeCell).match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)/);
        avg = safeNum(m?.[1]);
      }

      const unit = cells[4] || cells[cells.length - 2] || "";
      return { avg, unit, name };
    }
    return null;
  }

  const goldRow = findAvgByName(["99黄金价格"]);
  const silverRow = findAvgByName(["Ag99.99白银价格", "IC-Ag99.99白银价格"]);

  // 2) 如果表格没抓到（页面结构变化），用整页文本正则兜底：明确取“均价”那一段
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  const pickAvgFromText = (re) => {
    const m = bodyText.match(re);
    return m ? safeNum(m[1]) : null;
  };

  const goldFallback =
    pickAvgFromText(/99黄金价格[^\d]*([0-9]+(?:\.[0-9]+)?)\s*-\s*[0-9]+(?:\.[0-9]+)?\s*[0-9]+(?:\.[0-9]+)?/) ||
    pickAvgFromText(/99黄金价格[^\d]*[0-9]+(?:\.[0-9]+)?\s*-\s*[0-9]+(?:\.[0-9]+)?\s*([0-9]+(?:\.[0-9]+)?)/);

  const silverFallback =
    pickAvgFromText(/(?:IC-)?Ag99\.99白银价格[^\d]*[0-9]+(?:\.[0-9]+)?\s*-\s*[0-9]+(?:\.[0-9]+)?\s*([0-9]+(?:\.[0-9]+)?)/) ||
    pickAvgFromText(/(?:IC-)?Ag99\.99白银价格[^\d]*([0-9]+(?:\.[0-9]+)?)/);

  const au = goldRow?.avg ?? goldFallback ?? null;
  const ag = silverRow?.avg ?? silverFallback ?? null;

  // 单位按你的口径固定（页面是 元/克 与 元/千克）
  return {
    au9999: { value: au, unit: "CNY/g", source: url },
    ag9999: { value: ag, unit: "CNY/kg", source: url },
  };
}





async function getCopperAndAluminum() {
  const url = "https://m.ccmn.cn/";
  const html = await fetchText(url);
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  const mCu = text.match(/1#铜\s*([0-9,]+)—([0-9,]+)\s*([0-9,]+)/);
  const copper = mCu ? safeNum(mCu[3]) : null;
  const mAl = text.match(/A00铝\s*([0-9,]+)—([0-9,]+)\s*([0-9,]+)/);
  const aluminum = mAl ? safeNum(mAl[3]) : null;
  return {
    copper1: { value: copper, unit: "CNY/t", source: url },
    aluminumA00: { value: aluminum, unit: "CNY/t", source: url },
  };
}

async function getIronOre62From100ppi() {
  // 参考：生意社 - 铁矿石 62% FE 粉矿（基准价）
  const url = "https://www.100ppi.com/vane/detail-961.html";
  const val = await getBasePrice100ppi(url, { nameHint: "铁矿石" });
  return { ironOre62: { value: val, unit: "CNY/t", source: url } };
}

async function getWtiBrentOil() {
  // 生意社原油频道会滚动发布最新一条 WTI/Brent 基准价（更适合每日定时抓取）
  const url = "https://www.100ppi.com/crudeoil/";
  const html = await fetchText(url);
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");

  const mWti = text.match(/WTI原油\S*基准价为([0-9.]+)美元\/桶/);
  const mBrent = text.match(/Brent原油\S*基准价为([0-9.]+)美元\/桶/i);

  const wti = mWti ? safeNum(mWti[1]) : null;
  const brent = mBrent ? safeNum(mBrent[1]) : null;

  return {
    wti: { value: wti, unit: "USD/bbl", source: url },
    brent: { value: brent, unit: "USD/bbl", source: url },
  };
}


async function getBasePrice100ppi(url, { unit = "CNY/t", nameHint = "" } = {}) {
  const html = await fetchText(url);
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  // 生意社常见格式："1月7日生意社XXX基准价为8237.50元/吨"
  const re = new RegExp(`${nameHint ? nameHint.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") : ""}\\S*基准价为([0-9.]+)元\\/吨`);
  const m = text.match(re) || text.match(/基准价为([0-9.]+)元\/吨/);
  return safeNum(m?.[1]);
}

async function getPpAbsPvcLithiumFrom100ppi() {
  const ppUrl = "https://www.100ppi.com/vane/detail-718.html"; // PP (聚丙烯-拉丝级)
  const absUrl = "https://www.100ppi.com/vane/detail-713.html"; // ABS (通用级)
  const pvcUrl = "https://www.100ppi.com/vane/detail-107.html"; // PVC (SG-5) - 基准价口径
  const liUrl = "https://www.100ppi.com/vane/detail-1162.html"; // 碳酸锂-电池级

  const [pp, abs, pvc, li] = await Promise.all([
    withRetry(() => getBasePrice100ppi(ppUrl, { nameHint: "PP" })),
    withRetry(() => getBasePrice100ppi(absUrl, { nameHint: "ABS" })),
    withRetry(() => getBasePrice100ppi(pvcUrl, { nameHint: "PVC" })),
    withRetry(() => getBasePrice100ppi(liUrl, { nameHint: "碳酸锂" })),
  ]);

  return {
    ppRaffia: { value: pp, unit: "CNY/t", source: ppUrl },
    absGeneral: { value: abs, unit: "CNY/t", source: absUrl },
    pvcSG5: { value: pvc, unit: "CNY/t", source: pvcUrl },
    lithiumCarbonate: { value: li, unit: "CNY/t", source: liUrl },
  };
}


async function getCorrugatedPaper() {
  const url = "https://m1.100ppi.com/vane/1250-%E7%93%A6%E6%A5%9E%E5%8E%9F%E7%BA%B8.html";
  const html = await fetchText(url);
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  // 表格通常类似："01-07 2950.00 0.00%"，取最靠前的一条
  const m = text.match(/\b\d{2}-\d{2}\s+([0-9]+\.[0-9]+)\s+[-+0-9.]+%/);
  const price = m ? safeNum(m[1]) : null;
  return { corrugatedPaper: { value: price, unit: "CNY/t", source: url } };
}

async function getZinc0() {
  const url = "https://m.ccmn.cn/";
  const html = await fetchText(url);
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  const m = text.match(/0#锌\s*([0-9,]+)[—-]([0-9,]+)\s*([0-9,]+)/);
  const val = m ? safeNum(m[3]) : null;
  return { zinc0: { value: val, unit: "CNY/t", source: url } };
}


async function getSteelFrom100ppi() {
  const rebarUrl = "https://m1.100ppi.com/vane/927-%E8%9E%BA%E7%BA%B9%E9%92%A2.html"; // 螺纹钢 (HRB400)
  const hrcUrl = "https://m1.100ppi.com/vane/195-%E7%83%AD%E8%BD%A7%E6%9D%BF%E5%8D%B7"; // 热轧卷板

  async function fetchLatestFromVane(url) {
    const html = await fetchText(url);
    const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
    // 表格通常类似："01-07 3237.66 0.00%"，取最靠前的一条
    const m = text.match(/\b\d{2}-\d{2}\s+([0-9]+\.[0-9]+)/);
    return m ? safeNum(m[1]) : null;
  }

  const [rebar, hrc] = await Promise.all([
    withRetry(() => fetchLatestFromVane(rebarUrl)),
    withRetry(() => fetchLatestFromVane(hrcUrl)),
  ]);

  return {
    rebarHRB400: { value: rebar, unit: "CNY/t", source: rebarUrl },
    hrc: { value: hrc, unit: "CNY/t", source: hrcUrl },
  };
}



async function getCommodities() {
  const tasks = [
    ["au/ag", () => getAuAgSmm()],
    ["cu/al", () => getCopperAndAluminum()],
    ["iron ore", () => getIronOre62From100ppi()],
    ["oil", () => getWtiBrentOil()],
    ["chem", () => getPpAbsPvcLithiumFrom100ppi()],
    ["paper", () => getCorrugatedPaper()],
    ["zinc", () => getZinc0()],
    ["steel", () => getSteelFrom100ppi()],
  ];

const KEY_ALIASES = {
  aluminumA00: "alA00",
  zinc0: "zn0",
  rebarHRB400: "rebar",
  corrugatedPaper: "corrugated",
  ppRaffia: "pp",
  absGeneral: "abs",
  pvcSG5: "pvc",
};


  const settled = await Promise.allSettled(tasks.map(([_, fn]) => withRetry(fn)));

  const commodities = {};
  const errors = {};

  settled.forEach((res, i) => {
    const [name] = tasks[i];

    if (res.status === "fulfilled") {
      const obj = res.value || {};
      for (const [k, v] of Object.entries(obj)) {
        const kk = KEY_ALIASES[k] ?? k;
        commodities[kk] = v;
        if (v?.value === null || v?.value === undefined || Number.isNaN(v?.value)) {
          // 解析失败但不抛错：记录下来，方便前端/历史列表定位原因
          errors[k] = `parse_failed (${name})`;
          console.warn(`[WARN] Commodity parsed null: ${k} (${name})`);
        }
      }
    } else {
      const msg = res.reason?.message ?? String(res.reason);
      errors[`subtask:${name}`] = msg;
      console.warn(`[WARN] Commodity subtask failed: ${name}: ${msg}`);
    }
  });

  return { commodities, errors };
}


// --- read/write ---
function readExisting() {
  if (!fs.existsSync(OUT_PATH)) return [];
  try {
    const json = JSON.parse(fs.readFileSync(OUT_PATH, "utf-8"));
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

function writeRows(rows) {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(rows, null, 2) + "\n", "utf-8");
}

async function main() {
  const date = todayISO();
  const ts = nowISO();
  const rows = readExisting();

  async function safe(name, fn) {
    try {
      return { ok: true, data: await fn() };
    } catch (e) {
      console.error(`[WARN] ${name} failed:`, e?.message ?? e);
      return { ok: false, data: null, error: e?.message ?? String(e) };
    }
  }

  const fxSpotR = await safe("FX spot (XE)", getSpotFxFromXe);
  const midR = await safe("USD/CNY mid (Chinamoney)", getUsdCnyMid);
  const commR = await safe("Commodities", getCommodities);

  const fx = {
    ...(fxSpotR.data ?? { usdCny: null, usdBrl: null, brlCny: null, sources: { spot: "xe.com" } }),
    usdCnyMid: midR.data ?? null,
    sources: {
      ...(fxSpotR.data?.sources ?? { spot: "xe.com" }),
      mid: "chinamoney.com.cn (ccpr.json)",
    },
  };

  const commodities = commR.data?.commodities ?? {};

  const row = {
    date,
    ts,
    fx,
    commodities,
    errors: {
      fxSpot: fxSpotR.ok ? null : fxSpotR.error,
      usdCnyMid: midR.ok ? null : midR.error,
      commodities: commR.ok ? null : commR.error,
      commoditiesDetailed: commR.data?.errors ?? null,
    },
  };

  // 允许一天多次写入：默认追加；如果上一次抓取距离现在 < 10 分钟，则视为重复运行，覆盖最后一条
  const last = rows.length ? rows[rows.length - 1] : null;
  let out;
  if (last?.ts) {
    const lastMs = Date.parse(last.ts);
    const nowMs = Date.parse(ts);
    const diffMin = Number.isFinite(lastMs) && Number.isFinite(nowMs) ? (nowMs - lastMs) / 60000 : Infinity;
    out = diffMin < 10 ? [...rows.slice(0, -1), row] : [...rows, row];
  } else {
    out = [...rows, row];
  }

  // 保留最近 2000 条，避免文件无限增长
  if (out.length > 2000) out = out.slice(out.length - 2000);

  out.sort((a, b) => String(a.ts ?? a.date).localeCompare(String(b.ts ?? b.date)));

  writeRows(out);
  console.log(`Updated ${OUT_PATH} (appended ${date} ${ts})`);
}



main().catch((e) => {
  console.error(e);
  process.exit(1);
});
