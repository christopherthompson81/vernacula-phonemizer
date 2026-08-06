/**
 * Rebuild the Min Nan dictionaries from ChhoeTaigi's PERMISSIVELY-licensed components
 * (LICENSES/PROVENANCE.md §4.6 — the previous MOE/甘字典/台日大辭典 layer was CC BY-ND / BY-NC-SA and
 * unshippable):
 *
 *   • ChhoeTaigi_TaihoaSoanntengTuichiautian.csv — 台華線頂對照典 (2002+, 楊允言), CC BY-SA 4.0
 *   • ChhoeTaigi_iTaigiHoataiTuichiautian.csv    — iTaigi 華台對照典 (2016+), CC0
 *
 * A row is usable when its written form (HanLoTaibunKip) is PURE Han and the Tâi-lô reading
 * (KipUnicode) has exactly one syllable per character — the same Han→Tâi-lô shape the runtime's
 * greedy longest-match segmentation consumes. Priority 台華 > iTaigi (curated dictionary before
 * crowdsourced neologisms); first reading wins within a source.
 *
 * Outputs:
 *   src/languages/minnan/dict.tsv        multi-char word → Tâi-lô
 *   src/languages/minnan/dict-chars.tsv  single char → Tâi-lô, from (a) explicit single-char
 *     entries, then (b) per-character majority vote over the aligned word entries (votes ≥ 2 and
 *     ≥ 60% agreement) for chars with no explicit entry — closing the single-char coverage gap the
 *     old MOE/Kam extraction served.
 *
 * Optional third input: a kaikki single-char Hokkien Tai-lo TSV (build-nan-kaikki-chars.mts),
 * used as the LOWEST-priority char tier (Wiktionary CC-BY-SA; referee-circularity caveat stated in
 * dict.PROVENANCE.md). Where a kaikki reading exists for a char we also carry from taihoa/itaigi,
 * the ChhoeTaigi reading wins and the agreement rate is reported as the cross-validation number.
 *
 * Usage: npx tsx tools/gen/build-nan-chhoetaigi.mts <taihoa.csv> <itaigi.csv> [kaikki-chars.tsv]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [taihoaPath, itaigiPath, kaikkiPath] = process.argv.slice(2);
if (!taihoaPath || !itaigiPath) {
    console.error("usage: build-nan-chhoetaigi.mts <taihoa.csv> <itaigi.csv> [kaikki-chars.tsv]");
    process.exit(1);
}

/** Minimal CSV parser (quoted fields, embedded commas/quotes; no embedded newlines in these files). */
function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i]!;
        if (inQ) {
            if (c === '"') {
                if (line[i + 1] === '"') { cur += '"'; i++; }
                else inQ = false;
            } else cur += c;
        } else if (c === '"') inQ = true;
        else if (c === ",") { out.push(cur); cur = ""; }
        else cur += c;
    }
    out.push(cur);
    return out;
}

const HAN_RE = /^[\p{Script=Han}]+$/u;

function load(path: string, hanCol: string, kipCol: string): Array<[string, string]> {
    const lines = readFileSync(path, "utf8").replace(/^﻿/, "").split("\n");
    const header = parseCsvLine(lines[0]!.trim());
    const hi = header.indexOf(hanCol), ki = header.indexOf(kipCol);
    if (hi < 0 || ki < 0) throw new Error(`${path}: missing ${hanCol}/${kipCol} in ${header}`);
    const rows: Array<[string, string]> = [];
    for (const line of lines.slice(1)) {
        if (!line.trim()) continue;
        const f = parseCsvLine(line.trim());
        const han = (f[hi] ?? "").trim();
        const kip = (f[ki] ?? "").trim();
        if (!han || !kip || !HAN_RE.test(han)) continue;
        const sylls = kip.split(/[-\s]+/u).filter(Boolean);
        if (sylls.length !== [...han].length) continue; // one syllable per char, or skip
        rows.push([han, sylls.join("-")]);
    }
    return rows;
}

/** All (written form, reading) rows regardless of Han purity — for char↔syllable vote mining. */
function loadRaw(path: string, hanCol: string, kipCol: string): Array<[string, string]> {
    const lines = readFileSync(path, "utf8").replace(/^﻿/, "").split("\n");
    const header = parseCsvLine(lines[0]!.trim());
    const hi = header.indexOf(hanCol), ki = header.indexOf(kipCol);
    const rows: Array<[string, string]> = [];
    for (const line of lines.slice(1)) {
        if (!line.trim()) continue;
        const f = parseCsvLine(line.trim());
        const han = (f[hi] ?? "").trim(), kip = (f[ki] ?? "").trim();
        if (han && kip) rows.push([han, kip]);
    }
    return rows;
}

const taihoa = load(taihoaPath, "HanLoTaibunKip", "KipUnicode");
const itaigi = load(itaigiPath, "HanLoTaibunKip", "KipUnicode");
const taihoaRaw = loadRaw(taihoaPath, "HanLoTaibunKip", "KipUnicode");
const itaigiRaw = loadRaw(itaigiPath, "HanLoTaibunKip", "KipUnicode");

const words = new Map<string, string>(); // multi-char
const chars = new Map<string, string>(); // explicit single-char
for (const rows of [taihoa, itaigi])     // 台華 first → its readings win
    for (const [han, kip] of rows) {
        const m = [...han].length === 1 ? chars : words;
        if (!m.has(han)) m.set(han, kip);
    }

