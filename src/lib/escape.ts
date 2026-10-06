export type NodeType = "room" | "junction" | "exit";
export interface BNode { id: string; label: string; type: NodeType; x: number; y: number }
export interface BEdge { id: string; from: string; to: string; cost: number }
export interface HazardState { blocked_nodes: string[]; blocked_edges: string[]; closed_exits: string[] }
export interface Building { building: string; nodes: BNode[]; edges: BEdge[]; initial_state: HazardState }

export const SAMPLE: Building = {
  building: "Sample Academic Block",
  nodes: [
    { id: "R1", label: "Room 1", type: "room", x: 80, y: 120 },
    { id: "R2", label: "Room 2", type: "room", x: 80, y: 340 },
    { id: "C1", label: "Junction 1", type: "junction", x: 260, y: 120 },
    { id: "C2", label: "Junction 2", type: "junction", x: 460, y: 120 },
    { id: "C3", label: "Junction 3", type: "junction", x: 260, y: 340 },
    { id: "C4", label: "Junction 4", type: "junction", x: 460, y: 340 },
    { id: "E1", label: "Exit 1", type: "exit", x: 640, y: 120 },
    { id: "E2", label: "Exit 2", type: "exit", x: 640, y: 340 },
  ],
  edges: [
    { id: "e1", from: "R1", to: "C1", cost: 2 },
    { id: "e2", from: "C1", to: "C2", cost: 2 },
    { id: "e3", from: "C2", to: "E1", cost: 3 },
    { id: "e4", from: "C1", to: "C3", cost: 3 },
    { id: "e5", from: "R2", to: "C3", cost: 1 },
    { id: "e6", from: "C3", to: "C4", cost: 2 },
    { id: "e7", from: "C4", to: "E2", cost: 4 },
  ],
  initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] },
};

const isStr = (v: unknown) => typeof v === "string" && v.trim().length > 0;

export function validate(raw: unknown): { ok: true; data: Building } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!raw || typeof raw !== "object") return fail("Root must be an object");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = raw as any;
  if (!isStr(b.building)) return fail("building must be a non-empty string");
  if (!Array.isArray(b.nodes) || b.nodes.length < 2 || b.nodes.length > 60) return fail("nodes must have 2–60 items");
  if (!Array.isArray(b.edges) || b.edges.length < 1 || b.edges.length > 150) return fail("edges must have 1–150 items");
  const nodes = new Map<string, BNode>();
  for (const n of b.nodes as any[]) {
    if (!n || !isStr(n.id) || !isStr(n.label)) return fail("Each node needs id and label");
    if (!["room", "junction", "exit"].includes(n.type as string)) return fail(`Node ${n.id}: invalid type`);
    if (typeof n.x !== "number" || typeof n.y !== "number" || !isFinite(n.x) || !isFinite(n.y)) return fail(`Node ${n.id}: x/y must be numbers`);
    if (nodes.has(n.id as string)) return fail(`Duplicate node id ${n.id}`);
    nodes.set(n.id as string, n as unknown as BNode);
  }
  const types = [...nodes.values()].map((n) => n.type);
  if (!types.includes("exit") || !types.some((t) => t !== "exit")) return fail("Need at least one exit and one room/junction");
  const eids = new Set<string>(); const pairs = new Set<string>();
  for (const e of b.edges as any[]) {
    if (!e || !isStr(e.id)) return fail("Each edge needs an id");
    if (eids.has(e.id as string)) return fail(`Duplicate edge id ${e.id}`);
    if (!nodes.has(e.from as string) || !nodes.has(e.to as string)) return fail(`Edge ${e.id}: unknown node`);
    if (e.from === e.to) return fail(`Edge ${e.id}: self-loop`);
    if (!Number.isInteger(e.cost) || (e.cost as number) <= 0) return fail(`Edge ${e.id}: cost must be a positive integer`);
    const key = [e.from, e.to].sort().join("|");
    if (pairs.has(key)) return fail(`Edge ${e.id}: repeated node pair`);
    pairs.add(key); eids.add(e.id as string);
  }
  const s = b.initial_state as any;
  if (!s || typeof s !== "object") return fail("initial_state missing");
  for (const k of ["blocked_nodes", "blocked_edges", "closed_exits"]) {
    if (!Array.isArray(s[k])) return fail(`initial_state.${k} must be an array`);
  }
  for (const id of s.blocked_nodes as string[]) {
    const n = nodes.get(id); if (!n || n.type === "exit") return fail(`blocked_nodes: invalid ${id}`);
  }
  for (const id of s.blocked_edges as string[]) if (!eids.has(id)) return fail(`blocked_edges: invalid ${id}`);
  for (const id of s.closed_exits as string[]) {
    const n = nodes.get(id); if (!n || n.type !== "exit") return fail(`closed_exits: invalid ${id}`);
  }
  return { ok: true, data: b as unknown as Building };
}

const cmpSeq = (a: string[], b: string[]) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
  }
  return a.length - b.length;
};

export type RouteResult =
  | { kind: "none-selected" } | { kind: "start-blocked" } | { kind: "no-route" }
  | { kind: "ok"; path: string[]; edges: string[]; cost: number; exit: string };

export function findRoute(b: Building, start: string | null, st: HazardState): RouteResult {
  if (!start) return { kind: "none-selected" };
  if (st.blocked_nodes.includes(start)) return { kind: "start-blocked" };
  const bn = new Set(st.blocked_nodes), be = new Set(st.blocked_edges), ce = new Set(st.closed_exits);
  const type = new Map(b.nodes.map((n) => [n.id, n.type]));
  const adj = new Map<string, { to: string; cost: number; id: string }[]>();
  for (const e of b.edges) {
    if (be.has(e.id) || bn.has(e.from) || bn.has(e.to) || ce.has(e.from) || ce.has(e.to)) continue;
    (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push({ to: e.to, cost: e.cost, id: e.id });
    (adj.get(e.to) ?? adj.set(e.to, []).get(e.to)!).push({ to: e.from, cost: e.cost, id: e.id });
  }
  const best = new Map<string, { cost: number; path: string[]; edges: string[] }>();
  best.set(start, { cost: 0, path: [start], edges: [] });
  const done = new Set<string>();
  while (true) {
    let cur: string | null = null;
    for (const [id, l] of best) {
      if (done.has(id)) continue;
      const c = cur ? best.get(cur)! : null;
      if (!c || l.cost < c.cost || (l.cost === c.cost && cmpSeq(l.path, c.path) < 0)) cur = id;
    }
    if (!cur) break;
    done.add(cur);
    const l = best.get(cur)!;
    if (type.get(cur) === "exit" && cur !== start) continue; // exits are destinations
    for (const nb of adj.get(cur) ?? []) {
      if (done.has(nb.to)) continue;
      const cand = { cost: l.cost + nb.cost, path: [...l.path, nb.to], edges: [...l.edges, nb.id] };
      const ex = best.get(nb.to);
      if (!ex || cand.cost < ex.cost || (cand.cost === ex.cost && cmpSeq(cand.path, ex.path) < 0)) best.set(nb.to, cand);
    }
  }
  let pick: { id: string; cost: number; path: string[]; edges: string[] } | null = null;
  for (const n of b.nodes) {
    if (n.type !== "exit" || ce.has(n.id)) continue;
    const l = best.get(n.id); if (!l) continue;
    if (!pick || l.cost < pick.cost || (l.cost === pick.cost && n.id < pick.id)) pick = { id: n.id, ...l };
  }
  if (!pick) return { kind: "no-route" };
  return { kind: "ok", path: pick.path, edges: pick.edges, cost: pick.cost, exit: pick.id };
}
