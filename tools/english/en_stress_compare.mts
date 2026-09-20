/**
 * THE STRESS AXIS OF THE TRIPLE-SOURCE AUDIT — the one class `en_source_compare.mts` is blind to by
 * construction.
 *
 * That audit's `normalise()` strips stress before comparing, and it has to: keeping it made the
 * top-frequency hits almost entirely FUNCTION WORDS differing only in the digit (`of` AH1 V against
 * AH0 V), which this engine de-accents at the phrase layer anyway. The price is that **no pure stress
 * error has ever been a candidate in any run of that audit**, and its own `iə / jə` predicate says so
 * in a comment: `eosinophilia` was rejected as a glide variant while carrying two primary stresses.
 *
 * So this is the mirror instrument. Same two referees, same population, opposite projection:
 *
 *   en_source_compare   segments, stress stripped     → 684 candidates
 *   en_stress_compare   stress, segments already agreed → this file
 *
 *   MOBY=/path/to/mobypron.unc GOLD=/path/to/us_gold.json npx tsx tools/english/en_stress_compare.mts
 *
 * ⚠ THE POPULATION IS THE `agree` BUCKET, NOT THE WHOLE DICTIONARY, and that is the load-bearing
 * choice. A stress difference on a word the three sources READ differently is a symptom, not a
 * finding — `abaca` gold `ˈæbəkˌɑ` against our `əbˈɑkə` is a different word, and counting it as a
 * stress defect is failure mode (b), a measurement over a population that cannot support it. The
 * multi-primary investigation made exactly this mistake once and got 17,188 for a class of 8,053.
 * Requiring the SEGMENTS to agree first is what turns it into a stress question.
 *
 * ⚠ AND THE COMPARISON IS THE PRIMARY'S POSITION, NOT THE DIGIT STRING. Two reasons, both measured:
 *
 *   1. THE SECONDARY IS A CONVENTION GAP, NOT A DEFECT CLASS. Inside this very bucket gold marks a
 *      secondary we do not on 2,942 words and we mark one gold does not on 1,271, against 28,839
 *      where the counts match. A referee cannot arbitrate a notation difference it is one side of.
 *   2. A SECONDARY MARK DOES NOT SURVIVE THE PIPELINE INTACT ANYWAY. The clash rule in
 *      `englishArpabet.ts` deletes a `2°` adjacent to the primary, so comparing digit strings would
 *      measure against a form the engine cannot emit — failure mode (d).
 *
 * ⚠ "THE PRIMARY" IS THE **LAST** STRESS-1 NUCLEUS, because that is the one `singlePrimary` keeps.
 * 289 rows in this bucket carry more than one — CMUdict declines to resolve compounds and prefixed
 * forms (`B EY1 S B AO1 L`) — and the engine resolves them to the last. Taking the first instead
 * would score the engine against a reading nothing produces.
 *
 * ⚠ A ROW WITH NO PRIMARY AT ALL HAS NO PLACEMENT TO COMPARE, AND IT IS A DEFECT ON ITS OWN TERMS.
 * 103 dict rows of two or more syllables carry no stress-1. A first version of this file scored them at
 * nucleus 0 "because `enforceSinglePrimary` promotes the first vowel", and that model is WRONG in three
 * ways at once, which is why it is written out here rather than quietly corrected:
 *
 *   1. `enforceSinglePrimary` DOES NOT RUN ON THE DICTIONARY PATH. Its four call sites are the tagger and
 *      the compound / morph / n-gram decoders. Its own comment says the promotion half lives there
 *      because "only a predictor can return zero primaries: a dictionary row always has one" — an
 *      invariant 103 rows violate, which is the same shape as the multi-primary guard that was missing
 *      from one of two paths in #1323.
 *   2. WHAT ACTUALLY RESCUES SUCH A WORD IS `promoteFirstVowel` IN `english.ts`, and it is CLAUSE-scoped:
 *      it fires only when the whole clause has no primary. In running text it usually does not fire, and
 *      the word ships with no tonic — `the antipode of gold` → `ðə ˌæntɪpʰˌoᶷd ʌv ɡˈoᶷɫd`.
 *   3. AND WHERE IT DOES FIRE IT IS NOT NUCLEUS 0. It inserts before the first IPA VOWEL CHARACTER, and
 *      `ᵻ` is not one — `bespoken` takes the mark on nucleus 1 — and on a row whose first nucleus already
 *      carries a secondary it emits the malformed pair `ˌˈ` (`antipode` → `ˌˈæntɪpʰˌoᶷd`).
 *
 * So `primaryNucleus` ABSTAINS on such a row, exactly as it does on a monosyllable, and the row is
 * reported on the `malformed` track instead. Where both referees agree on a placement it is a candidate
 * WHATEVER that placement is, because any tonic beats none — 9 of the 103 are reachable that way. The
 * other 94 are not "right by accident"; they are unadjudicated and this instrument has nothing to say
 * about them. They are counted so the class has a size, not so it has a verdict.
 *
 * ⚠ THE REFEREES MUST ACTUALLY CARRY A PRIMARY, and this guard is load-bearing ON THE MOBY SIDE.
 * The same nucleus-0 fallback applied to a source would INVENT evidence — "the source puts it on the
 * first syllable" when the source marked nothing at all. 28,646 of Moby's rows carry no `'` anywhere,
 * and 156 of them land inside this bucket; gold, measured, always marks one, so the guard never fires
 * on that side. A source row with no primary is dropped from the vote rather than defaulted.
 *
 * ⚠ AND A CANDIDATE'S REMEDY MOVES ONLY THE PRIMARY. The agreed form is gold's, and gold's row also
 * carries gold's segments and gold's secondaries, neither of which this relation adjudicates. #1377
 * earned that rule the other way round — 11 rows there moved primary stress on an agreement that was
 * stress-blind, and one of them (`mosel`) was wrong. Apply only the part of the agreed form the
 * agreement can see.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    MOBY_DEFECTIVE_READING, VOWELS, goldToArpabet, mobyToArpabet, modernise, normalise,
} from "./en_source_compare.mts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The stress digits on the vowel nuclei, in order — the row's stress pattern with the segments removed. */
export function stressPattern(a: readonly string[]): string[] {
    return a.filter((p) => VOWELS.has(p.replace(/[0-2]$/u, ""))).map((p) => p.slice(-1));
}

