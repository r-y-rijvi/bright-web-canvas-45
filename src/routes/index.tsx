import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { SAMPLE, validate, findRoute, type Building, type HazardState } from "@/lib/escape";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Escape — Evacuation Route Simulator" },
      { name: "description", content: "Interactive building map that finds the lowest-cost evacuation route and reroutes around hazards." },
      { property: "og:title", content: "Smart Escape — Evacuation Route Simulator" },
      { property: "og:description", content: "Block corridors, close exits and watch the safest route update instantly." },
    ],
  }),
  component: Index,
});

type Lang = "en" | "bn";
const T = {
  en: {
    tag: "Interactive Evacuation Route Simulator", import: "Import JSON", sample: "Load sample", reset: "Reset",
    modeLabel: "Click on map to", select: "Select start", hazard: "Toggle hazard",
    instr: "Choose a mode, then click nodes or corridor costs on the map. Blocking rooms/junctions, blocking corridors and closing exits update the route instantly.",
    route: "Route", cost: "Total cost", exit: "Exit", none: "Select a start room or junction", noRoute: "No route available",
    startBlocked: "Starting location blocked", hazards: "Active hazards", noHazards: "No hazards", invalid: "Invalid file",
    room: "Room", junction: "Junction", exitT: "Exit", blocked: "Blocked", closed: "Closed", startT: "Start",
    disclaimer: "Educational simulation — not a certified evacuation planning tool.",
  },
  bn: {
    tag: "ইন্টারঅ্যাকটিভ জরুরি নির্গমন পথ সিমুলেটর", import: "JSON আমদানি", sample: "নমুনা লোড", reset: "রিসেট",
    modeLabel: "ম্যাপে ক্লিক করে", select: "শুরু নির্বাচন", hazard: "বিপদ পরিবর্তন",
    instr: "একটি মোড বেছে নিন, তারপর ম্যাপের নোড বা করিডোর খরচে ক্লিক করুন। কক্ষ/সংযোগস্থল বা করিডোর বন্ধ এবং নির্গমন পথ বন্ধ করলে সাথে সাথে পথ হালনাগাদ হয়।",
    route: "পথ", cost: "মোট খরচ", exit: "নির্গমন", none: "একটি শুরুর কক্ষ বা সংযোগস্থল নির্বাচন করুন", noRoute: "কোনো পথ নেই",
    startBlocked: "শুরুর স্থান অবরুদ্ধ", hazards: "সক্রিয় বিপদ", noHazards: "কোনো বিপদ নেই", invalid: "অবৈধ ফাইল",
    room: "কক্ষ", junction: "সংযোগস্থল", exitT: "নির্গমন", blocked: "অবরুদ্ধ", closed: "বন্ধ", startT: "শুরু",
    disclaimer: "শিক্ষামূলক সিমুলেশন — প্রত্যয়িত নির্গমন পরিকল্পনা টুল নয়।",
  },
};

const clone = (s: HazardState): HazardState => ({
  blocked_nodes: [...s.blocked_nodes], blocked_edges: [...s.blocked_edges], closed_exits: [...s.closed_exits],
});
const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

