import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const DATA_URL = `${import.meta.env.BASE_URL}trade-data.json`;

function num(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function formatNumber(n, digits = 4) {
  const v = num(n);
  if (v === null) return "—";
  return v.toFixed(digits);
}

function formatPct(n, digits = 1) {
  const v = num(n);
  if (v === null) return null;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

function pctChange(curr, prev) {
  const c = num(curr);
  const p = num(prev);
  if (c === null || p === null || p === 0) return null;
  return ((c - p) / p) * 100;
}

function formatTs(tsOrDate) {
  if (!tsOrDate) return "—";
  // if it's YYYY-MM-DD, show as is
  if (typeof tsOrDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tsOrDate)) return tsOrDate;
  const d = new Date(tsOrDate);
  if (Number.isNaN(d.getTime())) return String(tsOrDate);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).replaceAll("/", "-");
}

function SourceLink({ href, children }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 hover:underline"
    >
      {children}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M14 3h7v7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M10 14L21 3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M21 14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </a>
  );
}

function TechBg() {
  return (
    <>
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-sky-400/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 right-[-140px] h-[620px] w-[620px] rounded-full bg-blue-500/20 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(59,130,246,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.22) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at top, black 40%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at top, black 40%, transparent 70%)",
        }}
      />
    </>
  );
}

function GlassCard({ children, className = "" }) {
  return (
    <section
      className={
        "rounded-2xl border border-blue-200/70 bg-white/70 backdrop-blur-xl shadow-[0_0_0_1px_rgba(59,130,246,0.08),0_20px_60px_-30px_rgba(59,130,246,0.22)] " +
        className
      }
    >
      {children}
    </section>
  );
}

function Pill({ children, tone = "blue" }) {
  const toneMap = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-xs " + (toneMap[tone] ?? toneMap.blue)}>
      {children}
    </span>
  );
}

