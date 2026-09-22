/**
 * Build the en-GB lexical-set word lists (BATH/CLOTH/yod/PALM) from the wikipron UK referee. For each referee
 * word, run the RULE-ONLY GenAm→RP transform; where a single lexical-set edit (æ→ɑː, ɔː→ɒ, Cuː→Cjuː, or keeping
 * [ɑː] against the LOT rule) turns a folded MISS into a folded MATCH, that word joins the set. This is the
 * SHIPPED refinement — the honest eval stays on phonemizeWordRules (no sets) so the headline % is non-circular.
 *
 *   npx tsx tools/referee-eval/build-en-gb-sets.ts
 */
import { existsSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { lexicalVariants, phonemizeWordRules } from "../../src/languages/english-gb/english-gb.ts";
import { CONFIG } from "./config.ts";
import { makeFold } from "./eval.ts";
import { lemmaCandidates } from "./engb-paradigm-audit.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const fold = makeFold(CONFIG["en-GB"]!);

/** ⚠ `--limit N` IS FOR THE SHARD-EQUIVALENCE TEST AND NOTHING ELSE. A full run is minutes, which is too
 *  slow to gate the `--jobs` claim in the suite — and an unverified "byte-identical" is exactly the kind of
 *  claim this repo has been burned by. Limiting the ROW LIST keeps the shard arithmetic (`index % n`)
 *  identical, so the property under test is the real one; the sets it produces are meaningless and it must
 *  never be used to write them. */
const limIdx = process.argv.indexOf("--limit");
const limit = limIdx >= 0 ? Math.max(1, Math.trunc(Number(process.argv[limIdx + 1]) || 0)) : Infinity;
const rows = readFileSync(join(HERE, "referees", "en-gb.wikipron-uk.tsv"), "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((l) => l.split("\t"))
    .filter((a) => a.length >= 2 && a[0] && a[1])
    .slice(0, limit === Infinity ? undefined : limit);

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
/**
 * One reduced-vowel slot, for comparisons where the referee and this engine may spell it differently.
 * ⚠ NO STRESS GUARD, UNLIKE `bare()` BELOW, AND THE TWO ARE NOT IN CONFLICT: `weak` is only ever applied
 * to strings the BACKBONE has already been through, which strips every stress mark, so there is nothing
 * left to gate on. `bare` runs on raw engine output, where a stressed vowel is exactly what tells `past`
 * from `paste`.
 */
const weak = (x: string): string => x.replace(/[əɪᵻ]/gu, "ə");
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
const dictWords = new Set(
    readFileSync(join(HERE, "..", "..", "data", "languages", "english", "g2p-dict.tsv"), "utf8")
        .split("\n").filter((l) => l.includes("\t") && !l.startsWith("#")).map((l) => l.split("\t")[0]!),
);
const marry = new Set(
    readFileSync(join(HERE, "..", "..", "data", "languages", "english-gb", "en-gb-marry.tsv"), "utf8")
        .split("\n").filter((l) => l.includes("\t") && !l.startsWith("#")).map((l) => l.split("\t")[0]!),
);
/**
 * ⚠ `--jobs N` SHARDS THE CLAIM LOOP ACROSS N CHILD PROCESSES, the same device and the same reason as
 * `eval.ts`: `phonemizeWordRules` is CPU-bound and single-threaded, and this loop runs it over all 76,284
 * referee rows, so the builder used ONE core of however many the machine has and took minutes.
 * ⚠ ONLY THE CLAIM LOOP SHARDS. The propagation pass below needs the FULL membership of every set, so it
 * runs once in the parent — it is ~750 candidates against 76,284 rows, so there is nothing to win there.
 * ⚠ AND THE OUTPUT MUST BE BYTE-IDENTICAL TO `--jobs 1`, which test/engb-sets-shard.test.ts gates on the
 * MEMBERSHIPS, not on five totals. What makes it so is that each word appears in exactly ONE referee row,
 * so a merge cannot double-claim, and propagation is order-independent WITHIN a set (two lemmas proposing
 * the same inflection put it in the same place) while the order ACROSS sets is fixed in the loop.
 */
const jIdx = process.argv.indexOf("--jobs");
// ⚠ CLAMPED, same reason as eval.ts: each shard is a child process that loads the engine, so an
// unbounded `--jobs` is a fork bomb with a dictionary in each one.
const jobs = jIdx >= 0
    ? Math.min(Math.max(1, Math.trunc(Number(process.argv[jIdx + 1]) || 1)), availableParallelism())
    : 1;
/** ⚠ AND THE PARENT MUST NOT ALSO RUN THE LOOP. It did, for one measurement: `--jobs 12` was 7m19 wall
 *  against 27m of CPU, because the parent walked all 76,284 rows AND THEN spawned twelve children to walk
 *  them again. A single shard is 32s, so the whole claim loop should be ~35s; the 6m40 tail was the
 *  parent's own duplicate pass, and every number it produced was correct, which is why it did not show up
 *  as anything but slowness. */
const shardArg = process.argv.indexOf("--shard");
const delegating = jobs > 1 && shardArg < 0;
const [shardI, shardN] = shardArg >= 0
    ? (process.argv[shardArg + 1] ?? "0/1").split("/").map(Number) as [number, number]
    : [0, 1];
let rowIndex = -1;
for (const row of delegating ? [] : rows) {
    rowIndex++;
    if (rowIndex % shardN !== shardI) continue;
    const w = row[0]!;
    if (owned.has(w)) continue;
    const refRaw = row.slice(1);
    const refFolded = refRaw.map((r) => fold(r));
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
        // ⚠ AND THE DISCRIMINATOR HAS TO IGNORE THE WEAK VOWEL, OR IT LEAKS. `comet` is the specimen: the
        // referee lists `kɑmət` (American) AND `kɒmɪt` (British), so the guard should refuse it — but our
        // form folds to `kɒmət` and the British row to `kɒmɪt`, they differ on the REDUCED vowel alone, the
        // guard saw no match and PALM claimed the word off the American row. It shipped `kʰˈɑːmət` on
        // `main`, and #1390's propagation then carried the error into `comets` and into the golden, which
        // is how it was found. `ə`, `ɪ` and `ᵻ` are one slot for this comparison — the same equivalence
        // the `ᵻ → ɪ` fold in en-GB.jsonc already asserts, one symbol short.
        if (set === palm && refFolded.some((r) => weak(r) === weak(fold(ours)))) continue;
        // ⚠ A BATH CLAIM MAY NOT REST SOLELY ON A LENGTH-LESS ɑ ROW (#1391). The backbone strips LENGTH,
        // so an American `plɑtfɔːm` is indistinguishable from an RP `plɑːtfɔːm` once folded — and this
        // corpus writes `ɑː` for 5,024 headwords against a length-less `ɑ` for 1,130, so the two are
        // CONVENTIONS, not free variation. 58 BATH members were claimed with every supporting row written
        // the short way, and they are overwhelmingly foreign proper nouns and loanwords (`nanjing`,
        // `taqueria`, `plattdeutsch`, `zemlyanka`) plus a handful of ordinary English words the claim gets
        // audibly wrong: `platform`, `fang`, `dramatize` and `dan`, all shipped with the long vowel.
        // ⚠ THE TEST IS NOT POSITIONAL, unlike the yod probe above, and that is an APPROXIMATION: it asks
        // whether the row spells a long ɑ ANYWHERE, not whether the segment this edit produced is the one
        // spelled long. A row with two back vowels could satisfy it on the unrelated one. Measured on this
        // tree the only BATH member whose matching row mixes both spellings is `parang` (`pɑɹɑːŋ`), where
        // the long vowel IS the edited one — so the approximation is latent, not live, and is written down
        // rather than left for someone to discover.
        // ⚠ IT IS THE SAME SHAPE AS #1383's RHOTIC TELL and the same remedy: a row written in the other
        // variety's convention is not evidence about this one. #1391 names this as the prerequisite.
        // ⚠ AND IT IS "SOLELY", NOT "AT ALL". `chance`, `path` and `bath` itself all have a length-less or
        // TRAP row BESIDE a proper `ɑː` one, and they are real BATH words — the policy of preferring the
        // RP-diagnostic realisation whenever it is ATTESTED is unchanged. Only claims with no properly
        // spelled support at all are refused.
        if (set === bath && !refRaw.some((r, i) => refFolded[i] === fold(e) && /ɑː/u.test(r))) continue;
        set.push(w); claimed++; break;
    }
}

if (shardArg >= 0) {
    // ⚠ `writeSync` TO FD 1, NOT `process.stdout.write` + `process.exit`. stdout is a PIPE here (the
    // parent spawns with `stdio: [..., "pipe", ...]`), so it is asynchronous, and `process.exit` does not
    // flush pending writes — past whatever libuv hands the kernel in one go the tail is simply dropped and
    // the parent fails in `JSON.parse` on a payload that grows with the sets.
    writeSync(1, JSON.stringify({ bath, cloth, yod, palm, lotr, claimed }));
    process.exit(0);
}

// ⚠ REPORTED ON STDERR SO THE SHARD TEST CAN PROVE IT ACTUALLY SHARDED. `jobs` is CLAMPED to the core
// count, so on a one-core runner `--jobs 3` silently becomes the serial path and an equivalence test
// comparing it against `--jobs 1` passes while exercising nothing — green for exactly the bug it exists
// to catch.
console.error(`[jobs] effective ${jobs}`);
if (jobs > 1) {
    const { spawn } = await import("node:child_process");
    const parts = await Promise.all(Array.from({ length: jobs }, (_, i) => new Promise<{
        bath: string[]; cloth: string[]; yod: string[]; palm: string[]; lotr: string[]; claimed: number;
    }>((res, rej) => {
        const child = spawn("npx", ["tsx", fileURLToPath(import.meta.url), "--shard", `${i}/${jobs}`,
            ...(limit === Infinity ? [] : ["--limit", String(limit)])],
            { stdio: ["ignore", "pipe", "inherit"] });
        // ⚠ `setEncoding`, NOT `d.toString()` PER CHUNK — a code point straddling a read boundary would be
        // decoded as two halves and become U+FFFD. The headwords are ASCII today; the payload is not the
        // place to rely on that.
        let buf = "";
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (d: string) => { buf += d; });
        child.on("error", rej);
        child.on("close", (code) => {
            if (code !== 0) { rej(new Error(`shard ${i} exited ${code}`)); return; }
            try { res(JSON.parse(buf)); } catch (e) { rej(e as Error); }
        });
    })));
    bath.length = 0; cloth.length = 0; yod.length = 0; palm.length = 0; lotr.length = 0; claimed = 0;
    for (const part of parts) {
        bath.push(...part.bath); cloth.push(...part.cloth); yod.push(...part.yod);
        palm.push(...part.palm); lotr.push(...part.lotr); claimed += part.claimed;
    }
}
// ⚠ THIS SORT IS FOR REPRODUCIBLE `--explain` OUTPUT, AND IT IS *NOT* WHAT MAKES `--jobs N` SAFE. The
// comment here used to claim it was — that an unsorted merge would make the shards disagree — and the
// guard DISPROVED IT: deleting this line leaves engb-sets-shard.test.ts passing, because propagation is
// order-independent within a set and the order across sets is fixed in the loop above. Kept because the
// `--explain` lines are read in order when adjudicating a veto, corrected because a comment a test
// contradicts is worse than no comment.
for (const set of [bath, cloth, yod, palm, lotr]) set.sort();

