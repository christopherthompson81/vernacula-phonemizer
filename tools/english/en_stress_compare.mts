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
 * ⚠ A ROW WITH NO PRIMARY AT ALL IS SCORED AT NUCLEUS 0, because `enforceSinglePrimary` promotes the
 * first vowel. 103 dict rows of two or more syllables carry no stress-1 (`accredit`
 * `AH0 K R EH2 D AH0 T` → `ˈəkɹˌɛd̬ᵻt`). That fallback is faithful to the engine, and it means such a
 * row is a candidate only when the referees put the primary somewhere OTHER than the first syllable.
 * ⚠ AND THE REFEREES REACH ALMOST NONE OF THEM: only 9 of the 103 are in the compared bucket at all, 3
 * are candidates and 6 have the fallback the referees want. The remaining 94 are NOT "right by
 * accident" — they are unadjudicated, and this instrument has nothing to say about them. They are
 * counted here so the class has a size, not so it has a verdict.
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
    return i >= 0 ? i : 0;
}

/** The same, for a REFEREE: `undefined` unless the source actually marked a primary. See the header. */
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

export interface StressCandidate {
    rank: number; word: string; ours: string[]; want: string[]; at: number; to: number;
}

export function stressAudit(dictPath: string, freqPath: string, goldPath: string, mobyPath: string): {
    bucket: number; polysyllabic: number; candidates: StressCandidate[];
    mobyBacksUs: number; mobySplit: number; goldSilent: number;
    noPrimary: number; noPrimaryJudged: number; noPrimaryAgreed: number;
    mobySilent: number;
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
    let bucket = 0, polysyllabic = 0, mobyBacksUs = 0, mobySplit = 0, goldSilent = 0;
    let noPrimary = 0, noPrimaryJudged = 0, noPrimaryAgreed = 0, mobySilent = 0;
    let secondaryGoldMore = 0, secondarySame = 0, secondaryUsMore = 0;
    for (const w of [...dict.keys()].sort()) {
        const ours = dict.get(w)!, g = goldOf(w), m = moby.get(w);
        if (stressPattern(ours).length >= 2 && !stressPattern(ours).includes("1")) noPrimary++;
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
        const po = primaryNucleus(ours);
        if (po === undefined) continue;
        polysyllabic++;
        const sg = stressPattern(ga).filter((x) => x === "2").length;
        const so = stressPattern(ours).filter((x) => x === "2").length;
        if (sg > so) secondaryGoldMore++; else if (sg === so) secondarySame++; else secondaryUsMore++;
        const pg = refereePrimary(ga);
        if (pg === undefined) { goldSilent++; continue; }
        const pms = mm.map(refereePrimary).filter((x): x is number => x !== undefined);
        if (pms.length < mm.length) mobySilent++;
        if (pms.length === 0) continue;
        // The malformed rows the referees can actually speak to, and how the nucleus-0 fallback fares.
        if (!stressPattern(ours).includes("1")) { noPrimaryJudged++; if (pg === 0 && pms.includes(0)) noPrimaryAgreed++; }
        if (pg === po) { if (!pms.includes(po)) mobySplit++; continue; }
        // ⚠ MOBY MUST NOT ALSO CARRY OUR OWN PLACEMENT — the same true-positive filter the segmental
        // audit applies. A source that records our reading is not a source agreeing against us.
        if (!pms.includes(pg) || pms.includes(po)) { mobyBacksUs++; continue; }
        candidates.push({ rank: rank.get(w) ?? -1, word: w, ours, want: moveprimary(ours, pg), at: po, to: pg });
    }
    return {
        bucket, polysyllabic, candidates, mobyBacksUs, mobySplit, goldSilent,
        noPrimary, noPrimaryJudged, noPrimaryAgreed, mobySilent,
        secondaryGoldMore, secondarySame, secondaryUsMore,
    };
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
    console.log(`  of two or more syllables:                         ${r.polysyllabic}`);
    console.log(`  gold marks no primary — dropped from the vote:    ${r.goldSilent}`);
    console.log(`PRIMARY PLACEMENT, over the ${r.polysyllabic - r.goldSilent} the referees can vote on`);
    console.log(`  gold AND Moby agree AGAINST us:                   ${r.candidates.length}`);
    console.log(`  gold differs but Moby records our placement:      ${r.mobyBacksUs}`);
    console.log(`  gold agrees with us, Moby differs:                ${r.mobySplit}`);
    console.log(`  a matching Moby reading marks no primary:         ${r.mobySilent}`);
    console.log(`MALFORMED ROWS (no stress-1 at all, two or more syllables)`);
    console.log(`  in the whole dictionary:                          ${r.noPrimary}`);
    console.log(`  of those, ones both referees can vote on:         ${r.noPrimaryJudged}`);
    console.log(`    whose nucleus-0 fallback is what they want:     ${r.noPrimaryAgreed}`);
    console.log(`    a candidate (the fallback is wrong):            ${r.noPrimaryJudged - r.noPrimaryAgreed}`);
    console.log(`SECONDARY MARKS — a convention gap, not adjudicated here`);
    console.log(`  gold marks more ${r.secondaryGoldMore}   same ${r.secondarySame}   we mark more ${r.secondaryUsMore}`);
    for (const [lab, lo, hi] of [["off-list", -1, 0], ["top 1k", 0, 1000], ["1k–5k", 1000, 5000], ["5k–20k", 5000, 20000], ["20k–40k", 20000, Infinity]] as const)
        console.log(`    ${lab.padEnd(9)} ${r.candidates.filter((c) => c.rank >= lo && c.rank < hi).length}`);
    for (const c of r.candidates.sort((a, b) => a.rank - b.rank))
        console.log(`${c.rank}\t${c.word}\t${c.ours.join(" ")}\t${c.want.join(" ")}\t${c.at}→${c.to}`);
}
