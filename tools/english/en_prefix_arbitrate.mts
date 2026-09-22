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

/**
 * misaki `us_gold.json` — CMUdict plus heavy hand curation, the lexicon Kokoro was trained on.
 * ⚠ IT IS ON THIS MACHINE AND AN EARLIER RUN OF THIS INVESTIGATION SAID IT WAS NOT. The `find` that
 * looked for it used `-maxdepth 6` and the file sits at depth 7 inside a site-packages tree; the claim
 * "of the three sources #1397 names, one is uninformative and one is absent" went into the curated
 * file's comment block and into the log on the strength of a depth-limited search reported as a fact.
 * ⚠ AND IT MATTERS, BECAUSE IT DISCRIMINATES AND IT DISAGREES WITH MOBY. Of the 26 rows the first pass
 * shipped on Moby alone, gold contradicts THIRTEEN — `prescriptive*` and `presumptive*` it reads TENSE
 * where Moby said reduced, `precess*` reduced where Moby said tense. Moby alone was not a sound basis.
 */
const GOLD = process.env["GOLD"]
    ?? "/home/chris/base/lib/python3.12/site-packages/misaki/data/us_gold.json";
function goldVowels(): Map<string, "T" | "R"> {
    const out = new Map<string, "T" | "R">();
    if (!existsSync(GOLD)) return out;
    const d = JSON.parse(readFileSync(GOLD, "utf8")) as Record<string, unknown>;
    for (const [w, v] of Object.entries(d)) {
        if (typeof v !== "string") continue;                       // gold stores POS pairs as objects
        const m = /^(?:p?ɹ|d)([iəɪ])/u.exec(v.replace(/[ˈˌ]/gu, ""));
        if (m) out.set(w, m[1] === "i" ? "T" : "R");
    }
    return out;
}

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
const gold = goldVowels();

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

/**
 * ⚠ TWO SOURCES, AND THEY MUST NOT CONTRADICT EACH OTHER. #1397 asks for a majority of espeak + gold +
 * Moby; espeak's vote is a constant (`--espeak` proves it), so the majority is gold and Moby, and a
 * majority of two is agreement. Where they split the family ABSTAINS — measured, they split often.
 * ⚠ AND THE TWO-MEMBER RULE STILL APPLIES TO A LONE SOURCE. A family the other source is silent on is
 * settled only if the speaking one covers TWO members: one covered word is not a family verdict, which
 * is what made `re:rebuff` (1 of 4) look settled in the first pass.
 */
/**
 * ⚠ "SILENT" AND "SPLIT WITHIN ITSELF" ARE DIFFERENT STATES AND CONFLATING THEM LETS THE OTHER SOURCE
 * WIN AN ARGUMENT IT WAS NOT IN. A first version returned `undefined` for both, so a family gold
 * disagrees with ITSELF about fell through to Moby and shipped as "gold silent" — `detoxication` went
 * out tense that way while gold reads it `dətˌɑksəkˈAʃən`, reduced. A source that speaks and
 * contradicts itself is evidence of DIFFICULTY, not of absence.
 */
type Verdict = { kind: "silent" } | { kind: "split" } | { kind: "says"; v: "T" | "R"; n: number };
const verdict = (m: Word[], src: Map<string, "T" | "R">): Verdict => {
    const votes = m.map((x) => src.get(x.word)).filter((v) => v !== undefined) as ("T" | "R")[];
    if (votes.length === 0) return { kind: "silent" };
    if (new Set(votes).size > 1) return { kind: "split" };
    return { kind: "says", v: votes[0]!, n: votes.length };
};
const rows: [string, string, string, string][] = [];
const after = new Map<string, string>();
let split = 0, settled = 0, contradicted = 0, thin = 0;
for (const [k, m] of fams) {
    if (m.length < 2 || new Set(m.map((x) => (isTense(x.vowel) ? "T" : "R"))).size < 2) continue;
    split++;
    const g = verdict(m, gold), mo = verdict(m, moby);
    // ⚠ A SOURCE THAT CONTRADICTS ITSELF ACROSS THE FAMILY STOPS THE FAMILY, rather than handing the
    // decision to the other one. That is the whole point of arbitrating per family.
    if (g.kind === "split" || mo.kind === "split") { contradicted++; continue; }
    let want: "T" | "R" | undefined;
    let why = "";
    if (g.kind === "says" && mo.kind === "says") {
        if (g.v !== mo.v) { contradicted++; continue; }                    // the sources disagree — abstain
        want = g.v; why = `gold and Moby agree on ${g.n} and ${mo.n} members`;
    } else if (g.kind === "says" && g.n >= 2) { want = g.v; why = `gold on ${g.n} members, Moby silent`; }
    else if (mo.kind === "says" && mo.n >= 2) { want = mo.v; why = `Moby on ${mo.n} members, gold silent`; }
    else { thin++; continue; }
    settled++;
    const extended = [...m, ...words.filter((o) => !m.includes(o) && o.prefix === m[0]!.prefix
        && m.some((x) => relatedForms(o.word, x.word)))];
    for (const x of extended) {
        if ((isTense(x.vowel) ? "T" : "R") === want) continue;
        const vi = x.phones.findIndex((p) => /\d$/u.test(p));
        const to = [...x.phones];
        to[vi] = want === "T" ? "IY0" : "IH0";
        after.set(x.word, to[vi]!);
        rows.push([x.word, x.phones.join(" "), to.join(" "),
            `prefix vowel: family consistency, ${want === "T" ? "tense" : "reduced"} — ${why} (#1397) [${k}]`]);
    }
}
console.log(`split families ${split}   ⚠ settled ${settled}   sources CONTRADICT ${contradicted}   too thin ${thin}`);

// ⚠ THE GUARD, over PAIRS not families — see orphansAfter. A fix whose note says "family
// consistency" must not leave a related pair disagreeing anywhere.
const bad = orphansAfter(words, after);
if (bad.length > 0) {
    console.log(`\u26a0 ORPHANS \u2014 these pairs would disagree after the change:\n   ${bad.join("\n   ")}`);
    process.exitCode = 1;
} else console.log(`no orphan pairs (${rows.length} rows)`);

if (process.argv.includes("--emit")) for (const r of rows) console.log(r.join("\t"));