function RangeButtons({ range, setRange }) {
  const items = [
    { k: 30, label: "30D" },
    { k: 90, label: "90D" },
    { k: 365, label: "1Y" },
    { k: 9999, label: "ALL" },
  ];
  return (
    <div className="flex gap-2 flex-wrap">
      {items.map((it) => {
        const active = range === it.k;
        return (
          <button
            key={it.k}
            onClick={() => setRange(it.k)}
            className={
              "relative rounded-full px-3.5 py-1.5 text-sm transition " +
              (active ? "text-white" : "text-slate-700 hover:text-slate-900")
            }
          >
            <span
              className={
                "absolute inset-0 rounded-full border " +
                (active
                  ? "border-blue-400 bg-gradient-to-r from-blue-600 to-sky-500 shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_10px_30px_-18px_rgba(59,130,246,0.45)]"
                  : "border-blue-200/80 bg-white/70 hover:bg-white")
              }
            />
            <span className="relative font-medium">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TogglePill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "relative rounded-full px-3.5 py-1.5 text-sm transition " +
        (active ? "text-white" : "text-slate-700 hover:text-slate-900")
      }
    >
      <span
        className={
          "absolute inset-0 rounded-full border " +
          (active
            ? "border-blue-400 bg-gradient-to-r from-blue-600 to-sky-500 shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_10px_30px_-18px_rgba(59,130,246,0.45)]"
            : "border-blue-200/80 bg-white/70 hover:bg-white")
        }
      />
      <span className="relative font-medium">{children}</span>
    </button>
  );
}

function TechTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-blue-200/80 bg-white/90 px-3 py-2 text-xs text-slate-800 shadow-[0_12px_40px_-20px_rgba(2,6,23,0.30)] backdrop-blur">
      <div className="font-semibold text-slate-900">{formatTs(label)}</div>
      <div className="mt-1 space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6">
            <span className="text-slate-700">{p.name}</span>
            <span className="font-medium text-slate-900">{p.value ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClickableLegend({ payload, hiddenSet, onToggle }) {
  if (!payload?.length) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 px-2 pt-2 text-xs">
      {payload.map((item) => {
        const key = item.dataKey;
        const hidden = hiddenSet.has(key);

        return (
          <button
            key={key}
            onClick={(e) => onToggle(key, e)}
            className="flex items-center gap-1.5"
            style={{ opacity: hidden ? 0.35 : 1 }}
            title={hidden ? "点击显示（Shift=只看此项）" : "点击隐藏（Shift=只看此项）"}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span style={{ textDecoration: hidden ? "line-through" : "none" }}>
              {item.value}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MetricCard({ title, value, unit, subtitle, href, alertPct }) {
  const alert = alertPct !== null && Math.abs(alertPct) >= 10;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-white/70 p-4 backdrop-blur">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50/70 to-white/40" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs tracking-wide text-slate-600">{title}</div>
          {alert ? (
            <Pill tone="amber">
              波动 {formatPct(alertPct, 1)}
            </Pill>
          ) : null}
        </div>

        <div className="mt-1 flex items-end gap-2">
          <div className="text-2xl font-semibold text-slate-900">{value}</div>
          {unit ? <div className="pb-0.5 text-xs font-normal text-slate-500">{unit}</div> : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">{subtitle}</div>
          {href ? <SourceLink href={href}>数据源</SourceLink> : null}
        </div>
      </div>
    </div>
  );
}

function findPrev(data, pick) {
  // 从最后一条往前找上一条有效数据
  for (let i = data.length - 2; i >= 0; i--) {
    const v = pick(data[i]);
    if (num(v) !== null) return v;
  }
  return null;
}

function indexSeries(rows, keys) {
  const bases = {};
  const out = [];
  for (const r of rows) {
    const row = { x: r.x };
    for (const k of keys) {
      const v = r[k];
      if (v === null || v === undefined || Number.isNaN(v)) {
        row[k] = null;
        continue;
      }
      if (bases[k] === undefined) bases[k] = v;
      row[k] = bases[k] ? (v / bases[k]) * 100 : null;
    }
    out.push(row);
  }
  return out;
}


const LINE_PALETTE = [
  "rgba(37,99,235,0.95)",
  "rgba(14,165,233,0.95)",
  "rgba(99,102,241,0.95)",
  "rgba(16,185,129,0.95)",
  "rgba(59,130,246,0.85)",
  "rgba(6,182,212,0.85)",
  "rgba(168,85,247,0.85)",
  "rgba(245,158,11,0.85)",
];

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="absolute left-1/2 top-10 w-[min(980px,92vw)] -translate-x-1/2">
        <div className="rounded-2xl border border-blue-200/80 bg-white/95 shadow-[0_18px_60px_-30px_rgba(2,6,23,0.35)] backdrop-blur">
          <div className="flex items-center justify-between gap-4 border-b border-blue-100 px-5 py-4">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <button
              className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-blue-50"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
          <div className="max-h-[70vh] overflow-auto px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function TradeDashboard() {
  const [data, setData] = useState([]);
  const [range, setRange] = useState(90);
  const [commodityMode, setCommodityMode] = useState("indexed"); // indexed | raw
  const [group, setGroup] = useState("精选"); // 精选/金属/钢铁/化工/能源/纸
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expanded, setExpanded] = useState({});

  // Trend line visibility (click legend to toggle; Shift+click to solo)
  const [hiddenFx, setHiddenFx] = useState(() => new Set());
  const [hiddenCommodity, setHiddenCommodity] = useState(() => new Set());

  const fxKeys = useMemo(() => ["usdCny", "usdCnyMid", "usdBrl", "brlCny"], []);

  function toggleOne(setter, key) {
    setter((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Shift+click: only show this key; Shift+click again to restore all
  function soloOne(setter, allKeys, key) {
    setter((prev) => {
      const isAlreadySolo = !prev.has(key) && prev.size === Math.max(0, allKeys.length - 1);
      if (isAlreadySolo) return new Set();

      const next = new Set();
      for (const k of allKeys) if (k !== key) next.add(k);
      return next;
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(DATA_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load ${DATA_URL}: ${res.status}`);
        const json = await res.json();
        const rows = Array.isArray(json) ? json : json?.rows;
        if (!Array.isArray(rows)) throw new Error("Invalid trade-data.json format");

        rows.sort((a, b) => String(a.ts ?? a.date).localeCompare(String(b.ts ?? b.date)));
        setData(rows);
      } catch (e) {
        setError(e?.message ?? String(e));
      }
    })();
  }, []);

const sliced = useMemo(() => {
  if (!data.length) return [];
  const sorted = [...data].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  if (range >= 9999) return sorted;
  return sorted.slice(Math.max(0, sorted.length - range));
}, [data, range]);


  const latest = useMemo(() => {
  if (!data.length) return null;
  return data.reduce((best, cur) => {
    if (!best) return cur;
    return new Date(cur.ts) > new Date(best.ts) ? cur : best;
  }, null);
}, [data]);

  // FX series
  const fxRows = useMemo(() => {
    return sliced.map((r) => ({
      x: r.ts ?? r.date,
      usdCny: r?.fx?.usdCny ?? null,
      usdBrl: r?.fx?.usdBrl ?? null,
      brlCny: r?.fx?.brlCny ?? null,
      usdCnyMid: r?.fx?.usdCnyMid ?? null,
    }));
  }, [sliced]);

  // Commodity mapping (new list)
  const commodityMeta = useMemo(() => ([
    { key: "au9999", name: "AU99.99", group: "金属" },
    { key: "ag9999", name: "AG99.99", group: "金属" },
    { key: "copper1", name: "1#电解铜", group: "金属" },
    { key: "alA00", name: "A00铝", group: "金属" },
    { key: "zn0", name: "0#锌", group: "金属" },

    { key: "hrc", name: "热轧卷板", group: "钢铁" },
    { key: "rebar", name: "螺纹钢(HRB400)", group: "钢铁" },
    { key: "ironOre62", name: "铁矿石62%FE", group: "钢铁" },

    { key: "pp", name: "PP(拉丝)", group: "化工" },
    { key: "abs", name: "ABS(通用)", group: "化工" },
    { key: "pvc", name: "PVC(SG-5)", group: "化工" },

    { key: "lithiumCarbonate", name: "碳酸锂", group: "化工" },

    { key: "wti", name: "WTI", group: "能源" },
    { key: "brent", name: "布伦特", group: "能源" },

    { key: "corrugated", name: "瓦楞纸", group: "纸" },
  ]), []);

  const commodityKeys = useMemo(() => commodityMeta.map((x) => x.key), [commodityMeta]);

  const commodityRawRows = useMemo(() => {
    return sliced.map((r) => {
      const row = { x: r.ts ?? r.date };
      for (const m of commodityMeta) row[m.key] = r?.commodities?.[m.key]?.value ?? null;
      return row;
    });
  }, [sliced, commodityMeta]);

  const commodityRows = useMemo(() => {
    if (commodityMode === "raw") return commodityRawRows;
    return indexSeries(commodityRawRows, commodityKeys);
  }, [commodityMode, commodityRawRows, commodityKeys]);

  // group filter for trend lines
  const groupKeys = useMemo(() => {
    if (group === "精选") return ["au9999", "copper1", "alA00", "rebar", "pp", "lithiumCarbonate", "wti"];
    return commodityMeta.filter((m) => m.group === group).map((m) => m.key);
  }, [group, commodityMeta]);

  // Reset commodity hidden lines when switching group (avoid empty chart confusion)
  useEffect(() => {
    setHiddenCommodity(new Set());
  }, [group]);

  // Alerts (>10%) for latest vs previous
  const alerts = useMemo(() => {
    if (!data.length) return [];
    const out = [];

    const fxPairs = [
      { title: "USD/CNY（即时）", curr: latest?.fx?.usdCny, prev: findPrev(data, (r) => r?.fx?.usdCny) },
      { title: "USD/CNY（中间价）", curr: latest?.fx?.usdCnyMid, prev: findPrev(data, (r) => r?.fx?.usdCnyMid) },
      { title: "USD/BRL（即时）", curr: latest?.fx?.usdBrl, prev: findPrev(data, (r) => r?.fx?.usdBrl) },
      { title: "BRL/CNY（即时）", curr: latest?.fx?.brlCny, prev: findPrev(data, (r) => r?.fx?.brlCny) },
    ];

    for (const f of fxPairs) {
      const p = pctChange(f.curr, f.prev);
      if (p !== null && Math.abs(p) >= 10) out.push({ kind: "FX", title: f.title, pct: p });
    }

    for (const m of commodityMeta) {
      const curr = latest?.commodities?.[m.key]?.value ?? null;
      const prev = findPrev(data, (r) => r?.commodities?.[m.key]?.value);
      const p = pctChange(curr, prev);
      if (p !== null && Math.abs(p) >= 10) out.push({ kind: "原材料", title: m.name, pct: p });
    }

    // sort by absolute change
    out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    return out;
  }, [data, latest, commodityMeta]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white text-slate-900">
        <div className="relative min-h-screen">
          <TechBg />
          <div className="relative mx-auto max-w-5xl p-6">
            <GlassCard className="p-5">
              <div className="text-sm font-semibold text-red-700">Load error</div>
              <div className="mt-2 text-sm text-slate-700">{error}</div>
              <div className="mt-3 text-xs text-slate-500">
                请确认 public/trade-data.json 存在，并且能通过 /trade-data.json 访问。
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    );
  }

  const fxPrevUsdCny = findPrev(data, (r) => r?.fx?.usdCny);
  const fxPrevUsdCnyMid = findPrev(data, (r) => r?.fx?.usdCnyMid);
  const fxPrevUsdBrl = findPrev(data, (r) => r?.fx?.usdBrl);
  const fxPrevBrlCny = findPrev(data, (r) => r?.fx?.brlCny);

  function commPrev(key) {
    return findPrev(data, (r) => r?.commodities?.[key]?.value);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white text-slate-900">
      <div className="relative min-h-screen overflow-hidden">
        <TechBg />

        <div className="relative mx-auto max-w-6xl p-6">
          <header className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-3">
                <div className="relative grid h-10 w-10 place-items-center rounded-2xl border border-blue-200 bg-white/70 shadow-[0_0_0_1px_rgba(59,130,246,0.10)]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M4 19V5" stroke="rgba(37,99,235,0.95)" strokeWidth="2" strokeLinecap="round" />
                    <path d="M4 19H20" stroke="rgba(37,99,235,0.95)" strokeWidth="2" strokeLinecap="round" />
                    <path d="M7 15L11 11L14 14L19 8" stroke="rgba(14,165,233,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-semibold tracking-tight">外贸数据看板</div>
                  <div className="mt-1 text-sm text-slate-600">
                    汇率 & 原材料价格（一天 2 次：09:30 / 16:00）
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Pill tone="slate">Latest: {formatTs(latest?.ts ?? latest?.date)}</Pill>
                {latest?.fx?.sources?.spot ? (
                  <Pill tone="blue">
                    即时汇率： <SourceLink href="https://www.xe.com/zh-cn/currencyconverter/">XE</SourceLink>
                  </Pill>
                ) : null}
                {latest?.fx?.sources?.mid ? (
                  <Pill tone="blue">
                    中间价： <SourceLink href="https://www.chinamoney.com.cn/chinese/bkccpr/">Chinamoney</SourceLink>
                  </Pill>
                ) : null}

                {alerts.length ? (
                  <Pill tone="amber">波动提醒：{alerts.length} 项 ≥10%</Pill>
                ) : (
                  <Pill tone="slate">波动提醒：无</Pill>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                className="rounded-full border border-blue-200/80 bg-white/70 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-white"
                onClick={() => setShowHistory(true)}
              >
                历史获取列表
              </button>
              <RangeButtons range={range} setRange={setRange} />
            </div>
          </header>

          {/* FX KPI cards (swap: mid first) */}
          <section className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                title="USD/CNY（中间价）"
                value={formatNumber(latest?.fx?.usdCnyMid, 6)}
                unit=""
                subtitle={latest?.fx?.sources?.mid ? `Source: ${latest.fx.sources.mid}` : "—"}
                href="https://www.chinamoney.com.cn/chinese/bkccpr/"
                alertPct={pctChange(latest?.fx?.usdCnyMid, fxPrevUsdCnyMid)}
              />
              <MetricCard
                title="USD/CNY（即时）"
                value={formatNumber(latest?.fx?.usdCny, 6)}
                unit=""
                subtitle={latest?.fx?.sources?.spot ? `Source: ${latest.fx.sources.spot}` : "—"}
                href="https://www.xe.com/zh-cn/currencyconverter/"
                alertPct={pctChange(latest?.fx?.usdCny, fxPrevUsdCny)}
              />
              <MetricCard
                title="USD/BRL（即时）"
                value={formatNumber(latest?.fx?.usdBrl, 6)}
                unit=""
                subtitle={latest?.fx?.sources?.spot ? `Source: ${latest.fx.sources.spot}` : "—"}
                href="https://www.xe.com/zh-cn/currencyconverter/"
                alertPct={pctChange(latest?.fx?.usdBrl, fxPrevUsdBrl)}
              />
              <MetricCard
                title="BRL/CNY（即时）"
                value={formatNumber(latest?.fx?.brlCny, 6)}
                unit=""
                subtitle="由 XE 即时汇率计算"
                href="https://www.xe.com/zh-cn/currencyconverter/"
                alertPct={pctChange(latest?.fx?.brlCny, fxPrevBrlCny)}
              />
            </div>
          </section>

          {/* FX Trend */}
          <GlassCard className="mt-6 p-4">
            <div>
              <div className="font-semibold">汇率趋势</div>
            </div>

            <div className="mt-4" style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer>
                <LineChart data={fxRows} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="rgba(59,130,246,0.18)" strokeDasharray="3 3" />
                  <XAxis dataKey="x" tick={{ fontSize: 12, fill: "rgba(51,65,85,0.75)" }} minTickGap={32}  tickFormatter={(v) => (typeof v === "string" && v.length > 10 ? formatTs(v).slice(0, 16) : v)} />
                  <YAxis tick={{ fontSize: 12, fill: "rgba(51,65,85,0.75)" }} />
                  <Tooltip content={(props) => <TechTooltip {...props} />} />
                  <Legend
                    content={(props) => (
                      <ClickableLegend
                        {...props}
                        hiddenSet={hiddenFx}
                        onToggle={(k, e) => {
                          if (e?.shiftKey) soloOne(setHiddenFx, fxKeys, k);
                          else toggleOne(setHiddenFx, k);
                        }}
                      />
                    )}
                  />
                  <Line type="monotone" dataKey="usdCny" name="USD/CNY" dot={false} stroke="rgba(37,99,235,0.95)" strokeWidth={2} hide={hiddenFx.has("usdCny")} />
                  <Line type="monotone" dataKey="usdCnyMid" name="USD/CNY 中间价" dot={false} stroke="rgba(14,165,233,0.95)" strokeWidth={2} hide={hiddenFx.has("usdCnyMid")} />
                  <Line type="monotone" dataKey="usdBrl" name="USD/BRL" dot={false} stroke="rgba(99,102,241,0.95)" strokeWidth={2} hide={hiddenFx.has("usdBrl")} />
                  <Line type="monotone" dataKey="brlCny" name="BRL/CNY" dot={false} stroke="rgba(16,185,129,0.95)" strokeWidth={2} hide={hiddenFx.has("brlCny")} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Commodities KPI cards */}
          <section className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {commodityMeta.map((m) => {
                const obj = latest?.commodities?.[m.key];
                const v = obj?.value ?? null;
                const unit = obj?.unit ?? "";
                const href = obj?.source ?? null;
                const p = pctChange(v, commPrev(m.key));
                return (
                  <MetricCard
                    key={m.key}
                    title={m.name}
                    value={formatNumber(v, 2)}
                    unit={unit}
                    subtitle={m.group}
                    href={href}
                    alertPct={p}
                  />
                );
              })}
            </div>
          </section>

          {/* Commodity Trend */}
          <GlassCard className="mt-6 p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-semibold">原材料趋势</div>
                <div className="text-xs text-slate-600">
                  {commodityMode === "indexed" ? "指数化对比（Base=100）" : "原始价格（单位不一致，建议用指数模式看趋势）"}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <TogglePill active={commodityMode === "indexed"} onClick={() => setCommodityMode("indexed")}>指数</TogglePill>
                <TogglePill active={commodityMode === "raw"} onClick={() => setCommodityMode("raw")}>原始</TogglePill>

                <span className="mx-2 h-6 w-px bg-blue-200/80" />

                {["精选", "金属", "钢铁", "化工", "能源", "纸"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroup(g)}
                    className={
                      "rounded-full border px-3 py-1.5 text-sm " +
                      (group === g
                        ? "border-blue-400 bg-blue-600 text-white"
                        : "border-blue-200/80 bg-white/70 text-slate-700 hover:bg-white")
                    }
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4" style={{ width: "100%", height: 420 }}>
              <ResponsiveContainer>
                <LineChart data={commodityRows} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="rgba(59,130,246,0.18)" strokeDasharray="3 3" />
                  <XAxis dataKey="x" tick={{ fontSize: 12, fill: "rgba(51,65,85,0.75)" }} minTickGap={32}  tickFormatter={(v) => (typeof v === "string" && v.length > 10 ? formatTs(v).slice(0, 16) : v)} />
                  <YAxis tick={{ fontSize: 12, fill: "rgba(51,65,85,0.75)" }} />
                  <Tooltip content={(props) => <TechTooltip {...props} />} />
                  <Legend
                    content={(props) => (
                      <ClickableLegend
                        {...props}
                        hiddenSet={hiddenCommodity}
                        onToggle={(k, e) => {
                          if (e?.shiftKey) soloOne(setHiddenCommodity, groupKeys, k);
                          else toggleOne(setHiddenCommodity, k);
                        }}
                      />
                    )}
                  />
                  {groupKeys.map((k, i) => {
                    const meta = commodityMeta.find((m) => m.key === k);
                    return (
                      <Line
                        key={k}
                        type="monotone"
                        dataKey={k}
                        name={meta?.name ?? k}
                        dot={false}
                        strokeWidth={2}
                        stroke={LINE_PALETTE[i % LINE_PALETTE.length]}
                        hide={hiddenCommodity.has(k)}
                      />
                    );
                  })}
</LineChart>
              </ResponsiveContainer>
            </div>

            {alerts.length ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="font-semibold">波动提醒（≥10%）</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {alerts.slice(0, 6).map((a, idx) => (
                    <div key={idx} className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2">
                      <div className="text-xs text-amber-800">{a.kind}</div>
                      <div className="mt-0.5 flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-slate-900">{a.title}</div>
                        <div className="font-semibold">{formatPct(a.pct, 1)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {alerts.length > 6 ? <div className="mt-2 text-xs text-amber-800/80">仅展示前 6 项（按波动幅度排序）</div> : null}
              </div>
            ) : null}
          </GlassCard>

          <footer className="mt-10 text-xs text-slate-600">
            <div className="rounded-2xl border border-blue-200/80 bg-white/70 px-4 py-3 backdrop-blur">
              本项目为个人工作便利整理，力求准确，如有错漏，欢迎指正。<br /><br />本人任巴西商超中国办事处，深耕北美、拉美市场，欢迎五金建材、手电动工具、家居、厨卫、灯具等品类供应链资源。联系请发邮件至：lary.zhang@outlook.com
            </div>
          </footer>
        </div>

        {/* History Modal */}
        <Modal open={showHistory} onClose={() => setShowHistory(false)} title="历史数据获取列表">
          <div className="text-xs text-slate-600">
            数据来自 public/trade-data.json（每次抓取一条记录）。点击“查看”可展开该次抓取的原始 JSON（只读）。
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-blue-200/80">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">时间</th>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                  <th className="px-3 py-2 text-left font-medium">错误</th>
                  <th className="px-3 py-2 text-left font-medium">详情</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.slice().reverse().slice(0, 100).map((r, idx) => {
                  const detailErr = r?.errors?.commoditiesDetailed ? Object.keys(r.errors.commoditiesDetailed).length : 0;
                  const hasErr =
                    (r?.errors && (r.errors.fxSpot || r.errors.usdCnyMid || r.errors.commodities)) ||
                    detailErr > 0;

                  const status = hasErr ? "部分失败" : "成功";

                  const majorErrs = [r?.errors?.fxSpot, r?.errors?.usdCnyMid, r?.errors?.commodities]
                    .filter(Boolean)
                    .join(" | ");

                  const errText =
                    (majorErrs ? majorErrs : "—") +
                    (detailErr > 0 ? `  ·  缺失/解析失败：${detailErr} 项` : "");

                  const key = r.ts ?? r.date ?? String(idx);
                  const open = !!expanded[key];

                  return (
                    <React.Fragment key={key}>
                      <tr className="border-t border-blue-100">
                        <td className="px-3 py-2 text-slate-900">{formatTs(r.ts ?? r.date)}</td>
                        <td className="px-3 py-2">
                          <Pill tone={hasErr ? "amber" : "blue"}>{status}</Pill>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">{errText}</td>
                        <td className="px-3 py-2">
                          <button
                            className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-blue-50"
                            onClick={() =>
                              setExpanded((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                          >
                            {open ? "收起" : "展开"}
                          </button>
                        </td>
                      </tr>

                      {open ? (
                        <tr className="border-t border-blue-100">
                          <td colSpan={4} className="px-3 py-3">
                            <div className="rounded-2xl border border-blue-200/80 bg-slate-50/70 p-3">
                              <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words text-xs text-slate-800">
{JSON.stringify(r, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            默认展示最近 100 条；如果你要按日期筛选/搜索，我可以再加一个搜索框。
          </div>
        </Modal>
      </div>
    </div>
  );
}