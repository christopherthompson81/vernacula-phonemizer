/**
 * Build the en-GB lexical-set word lists (BATH/CLOTH/yod/PALM) from the wikipron UK referee. For each referee
 * word, run the RULE-ONLY GenAm→RP transform; where a single lexical-set edit (æ→ɑː, ɔː→ɒ, Cuː→Cjuː, or keeping
 * [ɑː] against the LOT rule) turns a folded MISS into a folded MATCH, that word joins the set. This is the
 * SHIPPED refinement — the honest eval stays on phonemizeWordRules (no sets) so the headline % is non-circular.
 *
 *   npx tsx tools/referee-eval/build-en-gb-sets.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { lexicalVariants, phonemizeWordRules } from "../../src/languages/english-gb/english-gb.ts";
import { CONFIG } from "./config.ts";
import { makeFold } from "./eval.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const fold = makeFold(CONFIG["en-GB"]!);

const rows = readFileSync(join(HERE, "referees", "en-gb.wikipron-uk.tsv"), "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((l) => l.split("\t"))
    .filter((a) => a.length >= 2 && a[0] && a[1]);

const bath: string[] = [], cloth: string[] = [], yod: string[] = [], palm: string[] = [], lotr: string[] = [];
// BATH/CLOTH/PALM/LOTR: a single edit whose folded form must match a referee variant OUTRIGHT.
const edits: [string[], (s: string) => string][] = [
    [bath, (s) => s.replace(/æ/u, "ɑː")],
    [cloth, (s) => s.replace(/ɔː/u, "ɒ")],
    // ⚠ THE SAME EDIT THE RUNTIME APPLIES, `[ɑɔ]ːɹ` AND NOT `ɑːɹ`. #1334 moved 7 of this set's words from
    // ɑː to ɔː and the runtime was widened for them; this probe was not, so the builder and the rule it
    // builds for had drifted — the same mismatch the marry hunk above exists to fix.
    // ⚠ IT CHANGES NOTHING TODAY AND IS STILL WORTH ALIGNING: `cloth` is probed BEFORE `lotr` and its
    // `ɔː → ɒ` produces the identical result for those words, so every one of them now lands in `cloth`
    // and `lotr` is down to 6. Aligned so a future reordering cannot silently un-widen the rule.
    [lotr, (s) => s.replace(/[ɑɔ]ːɹ/u, "ɒɹ")], // LOT before intervocalic r (sorry→sɒɹi; starry stays stɑːɹi)
    [palm, (s) => s.replace(/ɒ/u, "ɑː")], // LOT rule mis-fired on a PALM word → restore [ɑː]
];
const CORONAL_YOD = /[tdnszθl]j/u; // a post-coronal yod glide (position marker, not a full match)
const CORONAL_U = /[tdnszθl]ʰ?[ˈˌ]?uː/u; // our coronal + (aspiration) + (stress) + GOOSE, the yod-eligible slot

// A word joins a set when the lexical-set edit produces a form the referee ATTESTS — even if a yod-less /
// un-split variant also appears. The BBC target prefers the RP-diagnostic realisation (njuː, ɑː, ɒ) whenever
// it is attested, so yod-retention etc. apply to new/tune/duty even though the referee also lists nuː.
let claimed = 0;
// ⚠ A WORD THE LEXICAL TABLE OWNS IS NOT A LEXICAL-SET CANDIDATE, and `aluminium` is why this guard
// exists. Its GenAm citation is the American WORD, so the coronal-yod probe below saw `luː` with no yod
// where the referee attests one and filed it under yod-retention — an accent set claiming a word that
// differs lexically. The set was then powerless (a yod cannot add the syllable RP has) and, worse, the
// membership read as though the word had been accounted for. The override supplies the British citation
// instead, so these words must be excluded here rather than claimed by whichever single edit happens to
// move them closest.
const owned = lexicalVariants();
/**
 * ⚠ THE marry–merry SET IS APPLIED BEFORE PROBING, BECAUSE THE RULES PATH DOES NOT APPLY IT AND BATH
 * CANNOT SEE PAST IT. `en-gb-marry.tsv` is a shipped-path set this builder does not write, and the
 * runtime runs it FIRST for a documented reason (english-gb.ts): four words are in both sets, and the
 * chain is ɛɹ → æɹ → ɑːɹ. `phonemizeWordRules` gives `klɛɹə`, so the BATH edit `æ → ɑː` matches nothing
 * and the word cannot be claimed — the builder was structurally incapable of producing a membership the
 * runtime documents as load-bearing.
 * ⚠ FOUND BY REBUILDING AND DIFFING THE PRODUCT (#1381): of 1,033 words whose membership moved, 473 went
 * MISS → HIT against the referee and exactly 3 went the other way — `clara`, `dara`, `scarry`, with
 * `barry` silently dropped too. All four are the documented overlap. Without this, the rebuild would
 * have had to be landed with a hand edit re-adding them to a GENERATED file, which is the hazard #1385
 * and #1388 were both about.
 */
