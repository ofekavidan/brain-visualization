export type Level = "mature" | "precursor";

export type BactmanReference = {
  version: string;
  description: string;
  background_mean_cpm: Record<string, number>;
  markers: Record<string, string[]>;
  example_lists: Record<string, string>;
};

export const CELL_TYPES = [
  "Neurons",
  "Astrocytes",
  "Microglia",
  "Oligodendrocytes",
] as const;

export const LIST_COLOURS = ["#FF3B30", "#3D10F0", "#00A087", "#F39B00", "#7E57C2", "#795548"];
export const BLOCK_COLOURS = ["#F7E6E5", "#E8EEF7", "#E6F2EE", "#FBF0DE", "#EFEAF6", "#EFEBE9"];

export const ALPHA = 0.05;
export const LOGP_MAX = 8;

const CANONICAL_ARM: Record<string, string> = {
  "hsa-miR-126": "hsa-miR-126-3p",
  "hsa-miR-221": "hsa-miR-221-3p",
  "hsa-miR-744": "hsa-miR-744-5p",
  "hsa-miR-145": "hsa-miR-145-5p",
  "hsa-miR-16": "hsa-miR-16-5p",
  "hsa-miR-7": "hsa-miR-7-5p",
  "hsa-miR-487a": "hsa-miR-487a-3p",
  "hsa-miR-548d": "hsa-miR-548d-3p",
};

const LEGACY: Record<string, string> = {
  "hsa-miR-213": "hsa-miR-181a",
  "hsa-miR-219": "hsa-miR-219a",
  "hsa-miR-219-2-3p": "hsa-miR-219a-2-3p",
  "hsa-miR-190": "hsa-miR-190a",
  "hsa-miR-320": "hsa-miR-320a",
  "hsa-miR-151": "hsa-miR-151a",
};

export type EnrichmentRow = {
  list: string;
  cellType: string;
  markersInList: number;
  markersK: number;
  pctOverlap: number;
  oddsRatio: number;
  haldane: number;
  pValue: number;
  pAdj: number;
  log10Padj: number;
  enriched: boolean;
  overlap: string[];
};

export type MatchRow = {
  list: string;
  reported: string;
  matched: string;
  rule: string;
  markerOf: string[];
};

export type EnrichmentResult = {
  level: Level;
  alpha: number;
  lists: string[];
  table: EnrichmentRow[];
  matching: MatchRow[];
  matched: Record<string, Record<string, string[]>>;
  enriched: Record<string, string[]>;
  summary: Record<string, { reported: number; matched: number }>;
  backgroundN: number;
  markerCounts: Record<string, number>;
};

type ResolvedRef = {
  background: Set<string>;
  cpm: Record<string, number>;
  markers: Record<string, Set<string>>;
  level: Level;
};

function logFactorial(n: number) {
  let s = 0;
  for (let k = 2; k <= n; k++) s += Math.log(k);
  return s;
}

