import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 按你项目实际位置：public/trade-data.json
const OUT_PATH = path.resolve(__dirname, "../public/trade-data.json");

function parseTs(ts) {
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

function getDateHour(ts) {
  // ts 本身是 +08:00 或 YYYY-MM-DD...，直接取字符串即可
  const date = String(ts).slice(0, 10);
  const hh = Number(String(ts).slice(11, 13));
  return { date, hour: Number.isFinite(hh) ? hh : 0 };
}

function slotKey(ts) {
  const { date, hour } = getDateHour(ts);
  const slot = hour < 13 ? "09:30" : "16:00";
  return `${date}|${slot}`;
}

function normalizeSlotTs(key) {
  const [date, slot] = key.split("|");
  return `${date}T${slot}:00+08:00`;
}

function readRows() {
  if (!fs.existsSync(OUT_PATH)) return [];
  const json = JSON.parse(fs.readFileSync(OUT_PATH, "utf-8"));
  return Array.isArray(json) ? json : [];
}

function writeRows(rows) {
  fs.writeFileSync(OUT_PATH, JSON.stringify(rows, null, 2) + "\n", "utf-8");
}

const rows = readRows();

// 以“同槽位保留最新一条”为准（按 ts 或 runTs）
const bestBySlot = new Map();

for (const r of rows) {
  const ts = r.ts ?? r.date;
  if (!ts) continue;

  const key = slotKey(ts);
  const cur = bestBySlot.get(key);

  const curMs = parseTs(cur?.runTs ?? cur?.ts ?? "");
  const newMs = parseTs(r.runTs ?? r.ts ?? "");

  // 保留“更新的一条”：优先 runTs，其次 ts
  if (!cur || (newMs !== null && (curMs === null || newMs >= curMs))) {
    bestBySlot.set(key, r);
  }
}

const cleaned = Array.from(bestBySlot.entries())
  .map(([key, r]) => {
    // 把 ts 统一规范到槽位（可选，但强烈建议）
    const ts = normalizeSlotTs(key);
    return { ...r, ts };
  })
  .sort((a, b) => String(a.ts ?? "").localeCompare(String(b.ts ?? "")));

console.log(`Before: ${rows.length}, After: ${cleaned.length}`);
writeRows(cleaned);
console.log("Cleaned and wrote:", OUT_PATH);