/**
 * Which nucleus the ENGINE will pronounce as the primary: the last stress-1, or nucleus 0 when the row
 * has none. `undefined` for a monosyllable, which has no stress PLACEMENT to disagree about.
 */
export function primaryNucleus(a: readonly string[]): number | undefined {
    const p = stressPattern(a);
    if (p.length < 2) return undefined;
    const i = p.lastIndexOf("1");
    return i >= 0 ? i : undefined;
}

/** A row of two or more syllables carrying no stress-1 at all: no tonic, on any path. See the header. */
export function malformed(a: readonly string[]): boolean {
    const p = stressPattern(a);
    return p.length >= 2 && !p.includes("1");
}

/** The same, for a REFEREE. Identical to {@link primaryNucleus} now that neither invents a placement;
 *  kept as its own name because the two abstain for DIFFERENT reasons — ours because the engine emits no
 *  tonic, a source's because it recorded none — and a future change to one must not silently move the other. */
export function refereePrimary(a: readonly string[]): number | undefined {
    const p = stressPattern(a);
    if (p.length < 2) return undefined;
    const i = p.lastIndexOf("1");
    return i >= 0 ? i : undefined;
}

/**
 * Our row with the primary moved to nucleus `to` — the ONLY edit this audit's evidence licenses.
 *
 * Every other digit is left exactly as ours. The vacated primary becomes a SECONDARY rather than
 * unstressed: that is not a guess, it is what both referees write there on 231 of the 233 candidates
 * (`outbid` AW1 T B IH2 D → AW2 T B IH1 D, gold and Moby both `AW2`), and it is also what
 * `singlePrimary` already does to the extra primary of a two-primary row.
 */
export function moveprimary(a: readonly string[], to: number): string[] {
    let n = -1;
    return a.map((p) => {
        const b = p.replace(/[0-2]$/u, "");
        if (!VOWELS.has(b)) return p;
        n++;
        if (n === to) return `${b}1`;
        return p.endsWith("1") ? `${b}2` : p;
    });
}

/**
 * INFLECTIONAL SIBLINGS OF `w` THAT THE DICTIONARY CARRIES — the check that says whether correcting a
 * lemma leaves it contradicting its own paradigm.
 *
 * ⚠ INFLECTION ONLY, AND THE LINE IS LOAD-BEARING. A DERIVATIONAL suffix may legitimately move the
 * primary — `government` → `governmental` is the correct English alternation — so a first version that
 * also enumerated `-ly`, `-ment`, `-al` and `-ness` reported 32 false alarms against 27 real ones.
 *
 * ⚠ AND E-ELISION IS NOT OPTIONAL. A first version concatenated the suffix and nothing else, so
 * `overcome` + `ing` was looked up as `overcomeing`, found nothing, and reported the paradigm clean —
 * while the dictionary carried `overcoming` fore-stressed against a corrected `over·COME`. Ten rows
 * shipped that way, which is the very split the sweep exists to prevent. `-ed`/`-es` after an `e` take
 * the same elision (`outpace` → `outpaced`, not `outpaceed`), and `-y` → `-ies`/`-ied` is here for the
 * same reason even though no candidate has yet needed it.
 */