function logChoose(n: number, k: number) {
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

function fisherGreater(a: number, b: number, c: number, d: number) {
  const N = a + b + c + d;
  const K = a + c;
  const n = a + b;
  const xMax = Math.min(n, K);
  let p = 0;
  for (let x = a; x <= xMax; x++) {
    const logp = logChoose(K, x) + logChoose(N - K, n - x) - logChoose(N, n);
    p += Math.exp(logp);
  }
  const clipped = Math.min(1, Math.max(0, p));
  return clipped > 1 - 1e-9 ? 1 : clipped;
}

function bh(pvals: number[]) {
  const n = pvals.length;
  const order = pvals
    .map((p, i) => [p, i] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const adjSorted = new Array<number>(n);
  let running = 1;
  for (let rank = n; rank >= 1; rank--) {
    running = Math.min(running, (order[rank - 1][0] * n) / rank);
    adjSorted[rank - 1] = Math.min(1, Math.max(0, running));
  }
  const adj = new Array<number>(n);
  order.forEach(([, i], sortedIdx) => {
    adj[i] = adjSorted[sortedIdx];
  });
  return adj;
}

export function toPrecursor(mir: string) {
  return mir.endsWith("-5p") || mir.endsWith("-3p") ? mir.slice(0, -3) : mir;
}

export function family(mir: string) {
  const stripped = toPrecursor(mir.replace(/^hsa-/, ""));
  const hit = /^((?:miR|let)-\d+[a-z]?)-\d+$/.exec(stripped);
  return hit ? hit[1] : stripped;
}

export function arm(mir: string) {
  const bare = mir.replace(/^hsa-/, "");
  return bare.slice(family(mir).length).replace(/^-/, "");
}

function clean(name: string) {
  return name
    .replace(/[‐‑‒–—−]/g, "-")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace("hsa-mir-", "hsa-miR-")
    .replace("mmu-mir-", "mmu-miR-");
}

export function parseList(text: string) {
  const names: string[] = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.split("#")[0];
    for (const token of line.split(/[,;\t ]+/)) {
      if (!/(mir|let)-?\d/i.test(token)) continue;
      names.push(clean(token));
    }
  }
  return [...new Map(names.map((n) => [n, n])).values()];
}

function resolveReference(reference: BactmanReference, level: Level): ResolvedRef {
  const cpm = { ...reference.background_mean_cpm };
  const markers: Record<string, Set<string>> = {};
  for (const ct of CELL_TYPES) markers[ct] = new Set(reference.markers[ct] ?? []);
  if (level === "mature") {
    return { background: new Set(Object.keys(cpm)), cpm, markers, level };
  }
  const preCpm: Record<string, number> = {};
  for (const [mir, value] of Object.entries(cpm)) {
    const p = toPrecursor(mir);
    preCpm[p] = (preCpm[p] ?? 0) + value;
  }
  const preMarkers: Record<string, Set<string>> = {};
  for (const ct of CELL_TYPES) {
    preMarkers[ct] = new Set([...markers[ct]].map(toPrecursor));
  }
  return {
    background: new Set(Object.keys(preCpm)),
    cpm: preCpm,
    markers: preMarkers,
    level,
  };
}

function matchName(name: string, mature: ResolvedRef, mapMouse = true): [string | null, string] {
  const bg = mature.background;
  const cpm = mature.cpm;
  let n = clean(name);
  n = n.replace(/^(hsa|mmu)-mir-/i, (_, species: string) => `${species}-miR-`);
  n = n.replace(/^mir-/i, "miR-");
  if (n.startsWith("mmu-")) {
    if (!mapMouse) return [null, "mouse name (not mapped)"];
    n = "hsa-" + n.slice(4);
  }
  if (!n.startsWith("hsa-")) n = "hsa-" + n;
  if (bg.has(n)) return [n, "exact"];

  const rule: string[] = [];
  if (LEGACY[n]) {
    n = LEGACY[n];
    rule.push("legacy name");
    if (bg.has(n)) return [n, rule.join(" + ")];
  }
  if (CANONICAL_ARM[n]) {
    if (bg.has(CANONICAL_ARM[n])) {
      return [CANONICAL_ARM[n], [...rule, "canonical arm (miRBase)"].join(" + ")];
    }
    return [null, `canonical arm (${CANONICAL_ARM[n]}) not in BACTMan`];
  }
  if (!n.endsWith("-5p") && !n.endsWith("-3p")) {
    const arms = [`${n}-5p`, `${n}-3p`].filter((a) => bg.has(a));
    if (arms.length === 1) return [arms[0], [...rule, "arm added"].join(" + ")];
    if (arms.length === 2) {
      const best = arms.slice().sort((a, b) => (cpm[b] ?? 0) - (cpm[a] ?? 0))[0];
      return [best, [...rule, `both arms in BACTMan: dominant arm (${best.slice(-2)})`].join(" + ")];
    }
  }
  return [null, "not in BACTMan"];
}

function matchLevel(
  reported: string,
  mature: ResolvedRef,
  ref: ResolvedRef,
  level: Level,
  mapMouse = true
): [string | null, string] {
  const [hit, rule] = matchName(reported, mature, mapMouse);
  if (level === "precursor") {
    if (hit) return [toPrecursor(hit), rule];
    let n = clean(reported);
    if (n.startsWith("mmu-") && mapMouse) n = "hsa-" + n.slice(4);
    if (!n.startsWith("hsa-")) n = "hsa-" + n;
    const mapped = LEGACY[n] ?? n;
    const precursor = toPrecursor(LEGACY[toPrecursor(mapped)] ?? toPrecursor(mapped));
    if (ref.background.has(precursor)) return [precursor, "precursor in BACTMan"];
  }
  return [hit, rule];
}

export function runEnrichment(
  reference: BactmanReference,
  lists: Array<{ label: string; text: string }>,
  level: Level = "mature"
): EnrichmentResult {
  const mature = resolveReference(reference, "mature");
  const ref = resolveReference(reference, level);
  const used = new Set<string>();
  const parsed: Array<{ label: string; names: string[] }> = [];
  lists.forEach((item, i) => {
    const names = parseList(item.text);
    if (!names.length && !item.text.trim()) return;
    let label = item.label.trim() || `List ${i + 1}`;
    while (used.has(label)) label = `${label} (${i + 1})`;
    used.add(label);
    parsed.push({ label, names });
  });

  const table: EnrichmentRow[] = [];
  const matching: MatchRow[] = [];
  const matched: Record<string, Record<string, string[]>> = {};
  const enriched: Record<string, string[]> = {};
  const summary: Record<string, { reported: number; matched: number }> = {};

  for (const { label, names } of parsed) {
    const hits: Record<string, string[]> = {};
    for (const reported of names) {
      const [hit, rule] = matchLevel(reported, mature, ref, level);
      const markerOf = hit
        ? CELL_TYPES.filter((ct) => ref.markers[ct].has(hit))
        : [];
      matching.push({ list: label, reported, matched: hit ?? "", rule, markerOf });
      if (hit) (hits[hit] ??= []).push(reported);
    }
    const inp = new Set(Object.keys(hits));
    const rows: EnrichmentRow[] = [];
    const pvals: number[] = [];
    for (const ct of CELL_TYPES) {
      const markers = ref.markers[ct];
      const overlap = [...inp].filter((m) => markers.has(m)).sort();
      const a = overlap.length;
      const b = inp.size - a;
      const c = markers.size - a;
      const d = ref.background.size - a - b - c;
      const odds = (b * c) === 0 ? (a * d === 0 ? Number.NaN : Number.POSITIVE_INFINITY) : (a * d) / (b * c);
      const haldane = ((a + 0.5) * (d + 0.5)) / ((b + 0.5) * (c + 0.5));
      const pValue = inp.size ? fisherGreater(a, b, c, d) : 1;
      pvals.push(pValue);
      rows.push({
        list: label,
        cellType: ct,
        markersInList: a,
        markersK: markers.size,
        pctOverlap: markers.size ? (100 * a) / markers.size : Number.NaN,
        oddsRatio: odds,
        haldane,
        pValue,
        pAdj: 1,
        log10Padj: 0,
        enriched: false,
        overlap,
      });
    }
    const padj = inp.size ? bh(pvals) : pvals.map(() => 1);
    rows.forEach((row, i) => {
      const q = padj[i];
      row.pAdj = q;
      row.log10Padj = q > 0 ? -Math.log10(q) : Number.POSITIVE_INFINITY;
      row.enriched = q < ALPHA && inp.size > 0;
    });
    table.push(...rows);
    matched[label] = hits;
    enriched[label] = rows.filter((r) => r.enriched).map((r) => r.cellType);
    summary[label] = { reported: names.length, matched: inp.size };
  }

  const markerCounts: Record<string, number> = {};
  for (const ct of CELL_TYPES) markerCounts[ct] = ref.markers[ct].size;

  return {
    level,
    alpha: ALPHA,
    lists: parsed.map((p) => p.label),
    table,
    matching,
    matched,
    enriched,
    summary,
    backgroundN: ref.background.size,
    markerCounts,
  };
}

function natKey(f: string): [number, number, string] {
  const n = /^(?:miR|let)-(\d+)([a-z]?)/.exec(f);
  if (!n) return [2, 1_000_000, f];
  return [f.startsWith("let") ? 0 : 1, Number(n[1]), n[2] ?? ""];
}

export type StarColumn = { list: string; cellType: string };
export type StarPoint = { family: string; list: string; cellType: string; arms: string };

export function markerStars(reference: BactmanReference, result: EnrichmentResult) {
  const ref = resolveReference(reference, result.level);
  const cols: StarColumn[] = [];
  const arms = new Map<string, Set<string>>();
  for (const label of result.lists) {
    for (const ct of result.enriched[label] ?? []) {
      cols.push({ list: label, cellType: ct });
      for (const [hit, reps] of Object.entries(result.matched[label] ?? {})) {
        if (!ref.markers[ct].has(hit)) continue;
        const key = `${family(hit)}|${label}|${ct}`;
        const bucket = arms.get(key) ?? new Set<string>();
        let a = arm(hit);
        if (!a) {
          a = [...new Set(reps.map((r) => arm(r.startsWith("hsa-") ? r : `hsa-${r}`)).filter(Boolean))]
            .sort()
            .join("/");
        }
        if (a) bucket.add(a);
        arms.set(key, bucket);
      }
    }
  }
  const points: StarPoint[] = [...arms.entries()].map(([key, set]) => {
    const [fam, list, cellType] = key.split("|");
    return { family: fam, list, cellType, arms: [...set].sort().join("/") };
  });
  return { cols, points };
}

export function starRows(points: StarPoint[]) {
  const rank = new Map(CELL_TYPES.map((ct, i) => [ct, i]));
  const first = new Map<string, number>();
  const lists = new Map<string, Set<string>>();
  for (const p of points) {
    first.set(p.family, Math.min(first.get(p.family) ?? 99, rank.get(p.cellType as (typeof CELL_TYPES)[number]) ?? 99));
    const set = lists.get(p.family) ?? new Set<string>();
    set.add(p.list);
    lists.set(p.family, set);
  }
  return [...first.keys()].sort((a, b) => {
    const fa = first.get(a) ?? 99;
    const fb = first.get(b) ?? 99;
    if (fa !== fb) return fa - fb;
    const na = lists.get(a)?.size ?? 0;
    const nb = lists.get(b)?.size ?? 0;
    if (na !== nb) return nb - na;
    const ka = natKey(a);
    const kb = natKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2] < kb[2] ? -1 : ka[2] > kb[2] ? 1 : 0;
  });
}