/**
 * PROPAGATE MEMBERSHIP ACROSS REGULAR INFLECTIONS (#1390).
 *
 * ⚠ THE CLAIM LOOP ABOVE DECIDES ONE SURFACE WORD AT A TIME, SO PARADIGMS SPLIT — `transit` is BATH and
 * `transits` is not, so one sentence carries both vowels for one word. 751 inflections were outside their
 * lemma's set before this pass. It is the class #1385 treated as a BLOCKER for the hand-written table
 * (`clerk` right and `clerks` wrong in one utterance); the generated sets had it at 30× the scale.
 *
 * ⚠ IT IS A CLAIM THE REFEREE CAN VETO, NOT AN OVERRIDE. The lemma's evidence is what carries the
 * inflection — most inflections have NO referee row at all, which is exactly why the claim loop could not
 * reach them — but where the referee DOES speak about the inflection it decides. The veto: it attests
 * what we already produce and does NOT attest the edited form. Attesting BOTH is not a veto, because the
 * builder's stated policy is to prefer the RP-diagnostic realisation whenever it is attested.
 *
 * ⚠ AND PALM KEEPS ITS STRICTER RULE HERE TOO. PALM is the one edit that runs AWAY from RP (`ɒ → ɑː`,
 * toward the GenAm LOT vowel) and the fold strips length, so an American row is indistinguishable from an
 * RP one. A referee that attests our un-edited form at all vetoes a PALM propagation, exactly as it
 * blocks a PALM claim.
 */