function Index() {
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];
  const [b, setB] = useState<Building>(SAMPLE);
  const [st, setSt] = useState<HazardState>(clone(SAMPLE.initial_state));
  const [start, setStart] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "hazard">("select");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => findRoute(b, start, st), [b, start, st]);
  const nodeMap = useMemo(() => new Map(b.nodes.map((n) => [n.id, n])), [b]);
  const routeNodes = new Set(result.kind === "ok" ? result.path : []);
  const routeEdges = new Set(result.kind === "ok" ? result.edges : []);

  const load = (data: Building) => { setB(data); setSt(clone(data.initial_state)); setStart(null); setErr(null); };
  const onFile = async (f: File) => {
    try {
      const v = validate(JSON.parse(await f.text()));
      if (v.ok) load(v.data); else setErr(v.error);
    } catch { setErr("JSON parse error"); }
  };

  const clickNode = (id: string) => {
    const n = nodeMap.get(id)!;
    if (mode === "select") { if (n.type !== "exit" && !st.blocked_nodes.includes(id)) setStart(id); return; }
    if (n.type === "exit") setSt({ ...st, closed_exits: toggle(st.closed_exits, id) });
    else setSt({ ...st, blocked_nodes: toggle(st.blocked_nodes, id) });
  };
  const clickEdge = (id: string) => setSt({ ...st, blocked_edges: toggle(st.blocked_edges, id) });

  const xs = b.nodes.map((n) => n.x), ys = b.nodes.map((n) => n.y);
  const pad = 60;
  const vb = `${Math.min(...xs) - pad} ${Math.min(...ys) - pad} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...ys) - Math.min(...ys) + pad * 2}`;

  const hazards = [
    ...st.blocked_nodes.map((id) => `${id} · ${t.blocked}`),
    ...st.blocked_edges.map((id) => `${id} · ${t.blocked}`),
    ...st.closed_exits.map((id) => `${id} · ${t.closed}`),
  ];

  return (
    <div className="min-h-screen bg-background bg-grid font-sans text-foreground">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">⇢</div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Smart Escape</h1>
            <p className="text-sm text-muted-foreground">{t.tag}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          {(["en", "bn"] as Lang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {l === "en" ? "English" : "বাংলা"}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 pb-12 lg:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card/70 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="font-display font-semibold">{b.building}</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t.modeLabel}</span>
              {(["select", "hazard"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`rounded-lg px-3 py-1.5 font-medium transition ${mode === m ? (m === "select" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground") : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
                  {m === "select" ? t.select : t.hazard}
                </button>
              ))}
            </div>
          </div>
          <svg viewBox={vb} className="h-[520px] w-full select-none">
            {b.edges.map((e) => {
              const a = nodeMap.get(e.from)!, c = nodeMap.get(e.to)!;
              const blocked = st.blocked_edges.includes(e.id);
              const dead = blocked || st.blocked_nodes.includes(e.from) || st.blocked_nodes.includes(e.to);
              const onRoute = routeEdges.has(e.id);
              const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
              return (
                <g key={e.id} className="cursor-pointer" onClick={() => clickEdge(e.id)}>
                  <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} stroke="transparent" strokeWidth={18} />
                  <line x1={a.x} y1={a.y} x2={c.x} y2={c.y}
                    className={onRoute ? "stroke-primary route-flow" : blocked ? "stroke-destructive" : "stroke-junction"}
                    strokeWidth={onRoute ? 5 : 2.5} strokeDasharray={blocked ? "6 6" : undefined} opacity={dead && !blocked ? 0.3 : 1} />
                  <rect x={mx - 16} y={my - 12} width={32} height={24} rx={6}
                    className={blocked ? "fill-destructive" : onRoute ? "fill-primary" : "fill-secondary"} />
                  <text x={mx} y={my + 4} textAnchor="middle" fontSize={12}
                    className={`font-mono ${blocked ? "fill-destructive-foreground" : onRoute ? "fill-primary-foreground" : "fill-foreground"}`}>
                    {blocked ? "✕" : e.cost}
                  </text>
                </g>
              );
            })}
            {b.nodes.map((n) => {
              const blocked = st.blocked_nodes.includes(n.id) || st.closed_exits.includes(n.id);
              const isStart = n.id === start;
              const fill = blocked ? "fill-destructive" : n.type === "exit" ? "fill-exit" : n.type === "room" ? "fill-room" : "fill-junction";
              return (
                <g key={n.id} className="cursor-pointer" onClick={() => clickNode(n.id)}>
                  {(routeNodes.has(n.id) || isStart) && (
                    <circle cx={n.x} cy={n.y} r={30} className={isStart ? "fill-accent/30" : "fill-primary/20"} />
                  )}
                  {n.type === "room" ? (
                    <rect x={n.x - 20} y={n.y - 20} width={40} height={40} rx={8} className={`${fill} ${isStart ? "stroke-accent" : "stroke-background"}`} strokeWidth={3} />
                  ) : n.type === "exit" ? (
                    <polygon points={`${n.x},${n.y - 24} ${n.x + 24},${n.y} ${n.x},${n.y + 24} ${n.x - 24},${n.y}`} className={`${fill} stroke-background`} strokeWidth={3} />
                  ) : (
                    <circle cx={n.x} cy={n.y} r={16} className={`${fill} ${isStart ? "stroke-accent" : "stroke-background"}`} strokeWidth={3} />
                  )}
                  <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={12} fontWeight={700} className="fill-background font-display">{n.id}</text>
                  <text x={n.x} y={n.y + 42} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
                    {n.label}{blocked ? ` · ${n.type === "exit" ? t.closed : t.blocked}` : ""}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="flex flex-wrap gap-4 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <Legend shape="rounded-sm bg-room" label={t.room} />
            <Legend shape="rounded-full bg-junction" label={t.junction} />
            <Legend shape="rotate-45 bg-exit" label={t.exitT} />
            <Legend shape="rounded-full bg-accent" label={t.startT} />
            <Legend shape="rounded-sm bg-destructive" label={`${t.blocked} / ${t.closed}`} />
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">{t.import}</button>
              <button onClick={() => load(SAMPLE)} className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted">{t.sample}</button>
              <button onClick={() => setSt(clone(b.initial_state))} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary">{t.reset}</button>
            </div>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            {err && <p className="mt-3 rounded-lg bg-destructive/15 px-3 py-2 text-sm text-destructive">{t.invalid}: {err}</p>}
          </div>

          <div className={`rounded-2xl border p-5 ${result.kind === "ok" ? "border-primary/40 bg-primary/10" : result.kind === "none-selected" ? "border-border bg-card" : "border-destructive/40 bg-destructive/10"}`}>
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t.route}</div>
            {result.kind === "ok" ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {result.path.map((id, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <span className="rounded-md bg-card px-2 py-1 font-mono text-sm">{id}</span>
                      {i < result.path.length - 1 && <span className="text-primary">→</span>}
                    </span>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div><div className="text-xs text-muted-foreground">{t.cost}</div><div className="font-display text-3xl font-bold text-primary">{result.cost}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t.exit}</div><div className="font-display text-3xl font-bold">{result.exit}</div></div>
                </div>
              </>
            ) : (
              <p className={`mt-3 font-display text-xl font-bold ${result.kind === "none-selected" ? "text-muted-foreground" : "text-destructive"}`}>
                {result.kind === "none-selected" ? t.none : result.kind === "no-route" ? t.noRoute : t.startBlocked}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t.hazards}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {hazards.length ? hazards.map((h) => (
                <span key={h} className="rounded-full bg-destructive/15 px-3 py-1 font-mono text-xs text-destructive">{h}</span>
              )) : <span className="text-sm text-muted-foreground">{t.noHazards}</span>}
            </div>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">{t.instr}</p>
          <p className="text-xs text-muted-foreground/70">{t.disclaimer}</p>
        </aside>
      </main>
    </div>
  );
}

function Legend({ shape, label }: { shape: string; label: string }) {
  return <span className="flex items-center gap-2"><span className={`h-3 w-3 ${shape}`} />{label}</span>;
}
