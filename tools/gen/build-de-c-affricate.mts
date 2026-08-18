/**
 * Build the curated German ⟨c⟩→/t͡s/ list — tools/gen/de-consonant-curated.tsv, merged into
 * src/languages/german/consonant.tsv by build-de-consonant.mts.
 *
 * ⚠ WHY THIS IS A LIST AND NOT A RULE. German ⟨C⟩ before a front vowel is /t͡s/ (Celsius, circa, Calcium,
 * Mercedes, Silicium) where the manifest maps ⟨c⟩ → /k/ context-free. But of the 249 kaikki words spelled
 * with a bare ⟨c⟩ before a front vowel only 98 (39.4%) take /t͡s/ — the rest are English and Romance loans
 * where /k/ or /s/ is right (City, Ceylon). A rule would be wrong most of the time, so the KNOWN words go
 * in the dictionary and /k/ stays the OOV default.
 *
 * ⚠ AND WHY IT IS A SEPARATE BUILD. build-de-consonant.mts aligns the two sides BY CONSONANT ORDINAL and
 * drops any word whose two sides disagree on consonant count. The tie bar is in its skip set, so kaikki's
 * `t͡s` counts as TWO consonants against our one and Celsius (4 slots vs 5) falls out on the length check —
 * before the pair allow-list is consulted. Making an affricate one slot there fixes these 98 words and
 * REGRESSES the table overall (measured: independent wikipron deu 2313 → 2305, primary 3711 → 3698), because
 * it breaks the words whose counts already agreed. So the collapse lives HERE, where it only has to align
 * this one class, and the ordinals it produces are converted back to the shipped tokenizer's counting.
 *
 * ⚠ RUN THIS BEFORE build-de-consonant.mts, AND RUN THAT ONE AFTER. Like its sibling, this script
 * TRUNCATES src/languages/german/consonant.tsv first, so that `phonemizeWord` compares against the RAW
 * engine — the table is lazily loaded, and left in place it would feed this script its own previous output
 * (every `k` it is looking for has already become `t͡s`, so a re-run emits a nearly empty list and the
 * class silently disappears). build-de-consonant.mts truncates it again and rebuilds it with this file
 * merged in, which is what leaves the shipped table correct.
 *
 * Usage:
 *   npx tsx tools/gen/build-de-c-affricate.mts --kaikki <word\tIPA tsv, LOWERCASED keys>
 *   npx tsx tools/gen/build-de-consonant.mts   --kaikki <same file>     # ⚠ always, and second
 */
import { readFileSync, writeFileSync } from "node:fs";

import { phonemizeWord } from "../../src/languages/german/german.ts";
import { MANIFEST } from "../../src/languages/german/manifest.ts";

function arg(name: string, fb: string): string {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fb;
}
const KAIKKI = arg("kaikki", "");
const OUT = "tools/gen/de-consonant-curated.tsv";
if (!KAIKKI) throw new Error("pass --kaikki <word\\tIPA tsv> (lowercased keys — see extract_kaikki_de.py)");

const VOWELS = MANIFEST.vowelChars;
const isConsChar = (c: string): boolean => !VOWELS.includes(c) && !"ˈˌʔ()ː̯̩̥͡".includes(c);

/** Consonant units with an affricate held as ONE unit, tie bar canonical. Used only to locate the ⟨c⟩. */
function units(ipa: string): string[] {
    const s = ipa.replace(/n̩/g, "ən").replace(/l̩/g, "əl").replace(/m̩/g, "əm").replace(/ŋ̩/g, "əŋ");
    const out: string[] = [];
    for (let i = 0; i < s.length; i++) {
        if (s[i] === "ɐ" && s[i + 1] === "̯") { out.push("ɐ̯"); i++; continue; }
        if (!isConsChar(s[i]!)) continue;
        const tie = s[i + 1] === "͡" ? 1 : 0;
        const nxt = s[i + 1 + tie];
        // kaikki writes the same affricate both ways (`t͡s` and a bare `ts`); canonicalise so they compare equal.
        if (tie === 1 && nxt !== undefined) { out.push(`${s[i]}͡${nxt}`); i += 1 + tie; continue; }
        if ("tdp".includes(s[i]!) && nxt !== undefined && "sʃʒf".includes(nxt)) {
            out.push(`${s[i]}͡${nxt}`); i++; continue;
        }
        out.push(s[i]!);
    }
    return out;
}

/** A unit index → the ordinal the SHIPPED applyConsonant will be at, where an affricate is two slots. */
const shippedOrdinal = (us: string[], idx: number): number =>
    us.slice(0, idx).reduce((n, u) => n + (u.includes("͡") ? 2 : 1), 0);

// ⚠ EMPTY IT FIRST — see the header. phonemizeWord's lazy load then finds no corrections, so `ours` is the
// raw engine reading and the `k` this script keys on is still a `k`.
writeFileSync("src/languages/german/consonant.tsv", "");

const rows = readFileSync(KAIKKI, "utf8").trim().split("\n").map((l) => l.split("\t"));
const out: [string, string][] = [];
let seen = 0;
for (const [w, kipa] of rows) {
    if (!w || !kipa) continue;
    if (!/^[a-zäöüß]+$/u.test(w) || !/[aeiouäöüy]/u.test(w)) continue;
    // Only the orthographic class this list is for: a bare ⟨c⟩ (not ⟨ch⟩/⟨ck⟩/⟨sch⟩) before a front vowel.
    if (!/(?<!s)c(?![hk])[eiäöy]/u.test(w)) continue;
    seen++;
    const ours = phonemizeWord(w);
    const ou = units(ours), ku = units(kipa);
    if (ou.length !== ku.length) continue;
    const specs: string[] = [];
    for (let i = 0; i < ou.length; i++)
        if (ou[i] === "k" && ku[i] === "t͡s") specs.push(`${shippedOrdinal(ou, i)}t͡s`);
    if (specs.length) out.push([w, specs.join(",")]);
}
out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

const hdr =
    "# German ⟨c⟩→/t͡s/ before a front vowel — word<TAB>consonant-ordinal+target,…\n" +
    "# SOURCE: the kaikki German extract (Wiktionary, CC-BY-SA). Generated by\n" +
    "# tools/gen/build-de-c-affricate.mts; merged into src/languages/german/consonant.tsv by\n" +
    "# build-de-consonant.mts. See LICENSES/PROVENANCE.md.\n" +
    "# A LIST, NOT A RULE: of the 249 kaikki words spelled with a bare ⟨c⟩ before a front vowel only 98\n" +
    "# take /t͡s/ — the rest are loans where /k/ or /s/ is right (City, Ceylon) — so /k/ stays the OOV\n" +
    "# default and the known words are named here.\n";
writeFileSync(OUT, hdr + out.map(([w, o]) => `${w}\t${o}`).join("\n") + "\n");
console.log(`wrote ${OUT}: ${out.length} entries (of ${seen} words spelled with a bare c before a front vowel)`);