const inflectionsOf = new Map<string, string[]>();
for (const w of dictWords) for (const l of lemmaCandidates(w)) {
    if (!dictWords.has(l)) continue;
    { const at = inflectionsOf.get(l); if (at) at.push(w); else inflectionsOf.set(l, [w]); }
}
let propagated = 0, vetoed = 0, inert = 0, notTheLemma = 0;
/**
 * ⚠ THE AUDIT PROPOSES A LEMMA AND THE PHONOLOGY HAS TO CONFIRM IT. Stripping a suffix over-generates on
 * purpose, and the dictionary alone does not settle it: `pasting` proposes BOTH `past` and `paste`, and
 * both are dictionary words. Propagating from the wrong one puts `pɑːst`'s BATH membership onto a word
 * that is read `pʰeᶦstɪŋ`. The confirmation is that the lemma's own reading is a PREFIX of the
 * inflection's, once the parent's suffix-conditioned allophony is folded away — aspiration, l-darkness,
 * the tapped coronal, stress marks and the weak vowel, none of which a raw prefix test can see.
 * `paste` peᶦst ✓ against `pasting` pʰeᶦstɪŋ; `past` pɑːst ✗. Prove the correspondence, or decline it.
 *
 * ⚠ AND IT FOLDS THE UNSTRESSED WEAK VOWEL, WHICH COSTS NOTHING AND IS NOT OPTIONAL. The parent spells
 * the same reduced slot `ə`, `ɪ` and `ᵻ` in different members of one paradigm — `altitude` ˈæɫltətʰˌuːd
 * beside `altitudes` ˈæɫltɪtʰˌuːdz — which is this repo's own weak-vowel question and NOT evidence of a
 * different lemma. Unfolded it rejected 177 candidates, most of them real paradigms.
 * ⚠ ONLY THE UNSTRESSED ONE. A STRESSED vowel is exactly what tells `past` pɑːst from `paste` peᶦst, so
 * the fold is gated on not following a stress mark — fold it wholesale and the guard stops guarding.
 *
 * ⚠ AND THE SYLLABIC CONSONANT HAS TO BECOME A VOWEL BEFORE ANYTHING ELSE, which is the same rule and
 * the same reason as `en-GB.jsonc`'s preFold — the parent writes one member of a paradigm with `ɫ̩`/`n̩`
 * and the next with `əɫ`/`ən`: `castle` kʰˈæsɫ̩ beside `castles` kʰˈæsəɫz, `advancement` ədvˈænsmn̩t
 * beside `advancements` ədvˈænsmənts. Without it the guard rejected both as different lemmas.
 * ⚠ THIS IS THE FIFTH TIME IN THIS REPO A NUCLEUS TEST HAS FORGOTTEN SYLLABIC CONSONANTS — the en-GB CODA
 * rule, onset-r.test.ts, the Moby rhotic counter and four drafts of the en-GB `excludeRows` regex. The
 * lesson that keeps not taking: define the nucleus ONCE, and verify against known-GOOD rows as well as
 * known-bad. The breve and ʌ/ə are the same shape: notation the parent varies within one paradigm.
 */