// Alignment-derived single-char readings, mined from EVERY row — pure-Han rows align 1:1; mixed
// Han-Lo rows (á無 ↔ á-bô) align by walking the written form: each Han char consumes one reading
// syllable, each romanized run consumes its own syllable count and must MATCH those syllables
// (case/diacritic-insensitive) — the roman runs anchor the alignment, so a mismatch skips the row.
const HAN_CH = /\p{Script=Han}/u;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/gu, "").toLowerCase();
const votes = new Map<string, Map<string, number>>();
function mine(han: string, kip: string): void {
    const sy = kip.split(/[-\s]+/u).filter(Boolean);
    // tokenize: Han chars as single units, roman runs as strings
    const units: string[] = [];
    let run = "";
    for (const c of han) {
        if (HAN_CH.test(c)) {
            if (run.trim()) units.push(run.trim());
            run = "";
            units.push(c);
        } else run += c;
    }
    if (run.trim()) units.push(run.trim());
    const pairs: Array<[string, string]> = [];
    let i = 0;
    for (const u of units) {
        if (HAN_CH.test(u) && u.length <= 2 && [...u].length === 1) {
            if (i >= sy.length) return;
            pairs.push([u, sy[i]!]);
            i++;
        } else {
            const own = u.split(/[-\s]+/u).filter(Boolean);
            for (const o of own) {
                if (i >= sy.length || norm(o) !== norm(sy[i]!)) return; // anchor mismatch → unsafe row
                i++;
            }
        }
    }
    if (i !== sy.length) return;
    for (const [ch, s] of pairs) {
        const v = votes.get(ch) ?? new Map<string, number>();
        v.set(s, (v.get(s) ?? 0) + 1);
        votes.set(ch, v);
    }
}
for (const rows of [taihoaRaw, itaigiRaw]) for (const [han, kip] of rows) mine(han, kip);
// Tier order: explicit ChhoeTaigi single-char > majority-vote derived > kaikki dictionary
// reading > sole-attestation derived. A human citation reading (kaikki) is more reliable than a
// one-off word alignment, but never overrides a ChhoeTaigi-attested reading.
let derived = 0, singleVote = 0, usageOverrides = 0;
const soleAttested = new Map<string, string>();
for (const [ch, v] of votes) {
    const total = [...v.values()].reduce((a, b) => a + b, 0);
    const [best, n] = [...v.entries()].sort((a, b) => b[1] - a[1])[0]!;
    if (chars.has(ch)) {
        // Usage-weighted citation: when word usage STRONGLY contradicts the explicit single-char
        // entry (一 has a literary entry "it" but overwhelmingly reads tsi̍t in words), prefer the
        // usage majority — the standalone reading a TTS wants is the running-text one.
        if (n >= 5 && n / total >= 0.6 && norm(chars.get(ch)!) !== norm(best)) {
            chars.set(ch, best);
            usageOverrides++;
        }
        continue;
    }
    if (n >= 2 && n / total >= 0.6) { chars.set(ch, best); derived++; }
    else if (total === 1) soleAttested.set(ch, best);
}

// kaikki single-char Hokkien readings (Wiktionary CC-BY-SA; circularity caveat in
// dict.PROVENANCE.md). ChhoeTaigi-attested readings win; overlap agreement = cross-validation.
let kaikkiAdded = 0;
if (kaikkiPath) {
    let overlap = 0, agree = 0;
    for (const line of readFileSync(kaikkiPath, "utf8").split("\n")) {
        const [ch, kip] = line.split("\t");
        if (!ch || !kip) continue;
        if (chars.has(ch)) {
            overlap++;
            if (norm(chars.get(ch)!) === norm(kip)) agree++;
        } else { chars.set(ch, kip.trim()); kaikkiAdded++; soleAttested.delete(ch); }
    }
    console.log(`kaikki tier: ${kaikkiAdded} chars added; cross-validation on ${overlap} overlaps: ` +
        `${(agree / Math.max(1, overlap) * 100).toFixed(1)}% agreement (tone-mark-insensitive)`);
}
for (const [ch, best] of soleAttested) { chars.set(ch, best); singleVote++; } // last resort

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "languages", "minnan");
writeFileSync(join(outDir, "dict.tsv"),
    [...words.entries()].sort().map(([k, v]) => `${k}\t${v}`).join("\n") + "\n");
const charHeader = `# Min Nan single-char Han→Tâi-lô SUPPLEMENT — rebuilt from ChhoeTaigi's permissive components
# (台華線頂對照典 CC BY-SA 4.0 > iTaigi CC0; see dict.PROVENANCE.md). Explicit single-char entries first,
# then per-char majority vote over ALL aligned rows incl. mixed Han-Lo (votes>=2, >=60%: ${derived};
# sole-attestation fallback: ${singleVote}), then kaikki Wiktionary Hokkien single-char readings
# (CC-BY-SA, lowest priority; ${kaikkiAdded} chars — referee-circularity caveat in dict.PROVENANCE.md).
# The word dict.tsv takes precedence at runtime; this only fills single chars it lacks.
`;
writeFileSync(join(outDir, "dict-chars.tsv"),
    charHeader + [...chars.entries()].sort().map(([k, v]) => `${k}\t${v}`).join("\n") + "\n");

console.log(`taihoa usable rows: ${taihoa.length}, itaigi: ${itaigi.length}`);
console.log(`usage-overrides: ${usageOverrides}`);
console.log(`dict.tsv: ${words.size} words; dict-chars.tsv: ${chars.size} chars (${derived} alignment-derived)`);
