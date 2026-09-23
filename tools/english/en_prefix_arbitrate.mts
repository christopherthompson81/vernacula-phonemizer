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
 * of 35 rows" therefore says only that 27 of those agreed forms were reduced.
 *
 * ⚠ AN EARLIER VERSION OF THIS HEADER SAID us_gold.json WAS NOT ON THIS MACHINE AND THAT THE VERDICTS
 * RESTED ON MOBY ALONE. Both were false and the second shipped 26 rows, 13 of which gold contradicts.
 * The arbitration is gold AND Moby, abstaining wherever either hesitates.
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
    // ⚠ NEVER FAIL OPEN. An absent gold file used to return an empty map silently, which makes every
    // family report "gold silent", hands the decision to the `Moby on 2 members` branch, and emits
    // Moby-alone rows whose NOTE TEXT is indistinguishable from a genuine silence. That is #1416's
    // defect reproducing itself on any machine where the venv moved.
    if (!existsSync(GOLD)) {
        console.error(`⚠ us_gold.json not found at ${GOLD} — refusing to arbitrate on one source.`);
        console.error("  Set GOLD=/path/to/misaki/data/us_gold.json. See #1397/#1418.");
        process.exit(2);
    }
    const d = JSON.parse(readFileSync(GOLD, "utf8")) as Record<string, unknown>;
    for (const [w, v] of Object.entries(d)) {
        // ⚠ A POS-KEYED ENTRY IS NOT SILENCE. gold stores heteronyms as `{DEFAULT, VERB, …}`, and 142
        // prefix words are shaped that way (`precipitate`, `deviate`, `degenerate`); discarding them
        // scored gold as silent and handed those families to Moby alone — the same silent-vs-speaks
        // conflation this tool's own abstain rule is about, one level down in the reader.
        const p = typeof v === "string" ? v
            : (typeof v === "object" && v !== null && typeof (v as Record<string, unknown>)["DEFAULT"] === "string"
                ? (v as Record<string, string>)["DEFAULT"]! : undefined);
        if (p === undefined) continue;
        // ⚠ AND `ᵻ` IS REDUCED, NOT ABSENT. It is misaki's IH0/AH0 merge vowel and 13 prefix entries use
        // it (`dᵻdˈʌkt` and the rest of the deduce/deduct family). Omitting it from the class scored
        // gold as silent where gold SPEAKS, reduced.
        const m = /^(?:p?ɹ|d)([iəɪᵻ])/u.exec(p.replace(/[ˈˌ]/gu, ""));
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
/**
 * Families a LISTENER has ruled on against the sources (#1397).
 *
 * ⚠ A COMMENT IN THE CURATED FILE DOES NOT STOP THIS TOOL. The first attempt at reverting `preferred`
 * recorded the reason there and said "so the next sweep does not re-derive them" — and the very next
 * run re-derived them, because nothing read that comment. The refusal has to live where the decision is
 * made.
 *
 * ⚠ AND THE SOURCE IS NOT WRONG ABOUT THE SOUND — it is wrong about the ANALYSIS. gold reads `prefer`
 * pɹifˈɜɹ with a tense ⟨i⟩, and for a PRODUCTIVE prefix that is right: `depopulation`, `devaluation`
 * and `remodeling` all shipped tense on the same evidence and are correct, because `de-`/`re-` there
 * mean "undo" and "again" and the prefix is a separable morpheme keeping its full vowel. `prefer` is
 * not `pre` + `fer`; the prefix is lexicalised into the root, and a lexicalised prefix reduces. No
 * per-family vote can see that difference, which is why gold and Moby "disagree" so often here: they
 * are not disagreeing about the sound.
 */
const LISTENER_RULED: ReadonlySet<string> = new Set(["pre:preferr"]);

const rows: [string, string, string, string][] = [];
const after = new Map<string, string>();
/**
 * The families that abstain, for `--adjudicate` (#1397).
 *
 * ⚠ THEY ARE NOT WAITING ON A MISSING SOURCE. 35 of the 46 abstain because gold and Moby genuinely
 * DISAGREE, or because one of them disagrees with itself; 11 are under the two-member floor. No further
 * lexicon settles those — what settles them is a listener, which is what this dump is for.
 */
const open: { key: string; why: string; members: string[]; gold: string; moby: string }[] = [];
const show = (v: Verdict): string =>
    v.kind === "says" ? `${v.v === "T" ? "tense" : "reduced"} (${v.n})` : v.kind;
let split = 0, settled = 0, contradicted = 0, thin = 0;
for (const [k, m] of fams) {
    if (m.length < 2 || new Set(m.map((x) => (isTense(x.vowel) ? "T" : "R"))).size < 2) continue;
    if (LISTENER_RULED.has(k)) continue;   // ⚠ a listener has overruled both sources — see the set
    split++;
    const g = verdict(m, gold), mo = verdict(m, moby);
    // ⚠ A SOURCE THAT CONTRADICTS ITSELF ACROSS THE FAMILY STOPS THE FAMILY, rather than handing the
    // decision to the other one. That is the whole point of arbitrating per family.
    if (g.kind === "split" || mo.kind === "split") {
        contradicted++;
        open.push({ key: k, why: g.kind === "split" ? "gold contradicts ITSELF" : "Moby contradicts ITSELF",
            members: m.map((x) => `${x.word}:${isTense(x.vowel) ? "T" : "R"}`), gold: show(g), moby: show(mo) });
        continue;
    }
    // ⚠ THE TWO-MEMBER FLOOR IS OVER DISTINCT WORDS, NOT PER SOURCE, AND DROPPING IT WAS THE WHOLE
    // DEFECT OF THE FIRST TWO-SOURCE PASS. "gold and Moby agree" was allowed to settle a family on ONE
    // covered word, so 12 of 34 rows read "agree on 1 and 1 members" — and in every case the covered
    // word was the BASE FORM, the member that already agrees with the dictionary, while the members
    // actually being CHANGED had no attestation at all. `re:rebuff` shipped that way: the exact family
    // the previous comment named as the counterexample ("covered on 1 of 4"). Two sources agreeing
    // about one word is still one word.
    const covered = new Set([...m.filter((x) => gold.has(x.word)), ...m.filter((x) => moby.has(x.word))]
        .map((x) => x.word));
    let want: "T" | "R" | undefined;
    let why = "";
    if (covered.size < 2) {
        thin++;
        open.push({ key: k, why: `under the two-member floor (${covered.size} covered)`,
            members: m.map((x) => `${x.word}:${isTense(x.vowel) ? "T" : "R"}`), gold: show(g), moby: show(mo) });
        continue;
    }
    if (g.kind === "says" && mo.kind === "says") {
        if (g.v !== mo.v) {
            contradicted++;
            open.push({ key: k, why: "gold and Moby DISAGREE",
                members: m.map((x) => `${x.word}:${isTense(x.vowel) ? "T" : "R"}`), gold: show(g), moby: show(mo) });
            continue;                                                          // the sources disagree — abstain
        }
        want = g.v; why = `gold and Moby agree, ${covered.size} members covered`;
    } else if (g.kind === "says") { want = g.v; why = `gold on ${g.n} members, Moby silent`; }
    else if (mo.kind === "says") { want = mo.v; why = `Moby on ${mo.n} members, gold silent`; }
    else {
        thin++;
        open.push({ key: k, why: "neither source speaks",
            members: m.map((x) => `${x.word}:${isTense(x.vowel) ? "T" : "R"}`), gold: show(g), moby: show(mo) });
        continue;
    }
    settled++;
    // ⚠ THE FAMILY IS EXTENDED BY RELATEDNESS BEFORE APPLYING, because the KEY can strand a member:
    // `prescriptivist` keys to `pre:prescriptiv` — `ist` strips before `ive` can — so it sits in a
    // family of one and the verdict never reaches it. (This comment was deleted in one review round
    // while the code it justifies was kept; it is back.)
    const extended = [...m, ...words.filter((o) => !m.includes(o) && o.prefix === m[0]!.prefix
        && m.some((x) => relatedForms(o.word, x.word)))];
    // ⚠ AND THE VERDICT MUST BE RE-TESTED OVER THE EXTENDED SET. It was computed over the KEY's members
    // only, so a stranded word — the very case the extension exists for — could be overwritten even
    // where a source gives it the OPPOSITE value, because the split detection never looked at it.
    const ext = verdict(extended, gold), extMo = verdict(extended, moby);
    if (ext.kind === "split" || extMo.kind === "split"
        || (ext.kind === "says" && ext.v !== want) || (extMo.kind === "says" && extMo.v !== want)) {
        contradicted++; settled--; continue;
    }
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

/**
 * ⚠ THE OPEN FAMILIES, FOR A LISTENER. Every other tier has been exhausted: espeak's vote is a
 * constant, gold and Moby are the only two curated sources, and where they disagree no third lexicon
 * exists to break the tie. `T` is the tense prefix vowel (`riː-`), `R` the reduced one (`rɪ-`/`rə-`).
 *
 *   npx tsx tools/english/en_prefix_arbitrate.mts --adjudicate
 */
if (process.argv.includes("--adjudicate")) {
    console.log();
    for (const o of open.sort((a, b) => a.key.localeCompare(b.key)))
        console.log(`${o.key}\t${o.why}\tgold=${o.gold}\tmoby=${o.moby}\t${o.members.join(" ")}`);
}