const bare = (x: string): string =>
    x.replace(/(\S)̩/gu, "ə$1").replace(/̆/gu, "")
        .replace(/(?<![ˈˌ])[əɪᵻ]/gu, "ə")
        .replace(/[ˈˌʰ]/gu, "").replace(/[ʌɐɜ]/gu, "ə")
        .replace(/ɫ/gu, "l").replace(/t̬/gu, "t").replace(/d̬/gu, "d");
/** `--explain` prints the two classes the propagation does NOT take, which is where its judgement lives. */
const explain = process.argv.includes("--explain");
const inSomeSet = new Set<string>([...bath, ...cloth, ...yod, ...palm, ...lotr]);
const refOf = new Map(rows.map((r) => [r[0]!, r.slice(1)]));
/**
 * ⚠ THE YOD EDIT IS SPELLED OUT HERE BECAUSE THE VETO NEEDS SOMETHING TO TEST, and the first draft left it
 * `undefined` — so `e === ours`, the veto's `!refFolded.includes(fold(e))` was never true, and yod could
 * not be vetoed AT ALL. Measured, that was not a theoretical hole: of the 15 propagated words the referee
 * has rows for, EIGHT went HIT → MISS and every one of them was yod (`alluded`, `stewed`, `suited`,
 * `plumes`, …). The referee attests `əluːdɪd` and the propagation was inserting a glide into it.
 * This is the SAME replace the runtime applies at english-gb.ts:293, so the veto tests what will ship.
 */
