/**
 * Hmong (hmn) held-out cross-validation — the HONEST generalisation number.
 *
 * The shipped RPA→IPA converter scores 100% on the wikipron mww referee, but that is circular: the onset/rime/tone
 * maps were DERIVED from that same referee and RPA is deterministic. This script measures whether the *compositional*
 * maps generalise (vs memorise words): 5-fold, derive the onset/rime maps from 4/5 of the referee and predict the
 * held-out 1/5, segment-exact. A word-lookup would score ~0; the real number is ~94%.
 *
 * CAVEAT (see the investigation doc): this shares the referee's ONSET inventory across folds, so it validates
 * unseen rime/tone combinations of KNOWN onsets — it cannot detect onsets absent from the referee (those are
 * spec-filled in the manifest). Run: `npx tsx tools/referee-eval/hmn-heldout-cv.ts`
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TONE_LETTERS = new Set("bjvsgmd");
const VOWEL = new Set("aeiouɒəɨɛ");
const TONE_RE = /[˥˦˧˨˩̤̰]+$/u;
// The full onset inventory (longest-first) — same as the manifest; used only to segment RPA here.
const ONSETS = ["nplh", "ntxh", "ntsh", "ndlh", "nkh", "nqh", "nph", "nth", "nch", "ntx", "nts", "ndl", "plh", "tsh",
    "txh", "dlh", "hml", "hny", "npl", "hmn", "nrh", "ph", "pl", "np", "th", "nt", "dh", "dl", "nd", "hm", "hn", "hl",
    "tx", "ts", "xy", "ch", "nc", "ny", "kh", "nk", "qh", "nq", "rh", "nr", "ml",
    "p", "m", "f", "v", "t", "d", "n", "l", "r", "x", "s", "z", "c", "k", "q", "y", "h"];
const RIMES = ["ee", "oo", "ai", "aw", "au", "ia", "ua", "a", "e", "i", "o", "u", "w"];

const segIpa = (ipa: string): string => { const m = TONE_RE.exec(ipa.replace(/\s/g, "")); return m ? ipa.replace(/\s/g, "").slice(0, m.index) : ipa.replace(/\s/g, ""); };
function splitOV(seg: string): [string, string] {
    for (let i = 0; i < seg.length; i++) if (VOWEL.has(seg[i]!)) return [seg.slice(0, i), seg.slice(i)];
    return [seg, ""];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const rows: { o: string; r: string; seg: string }[] = [];
for (const line of readFileSync(join(HERE, "referees", "hmn.wikipron-mww-broad.tsv"), "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [rpa, ipa] = line.split("\t"); // first variant only
    if (!rpa || !ipa || !/^[a-z]+$/u.test(rpa)) continue;
    const base = TONE_LETTERS.has(rpa[rpa.length - 1]!) && rpa.length > 1 ? rpa.slice(0, -1) : rpa;
    const o = ONSETS.find((k) => base.startsWith(k)) ?? "";
    const r = base.slice(o.length);
    if (RIMES.includes(r)) rows.push({ o, r, seg: segIpa(ipa) });
}

let ok = 0, tot = 0;
for (let fold = 0; fold < 5; fold++) {
    const onset = new Map<string, Map<string, number>>(), onsetI = new Map<string, Map<string, number>>(), rime = new Map<string, Map<string, number>>();
    const bump = (m: Map<string, Map<string, number>>, k: string, v: string) => { const c = m.get(k) ?? new Map(); c.set(v, (c.get(v) ?? 0) + 1); m.set(k, c); };
    const top = (c?: Map<string, number>) => c ? [...c].sort((a, b) => b[1] - a[1])[0]![0] : undefined;
    rows.forEach((row, i) => { if (i % 5 === fold) return; const [oi, ri] = splitOV(row.seg); bump(row.r[0] === "i" ? onsetI : onset, row.o, oi); bump(rime, row.r, ri); });
    rows.forEach((row, i) => {
        if (i % 5 !== fold) return;
        tot++;
        const oi = (row.r[0] === "i" ? top(onsetI.get(row.o)) : undefined) ?? top(onset.get(row.o));
        const ri = top(rime.get(row.r));
        if (`${oi ?? "?"}${ri ?? "?"}` === row.seg) ok++;
    });
}
console.log(`rows: ${rows.length}  5-fold held-out segmental accuracy: ${ok}/${tot} = ${(100 * ok / tot).toFixed(1)}%`);
