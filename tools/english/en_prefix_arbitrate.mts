/**
 * ARBITRATE the de-/re-/pre- prefix-vowel families (#1397) against the third sources, and emit the
 * curated rows. ⚠ THIS EXISTS BECAUSE THE PR'S WHOLE ARGUMENT IS THAT AN UNAUDITED SOURCE WAS BEING
 * TRUSTED — the arbitration step is the one that most needs to be re-runnable.
 *
 *   MOBY=/path/to/mobypron.unc npx tsx tools/english/en_prefix_arbitrate.mts [--espeak] [--emit]
 *
 * ⚠ ESPEAK CANNOT ARBITRATE THIS CLASS, and `--espeak` is how you check that rather than take it on
 * trust. Measured over a quarter of the 3,391 prefix words, it writes the reduced vowel every time and
 * the tense vowel never — its vote is a CONSTANT. #1378 item 4's "espeak backs the agreed form on 27
 * of 35 rows" therefore says only that 27 of those agreed forms were reduced; every one of the 104
 * prefix rows the curated layer has applied moves TENSE → REDUCED.
 *
 * ⚠ AND misaki `us_gold.json` IS NOT ON THIS MACHINE, so of the three sources #1397 names, one is
 * uninformative and one is absent. The verdicts below rest on MOBY ALONE, which does discriminate
 * (`retrieve r/I/` reduced against `repress r/i/` tense) — and therefore on the two-member rule.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { familyKey, isTense, loadPrefixWords, orphansAfter, relatedForms, type Word } from "./en_prefix_families.mts";

const MOBY = process.env["MOBY"] ?? "/mnt/data/moby/mobypron.unc";

/** Moby writes `/i/` for FLEECE (tense) and `/I/` for KIT (reduced); the prefix vowel is the first. */
function mobyVowels(): Map<string, "T" | "R"> {
    const out = new Map<string, "T" | "R">();
    if (!existsSync(MOBY)) return out;
    for (const line of readFileSync(MOBY, "latin1").split("\r")) {
        const sp = line.indexOf(" ");
        if (sp < 0) continue;
        const m = /^[^/]*\/(i|I)\//u.exec(line.slice(sp + 1).replace(/'/gu, ""));
        if (m) out.set(line.slice(0, sp).toLowerCase(), m[1] === "i" ? "T" : "R");
    }
    return out;
}

export function families(words: Word[]): Map<string, Word[]> {
    const fams = new Map<string, Word[]>();
    for (const w of words) {
        const k = familyKey(w.word, w.prefix);
        const at = fams.get(k);
        if (at) at.push(w); else fams.set(k, [w]);
    }
    return fams;
}

const words = loadPrefixWords();
const fams = families(words);
const moby = mobyVowels();

if (process.argv.includes("--espeak")) {
    const sample = words.filter((_, i) => i % 4 === 0);
    const ipa: string[] = [];
    for (let i = 0; i < sample.length; i += 40)
        ipa.push(...execFileSync("espeak-ng", ["-v", "en-us", "-q", "--ipa", sample.slice(i, i + 40).map((w) => w.word).join(" ")],
            { encoding: "utf8" }).trim().split(/\s+/u));
    let t = 0, r = 0, o = 0;
    for (let i = 0; i < sample.length; i++) {
        const p = (ipa[i] ?? "").replace(/[ˈˌ]/gu, "");
        if (/^(?:pɹ|ɹ|d)i(?!ː)/u.test(p) && !/^(?:pɹ|ɹ|d)ᵻ/u.test(p)) t++;
        else if (/^(?:pɹ|ɹ|d)[ᵻɪ]/u.test(p)) r++;
        else o++;
    }
    console.log(`espeak en-us over ${sample.length} words:  tense ${t}   reduced ${r}   neither ${o}`);
    console.log(t === 0 ? "⚠ ZERO TENSE — espeak's vote is a constant and cannot arbitrate this class." : "");
}

// ⚠ TWO INDEPENDENT MEMBERS MUST AGREE. Many families are covered by ONE Moby row, and a single word's
// vote generalised to a six-word family is not a family verdict — `re:rebuff` is covered on 1 of 4.
const rows: [string, string, string, string][] = [];
const after = new Map<string, string>();
let split = 0, covered = 0, consistent = 0, settled = 0;
for (const [k, m] of fams) {
    if (m.length < 2 || new Set(m.map((x) => (isTense(x.vowel) ? "T" : "R"))).size < 2) continue;
    split++;
    const votes = m.map((x) => moby.get(x.word)).filter((v) => v !== undefined) as ("T" | "R")[];
    if (votes.length > 0) covered++;
    if (votes.length > 0 && new Set(votes).size === 1) consistent++;
    if (votes.length < 2 || new Set(votes).size > 1) continue;
    settled++;
    const want = votes[0]!;
    // ⚠ THE FAMILY IS EXTENDED BY RELATEDNESS BEFORE APPLYING, because the KEY can strand a member.
    // `prescriptivist` keys to `pre:prescriptiv` — `ist` strips before `ive` can — so it sits in a
    // family of one and the family verdict never reaches it. Applying to the key's members alone left
    // it tense beside a reduced `prescriptive`: a split INTRODUCED under a note reading "family
    // consistency". The orphan guard below is what caught that, and this is the fix it forced.
    const extended = [...m, ...words.filter((o) => !m.includes(o) && o.prefix === m[0]!.prefix
        && m.some((x) => relatedForms(o.word, x.word)))];
    for (const x of extended) {
        if ((isTense(x.vowel) ? "T" : "R") === want) continue;
        const vi = x.phones.findIndex((p) => /\d$/u.test(p));
        const to = [...x.phones];
        to[vi] = want === "T" ? "IY0" : "IH0";
        after.set(x.word, to[vi]!);
        rows.push([x.word, x.phones.join(" "), to.join(" "),
            `prefix vowel: family consistency, Moby ${want === "T" ? "tense" : "reduced"} on ${votes.length} members (#1397) [${k}]`]);
    }
}
console.log(`split families ${split}   Moby covers ≥1 ${covered}   internally consistent ${consistent}   ⚠ settled on ≥2 ${settled}`);

// ⚠ THE GUARD. A fix whose note says "family consistency" must not LEAVE a family split.
const bad = orphansAfter(words, after);
if (bad.length > 0) {
    console.log(`\u26a0 ORPHANS \u2014 these pairs would disagree after the change:\n   ${bad.join("\n   ")}`);
    process.exitCode = 1;
} else console.log(`no orphan pairs (${rows.length} rows)`);

if (process.argv.includes("--emit")) for (const r of rows) console.log(r.join("\t"));