export function inflections(w: string): string[] {
    const out = new Set<string>();
    for (const suf of ["s", "es", "ed", "d", "ing"]) out.add(w + suf);
    if (w.endsWith("e")) for (const suf of ["ing", "ed", "es"]) out.add(w.slice(0, -1) + suf);
    if (w.endsWith("y") && w.length > 2 && !"aeiou".includes(w[w.length - 2]!))
        for (const suf of ["ies", "ied"]) out.add(w.slice(0, -1) + suf);
    out.delete(w);
    return [...out];
}

export interface StressCandidate {
    rank: number; word: string; ours: string[]; want: string[]; at: number; to: number;
}

export function stressAudit(dictPath: string, freqPath: string, goldPath: string, mobyPath: string): {
    bucket: number; polysyllabic: number; candidates: StressCandidate[];
    allAgree: number; mobyBacksUs: number; mobyContradictsGold: number; mobySplit: number;
    goldSilent: number; mobyAllSilent: number; mobySomeSilent: number;
    noPrimary: number; noPrimaryJudged: number;
    secondaryGoldMore: number; secondarySame: number; secondaryUsMore: number;
} {
    const het = new Set<string>(Object.keys(JSON.parse(
        readFileSync(join(REPO, "data/languages/english/english.jsonc"), "utf8")
            .replace(/^\s*\/\/.*$/gmu, "").replace(/,(\s*[}\]])/gu, "$1"),
    ).heteronyms as Record<string, unknown>));
    const dict = new Map<string, string[]>();
    for (const l of readFileSync(dictPath, "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [w, p] = l.split("\t");
        dict.set(w!.toLowerCase(), p!.split(" "));
    }
    const gold: Record<string, unknown> = JSON.parse(readFileSync(goldPath, "utf8"));
    const goldOf = (w: string): string | undefined => {
        const v = gold[w] ?? gold[w[0]!.toUpperCase() + w.slice(1)];
        return typeof v === "string" ? v : undefined;
    };
    const moby = new Map<string, string[][]>();
    for (const line of readFileSync(mobyPath, "latin1").split(/\r\n|\r|\n/u)) {
        const sp = line.indexOf(" ");
        if (sp < 0) continue;
        const w = line.slice(0, sp).toLowerCase();
        if (MOBY_DEFECTIVE_READING.get(w)?.has(line.slice(sp + 1))) continue;
        const a = mobyToArpabet(line.slice(sp + 1), w);
        if (a) (moby.get(w) ?? moby.set(w, []).get(w)!).push(a);
    }
    const rank = new Map<string, number>();
    readFileSync(freqPath, "utf8").split("\n").map((s) => s.trim())
        .filter((s) => s && !s.startsWith("#")).forEach((w, i) => { if (!rank.has(w)) rank.set(w, i); });

    const candidates: StressCandidate[] = [];
    // ⚠ EVERY POLYSYLLABIC ROW IN THE BUCKET LANDS IN EXACTLY ONE OF THESE COUNTERS, and the report
    // asserts that rather than assuming it. A first version printed four of them under a stated
    // denominator they did not sum to: `mobySilent` overlapped every other bucket, rows dropped for
    // having no Moby vote at all had no counter, and the rows where all three agree had none either.
    // A breakdown that reads as a partition and is not one is failure mode (c) in the output itself.
    let bucket = 0, polysyllabic = 0;
    let allAgree = 0, mobyBacksUs = 0, mobyContradictsGold = 0, mobySplit = 0;
    let goldSilent = 0, mobyAllSilent = 0, mobySomeSilent = 0;
    let noPrimary = 0, noPrimaryJudged = 0;
    let secondaryGoldMore = 0, secondarySame = 0, secondaryUsMore = 0;
    for (const w of [...dict.keys()].sort()) {
        const ours = dict.get(w)!, g = goldOf(w), m = moby.get(w);
        if (malformed(ours)) noPrimary++;
        if (!g || !m || het.has(w)) continue;
        const ga = goldToArpabet(g);
        if (!ga) continue;
        const o = normalise(ours);
        if (normalise(ga) !== o) continue;
        // ⚠ ONLY THE MOBY READINGS WHOSE SEGMENTS MATCH may vote. Moby's bucket holds every reading for
        // the lower-cased key, and a case-distinct second headword is a DIFFERENT WORD; letting it vote
        // on stress would compare our row against the other word's syllable count.
        const mm = m.map((p) => modernise(p)).filter((p) => normalise(p) === o);
        if (mm.length === 0) continue;
        bucket++;
        if (stressPattern(ours).length < 2) continue;      // a monosyllable has no placement
        polysyllabic++;
        const sg = stressPattern(ga).filter((x) => x === "2").length;
        const so = stressPattern(ours).filter((x) => x === "2").length;
        if (sg > so) secondaryGoldMore++; else if (sg === so) secondarySame++; else secondaryUsMore++;

        const pg = refereePrimary(ga);
        if (pg === undefined) { goldSilent++; continue; }
        const pms = mm.map(refereePrimary).filter((x): x is number => x !== undefined);
        if (pms.length === 0) { mobyAllSilent++; continue; }
        if (pms.length < mm.length) mobySomeSilent++;       // ⚠ REPORTED, NOT A BUCKET — it overlaps them all

        // ⚠ A MALFORMED ROW IS A CANDIDATE WHATEVER PLACEMENT THE REFEREES AGREE ON, because it carries
        // no tonic on any path (see the header). It has nothing to compare, so it does not pass through
        // the three verdicts below.
        if (malformed(ours)) {
            noPrimaryJudged++;
            if (pms.includes(pg)) candidates.push({ rank: rank.get(w) ?? -1, word: w, ours, want: moveprimary(ours, pg), at: -1, to: pg });
            else mobyContradictsGold++;
            continue;
        }
        const po = primaryNucleus(ours)!;
        if (pg === po) { if (pms.includes(po)) allAgree++; else mobySplit++; continue; }
        // ⚠ THESE ARE TWO DIFFERENT VERDICTS AND THEY WERE ONE COUNTER. `!pms.includes(pg) ||
        // pms.includes(po)` fires both when Moby RECORDS OUR PLACEMENT and when Moby agrees with neither
        // of us, and the report printed the sum under the first label — so a row where gold says 1, we
        // say 0 and Moby says 2 was counted as Moby endorsing our row. The candidate set never depended
        // on the split, which is exactly how a wrong number sat in the output of an instrument whose
        // entire purpose is to be read.
        if (pms.includes(po)) { mobyBacksUs++; continue; }
        if (!pms.includes(pg)) { mobyContradictsGold++; continue; }
        candidates.push({ rank: rank.get(w) ?? -1, word: w, ours, want: moveprimary(ours, pg), at: po, to: pg });
    }
    // ⚠ ASSERTED, NOT DOCUMENTED. The five verdicts plus the two abstentions plus the malformed track
    // must account for every polysyllabic row, or a bucket has silently started overlapping another.
    // ⚠ `noPrimaryJudged` ALREADY CONTAINS ITS OWN CANDIDATES, so only the PLACEMENT candidates are
    // added here. Writing `candidates.length` counted the malformed ones twice and the assertion caught
    // it on the first run, which is the argument for having written the assertion rather than a comment.
    const accounted = allAgree + mobyBacksUs + mobyContradictsGold + mobySplit
        + goldSilent + mobyAllSilent + noPrimaryJudged + candidates.filter((c) => c.at >= 0).length;
    if (accounted !== polysyllabic) throw new Error(`buckets do not partition: ${accounted} vs ${polysyllabic}`);
    return {
        bucket, polysyllabic, candidates, allAgree, mobyBacksUs, mobyContradictsGold, mobySplit,
        goldSilent, mobyAllSilent, mobySomeSilent, noPrimary, noPrimaryJudged,
        secondaryGoldMore, secondarySame, secondaryUsMore,
    };
}

