/**
 * Persian↔Tajik short-vowel divergence analysis — is Tajik a usable restoration signal, and are the tg↔fa
 * divergences regular?
 *
 * Aligns tg wikipron cognates to fa's abjad→IPA gold (via the transliteration skeleton), derives Persian IPA from
 * Tajik (the tajik-align remap), and — on the cognate overlap — compares BOTH the Tajik-derived IPA and fa's
 * CURRENT engine output against the true Persian gold (short vowels counted, notation folded: ā ɒ~aː, χ~x, tap,
 * stress/length/tie/dental). It also tallies the residual tg→fa substitution patterns.
 *
 * RESULT (965 cognates): tg-derived 71.9% vs fa-current 51.4% → Tajik predicts the short vowels fa misses by
 * +20.5pp. The residual is dominated by MERGERS Tajik SHARES with Persian and so cannot resolve: Tajik у → fa u
 * 87% / o 13% (the short-u→o vs long-ū→u merger — and the abjad does NOT disambiguate it: both write و, cf. دو
 * 'do'), plus a smaller bidirectional i↔e. So Tajik is a strong restoration SOURCE, with a genuine
 * merger-ambiguity ceiling (not a data-volume problem). See docs/investigations/fa_shortvowel_restoration_investigation.md.
 *
 *   npx tsx tools/persian/divergence-analysis.ts
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getPhonemizer } from "../../src/registry.ts";
import { translitToSkeleton, tajikIpaToPersian } from "./tajik-align.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const fa = getPhonemizer("fa");
const NORM: Record<string, string> = { "ص": "س", "ث": "س", "ذ": "ز", "ض": "ز", "ظ": "ز", "ط": "ت", "ح": "ه", "آ": "ا", "ي": "ی", "ك": "ک", "ٔ": "", "ء": "ع", "أ": "ا", "إ": "ا", "ؤ": "و" };
const norm = (w: string): string => [...w.replace(/[ً-ْـ]/gu, "")].map((c) => NORM[c] ?? c).join("");
// notation fold, short vowels KEPT: ā (ɒ~aː), χ~x, tap, stress/length/tie/dental/ʔ-onset
const cf = (s: string): string => s.replace(/[ˈˌ͡ː]/gu, "").replace(/[̀-ͯ]/gu, "").replace(/ɾ/gu, "r").replace(/χ/gu, "x").replace(/ɒ/gu, "a").replace(/ʔ/gu, "");

function lev(a: string, b: string): [string, string][] {
    const A = [...a], B = [...b], n = A.length, m = B.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
    for (let i = 0; i <= n; i++) dp[i]![0] = i;
    for (let j = 0; j <= m; j++) dp[0]![j] = j;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
        const c = A[i - 1] === B[j - 1] ? 0 : 1;
        dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + c);
    }
    const out: [string, string][] = [];
    let i = n, j = m;
    while (i > 0 && j > 0) {
        const c = A[i - 1] === B[j - 1] ? 0 : 1;
        if (dp[i]![j] === dp[i - 1]![j - 1]! + c) { if (c) out.push([A[i - 1]!, B[j - 1]!]); i--; j--; }
        else if (dp[i]![j] === dp[i - 1]![j]! + 1) { out.push([A[i - 1]!, "∅"]); i--; }
        else { out.push(["∅", B[j - 1]!]); j--; }
    }
    return out;
}

const gold = new Map<string, string[]>();
for (const l of readFileSync(join(HERE, "fa-abjad-ipa-gold.tsv"), "utf8").split("\n")) {
    if (!l.trim() || l.startsWith("#")) continue;
    const [w, ...i] = l.split("\t");
    gold.set(w!, i);
}
const bySkel = new Map<string, string>();
for (const w of gold.keys()) { const k = norm(w); if (!bySkel.has(k)) bySkel.set(k, w); }
const tgWords = readFileSync(join(HERE, "..", "referee-eval", "referees", "tg.wikipron-tgk-cyrl-broad.tsv"), "utf8")
    .split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t")[0]!);

const tally = new Map<string, number>();
let matched = 0, tgOk = 0, faOk = 0;
for (const w of tgWords) {
    const fw = bySkel.get(translitToSkeleton(w));
    if (!fw) continue;
    matched++;
    const refs = gold.get(fw)!.map(cf);
    const ours = cf(tajikIpaToPersian(w));
    if (refs.includes(ours)) { tgOk++; }
    else for (const [x, y] of lev(ours, refs[0]!)) tally.set(`${x}→${y}`, (tally.get(`${x}→${y}`) ?? 0) + 1);
    if (refs.includes(cf(fa.text(fw)))) faOk++;
}
console.log(`cognate words: ${matched}`);
console.log(`  Tajik-DERIVED == fa gold (short vowels): ${tgOk} (${((100 * tgOk) / matched).toFixed(1)}%)`);
console.log(`  fa CURRENT engine == fa gold (same words): ${faOk} (${((100 * faOk) / matched).toFixed(1)}%)`);
console.log(`  => Tajik advantage: +${(((tgOk - faOk) / matched) * 100).toFixed(1)}pp`);
console.log("residual tg→fa substitutions (top 10):");
[...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, c]) => console.log(`  ${k} : ${c}`));
