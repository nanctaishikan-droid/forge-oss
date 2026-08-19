// 毎日の自動生成の常駐プロセス。
//   node scripts/scheduler.mjs
// 1分ごとに設定を確認し、指定時刻になったら count 曲を生成キューに投入する。
// Next.js の /api/music-studio/* を叩くだけなので、生成ロジックはアプリと共通。

const BASE = process.env.MS_BASE || "http://127.0.0.1:3939";

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function hhmm() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function getSchedule() {
  const r = await fetch(`${BASE}/api/music-studio/schedule`, { cache: "no-store" });
  if (!r.ok) throw new Error(`schedule取得失敗 ${r.status}`);
  return (await r.json()).schedule;
}
async function putSchedule(patch) {
  await fetch(`${BASE}/api/music-studio/schedule`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
async function generate(presetId, tags) {
  const r = await fetch(`${BASE}/api/music-studio/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ presetId, description: tags || undefined, auto: true }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "生成失敗");
  return d.job;
}

async function tick() {
  let s;
  try {
    s = await getSchedule();
  } catch (e) {
    console.error(`[${hhmm()}] ${e}`);
    return;
  }
  if (!s.enabled) return;
  if (s.time !== hhmm()) return;
  if (s.lastRunDate === today()) return; // 今日は実行済み

  console.log(`[${hhmm()}] 自動生成 開始: ${s.presetId} × ${s.count}曲`);
  await putSchedule({ lastRunDate: today() });
  for (let i = 0; i < s.count; i++) {
    try {
      const job = await generate(s.presetId, s.tags);
      console.log(`  投入 ${i + 1}/${s.count}: ${job.id}`);
    } catch (e) {
      console.error(`  失敗 ${i + 1}/${s.count}: ${e}`);
    }
    // ComfyUIを詰まらせないよう少し間隔をあける
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(`[${hhmm()}] 自動生成 投入完了`);
}

console.log(`Music Studio scheduler 起動 (base=${BASE})。毎分チェックします。`);
tick();
setInterval(tick, 60 * 1000);