const YOD_EDIT = (x: string): string => x.replace(/([tdnszθl])(ʰ?)([ˈˌ]?)uː/u, "$1$2j$3uː");
for (const [set, edit, name] of [[yod, YOD_EDIT, "yod"], ...edits.map(([s, e], i) => [s, e, ["bath", "cloth", "lotr", "palm"][i]!])] as [string[], ((s: string) => string) | undefined, string][]) {
    for (const lemma of [...set]) {
        for (const w of inflectionsOf.get(lemma) ?? []) {
            if (owned.has(w) || inSomeSet.has(w)) continue;
            const rules = phonemizeWordRules(w);
            if (!bare(rules).startsWith(bare(phonemizeWordRules(lemma)))) {
                notTheLemma++;
                if (explain) console.log(`  NOT-LEMMA ${name.padEnd(5)} ${lemma} ${phonemizeWordRules(lemma)} is not the lemma of ${w} ${rules}`);
                continue;
            }
            const ours = marry.has(w) ? rules.replace(/ɛ(ˈ|ˌ)?ɹ/u, "æ$1ɹ") : rules;
            // yod carries no single-edit probe — its claim is positional — so the lemma's membership is the
            // whole evidence and the veto is only the referee contradicting the slot outright.
            if (name === "yod" && (!CORONAL_U.test(ours) || CORONAL_YOD.test(ours))) { inert++; continue; }
            const e = edit!(ours);
            if (e === ours) {
                inert++;
                if (explain) console.log(`  INERT ${name.padEnd(5)} ${lemma} -> ${w}   ours ${ours}`);
                continue;   // the edit has nothing to bite on
            }
            const refRaw2 = refOf.get(w) ?? [];
            const refFolded = refRaw2.map((r) => fold(r));
            // ⚠ THE SAME WEAK-VOWEL FOLD AS THE CLAIM GUARD ABOVE, and it was missing here for one review
            // round — the exact defect `comet` exposed, one page away, in the pass that AMPLIFIES it.
            const attestsOurs = refFolded.some((r) => weak(r) === weak(fold(ours)));
            // ⚠ AND BATH'S LENGTH TELL IS MIRRORED HERE FOR THE SAME REASON PALM'S STRICTER RULE IS. The
            // veto below only fires when the referee attests our UN-EDITED form — and an inflection whose
            // rows all spell the length-less `ɑ` does not attest it, so without this it would propagate in
            // exactly the evidence the claim loop refuses. The residue is 0 on this tree, which makes it a
            // hole rather than a defect; a dictionary change is all it would take to make it a defect.
            // ⚠ IT VETOES ON "THE SUPPORTING ROWS ARE ALL SHORT", NOT ON "NO ROW SUPPORTS US". The first
            // draft conflated the two and rejected `frances`, whose referee rows (`fɹænsɪz`, `fɹɑːnsɪz`)
            // are the plural of `france` while OUR row is the NAME Frances, `fɹˈɑːnsɪs` — nothing matched,
            // for a reason that has nothing to do with vowel length. The claim loop reaches its tell only
            // AFTER `refFolded.includes(fold(e))`, so the tell is additive there; here that precondition
            // has to be written out or the mirror becomes a much stronger rule wearing the tell's name.
            const supporting = refRaw2.filter((r, i) => refFolded[i] === fold(e));
            if (name === "bath" && supporting.length > 0 && !supporting.some((r) => /ɑː/u.test(r))) {
                vetoed++;
                if (explain) console.log(`  VETO  bath  ${lemma} -> ${w}   supporting rows all short: ${supporting.join(" | ")}`);
                continue;
            }
            if (refFolded.length > 0 && attestsOurs &&
                (name === "palm" || !refFolded.some((r) => weak(r) === weak(fold(e))))) {
                vetoed++;
                if (explain) console.log(`  VETO  ${name.padEnd(5)} ${lemma} -> ${w}   ours ${fold(ours)}  edit ${fold(e)}  ref ${refFolded.join(" | ")}`);
                continue;   // the referee vetoes
            }
            set.push(w); inSomeSet.add(w); propagated++;
        }
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
/** ⚠ `--dump` PRINTS THE MEMBERSHIPS THEMSELVES, so shard equivalence can be gated on CONTENTS rather
 *  than on counts — two different merges can agree on five totals and disagree on who is in them. */
if (process.argv.includes("--dump")) {
    const out: string[] = [];
    for (const [name, words] of [["bath", bath], ["cloth", cloth], ["yod", yod], ["palm", palm], ["lotr", lotr]] as [string, string[]][])
        for (const w of [...words].sort()) out.push(`${name}\t${w}`);
    writeSync(1, `${out.join("\n")}\n`);   // synchronous, for the same reason as the shard payload above
    process.exit(0);
}
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
    if (limit !== Infinity) throw new Error("--limit is a test device and must not write the shipped sets");
    writeFileSync(path, body);
    console.log(`  ${file}: ${words.length}`);
};
write("en-gb-bath.tsv", bath);
write("en-gb-cloth.tsv", cloth);
write("en-gb-yod.tsv", yod);
write("en-gb-palm.tsv", palm);
write("en-gb-lotr.tsv", lotr);
console.log(`lexical-set words claimed ${claimed} of ${rows.length}`);
console.log(`paradigm propagation: +${propagated} inflections  (${vetoed} vetoed by the referee, ${notTheLemma} where the proposed lemma is not the real one, ${inert} with nothing for the edit to bite on)`);
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