const marry = new Set(
    readFileSync(join(HERE, "..", "..", "data", "languages", "english-gb", "en-gb-marry.tsv"), "utf8")
        .split("\n").filter((l) => l.includes("\t") && !l.startsWith("#")).map((l) => l.split("\t")[0]!),
);
for (const row of rows) {
    const w = row[0]!;
    if (owned.has(w)) continue;
    const refFolded = row.slice(1).map((r) => fold(r));
    const rules = phonemizeWordRules(w);
    const ours = marry.has(w) ? rules.replace(/ɛ(ˈ|ˌ)?ɹ/u, "æ$1ɹ") : rules;
    // yod first, by POSITION: the referee attests a post-coronal yod that our GOOSE slot lacks (student, tune —
    // caught even when the rest of the word differs, e.g. our schwa vs the referee's syllabic n̩).
    if (CORONAL_U.test(ours) && !CORONAL_YOD.test(ours) && row.slice(1).some((r) => CORONAL_YOD.test(r.normalize("NFD")))) {
        yod.push(w); claimed++; continue;
    }
    for (const [set, edit] of edits) {
        const e = edit(ours);
        if (e === ours || !refFolded.includes(fold(e))) continue;
        // ⚠ PALM IS THE ONE EDIT THAT RUNS *AWAY* FROM RP, SO "ATTESTED" IS NOT ENOUGH FOR IT. BATH,
        // CLOTH and LOTR move toward the RP-diagnostic realisation (ɑː, ɒ, ɒɹ), which is why the policy
        // above accepts a variant the referee merely lists. PALM moves `ɒ → ɑː`, i.e. toward the GenAm
        // LOT vowel — and the fold strips LENGTH, so an American `fɹɑɡi` row is indistinguishable from
        // an RP `fɹɑːɡi` one. The referee is known to carry American rows (#1383), so on that policy
        // PALM claimed a word on the strength of the American reading even when the British `ɒ` row was
        // sitting beside it: `froggy` shipped as fɹˈɑːɡi with `fɹɒɡi` attested.
        // ⚠ THE DISCRIMINATOR IS THE UN-EDITED FORM. A genuine PALM word has no `ɒ` reading at all
        // (`father` fɑːðə, `calm` kɑːm); a LOT word contaminated by an American row has both. So PALM
        // alone requires that the referee does NOT also attest what we already produce.
        if (set === palm && refFolded.includes(fold(ours))) continue;
        set.push(w); claimed++; break;
    }
}

/**
 * ⚠ `--check` EXISTS BECAUSE THESE FILES WENT STALE FOR MONTHS AND NOTHING NOTICED (#1381). They are a
 * GENERATED artifact committed to the repo, exactly like `csharp/goldens/`, and they had drifted by 1,031
 * memberships against a dictionary that moved under them. The same failure mode as #1388's inert
 * dictionary rows: the artifact and its source disagree and every gate is green.
 * ⚠ IT IS A RITUAL, NOT A CI JOB, for the same reason `check-goldens` is: a run is minutes, and the
 * referee and dictionary it reads are large. `npm run check:en-gb-sets` on `main`, like the goldens.
 */
const check = process.argv.includes("--check");
const stale: string[] = [];
const write = (file: string, words: string[]): void => {
    words.sort();
    const path = join(HERE, "..", "..", "data", "languages", "english-gb", file);
    const body = words.map((w) => `${w}\t1`).join("\n") + "\n";
    if (check) {
        // ⚠ AN ABSENT SET FILE IS LEGITIMATE — `english-gb.ts` loads all five with `{ optional: true }` —
        // so this must REPORT it, not die with an ENOENT trace. A freshness check that crashes instead of
        // naming the artifact that disagrees with its source is the opposite of the point.
        const have = existsSync(path) ? readFileSync(path, "utf8") : "";
        if (have !== body) {
            // ⚠ THE SAME FILTER EVERY OTHER READER OF THESE FILES USES. Keeping any line with a tab
            // counts a header comment as a member, inflating `committed N` and reporting a phantom `-1`
            // that sends the reader hunting for a membership nothing ever lost.
            const had = new Set(have.split("\n")
                .filter((l) => l.includes("\t") && !l.startsWith("#")).map((l) => l.split("\t")[0]!));
            const now = new Set(words);
            const gone = [...had].filter((w) => !now.has(w)), added = [...now].filter((w) => !had.has(w));
            stale.push(`  ${file}: committed ${had.size}, builder ${now.size}  (+${added.length} / -${gone.length})`);
        }
        console.log(`  ${file}: ${words.length}`);
        return;
    }
    writeFileSync(path, body);
    console.log(`  ${file}: ${words.length}`);
};
write("en-gb-bath.tsv", bath);
write("en-gb-cloth.tsv", cloth);
write("en-gb-yod.tsv", yod);
write("en-gb-palm.tsv", palm);
write("en-gb-lotr.tsv", lotr);
console.log(`lexical-set words claimed ${claimed} of ${rows.length}`);
if (check) {
    if (stale.length === 0) console.log("en-gb lexical sets are fresh — they reproduce from this builder");
    else {
        console.log("⚠ STALE: the committed lexical sets no longer reproduce from this builder");
        for (const l of stale) console.log(l);
        console.log("  Decide WHICH is wrong before regenerating — the sets follow the dictionary, and a");
        console.log("  rebuild is a real change with a referee evaluation attached (see #1381).");
        process.exitCode = 1;
    }
}