/**
 * THE PARADIGM SWEEP — which inflected rows a correction has left contradicting their own lemma.
 *
 * ⚠ THIS BELONGS IN THE REPO AND NOT IN A SCRATCH FILE, which is how it came to be wrong. The first
 * version lived outside the tree, enumerated siblings by bare concatenation, and reported the paradigm
 * clean while ten `-ing` forms sat fore-stressed against corrected lemmas. A check whose result gates a
 * 321-row block has to be runnable by the next reader.
 *
 * ⚠ A SIBLING GOLD RECORDS AS A POS-CONDITIONED HETERONYM IS SKIPPED, and `undertaking` is why:
 * gold carries `{DEFAULT: ˈʌndəɹtˌAkɪŋ, VERB: ˌʌndəɹtˈAkɪŋ}`, our row is the noun, and it is RIGHT.
 * Propagating `under·TAKE` into it would have replaced a correct default with the verb reading — the
 * same `override` / `overriding` shape the curation gate already records, and the sweep found it only
 * because the heteronym check was added. The main audit skips these for the same reason.
 */
export function paradigmSweep(
    dict: ReadonlyMap<string, string[]>,
    before: ReadonlyMap<string, string[]>,
    goldRaw: Readonly<Record<string, unknown>>,
): { word: string; ours: string[]; want: string[]; of: string }[] {
    const conditioned = (w: string): boolean => {
        const v = goldRaw[w] ?? goldRaw[w[0]!.toUpperCase() + w.slice(1)];
        return typeof v === "object" && v !== null;
    };
    const moved = new Set([...dict.keys()].filter(
        (w) => before.has(w) && before.get(w)!.join(" ") !== dict.get(w)!.join(" ")));
    const out: { word: string; ours: string[]; want: string[]; of: string }[] = [];
    for (const w of [...moved].sort()) {
        const to = primaryNucleus(dict.get(w)!), from = primaryNucleus(before.get(w)!);
        if (to === undefined || from === undefined || to === from) continue;
        for (const d of inflections(w)) {
            const ph = dict.get(d);
            if (ph === undefined || moved.has(d) || conditioned(d)) continue;
            if (malformed(ph) || primaryNucleus(ph) !== from) continue;
            if (to >= stressPattern(ph).length) continue;
            out.push({ word: d, ours: ph, want: moveprimary(ph, to), of: w });
        }
    }
    return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const moby = process.env["MOBY"];
    if (!moby) throw new Error("set MOBY to a mobypron.unc path (Project Gutenberg #3205)");
    const gold = process.env["GOLD"] ?? "";
    if (!gold) throw new Error("set GOLD to a misaki us_gold.json path");
    const r = stressAudit(
        "data/languages/english/g2p-dict.tsv", "data/languages/english/g2p-common.txt", gold, moby,
    );
    console.log(`segments already agree (the audit's \`agree\` bucket):  ${r.bucket}`);
    console.log(`  of two or more syllables:                         ${r.polysyllabic}   ← the denominator below`);
    console.log(`PRIMARY PLACEMENT — these eight partition it, and the audit throws if they do not`);
    console.log(`  all three agree:                                  ${r.allAgree}`);
    console.log(`  gold AND Moby agree AGAINST us  (candidates):     ${r.candidates.length}`);
    console.log(`  gold differs, Moby records OUR placement:         ${r.mobyBacksUs}`);
    console.log(`  Moby agrees with neither of us:                   ${r.mobyContradictsGold}`);
    console.log(`  gold agrees with us, Moby differs:                ${r.mobySplit}`);
    console.log(`  gold marked no primary — abstains:                ${r.goldSilent}`);
    console.log(`  every matching Moby reading is unmarked:          ${r.mobyAllSilent}`);
    console.log(`  malformed and not a candidate:                    ${r.noPrimaryJudged - r.candidates.filter((c) => c.at < 0).length}`);
    console.log(`  (SOME matching Moby reading unmarked:             ${r.mobySomeSilent} — overlaps the rows above, not a bucket)`);
    console.log(`MALFORMED ROWS (no stress-1 at all, two or more syllables — no tonic on ANY path)`);
    console.log(`  in the whole dictionary:                          ${r.noPrimary}`);
    console.log(`  of those, ones both referees can vote on:         ${r.noPrimaryJudged}`);
    console.log(`    candidates (any tonic beats none):              ${r.candidates.filter((c) => c.at < 0).length}`);
    console.log(`SECONDARY MARKS — a convention gap, not adjudicated here`);
    console.log(`  gold marks more ${r.secondaryGoldMore}   same ${r.secondarySame}   we mark more ${r.secondaryUsMore}`);
    for (const [lab, lo, hi] of [["off-list", -1, 0], ["top 1k", 0, 1000], ["1k–5k", 1000, 5000], ["5k–20k", 5000, 20000], ["20k–40k", 20000, Infinity]] as const)
        console.log(`    ${lab.padEnd(9)} ${r.candidates.filter((c) => c.rank >= lo && c.rank < hi).length}`);
    for (const c of r.candidates.sort((a, b) => a.rank - b.rank))
        console.log(`${c.rank}\t${c.word}\t${c.ours.join(" ")}\t${c.want.join(" ")}\t${c.at}→${c.to}`);
}
