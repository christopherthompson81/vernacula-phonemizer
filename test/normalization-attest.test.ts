/**
 * THE WORD BOUNDARY `attest.ts` TURNS ON — pinned in BOTH directions, because both are load-bearing and the
 * tool had been failing one of them silently for its whole life.
 *
 * ⚠ WHY THIS TEST EXISTS. `attest.ts` is one of the instruments that decides whether a word goes into a
 * speaker's mouth. Its `0 token / N substring-only` line reads as *unattested*, and this project's standing
 * rule is to leave an unattested word unauthored — so an under-reporting boundary does not produce a wrong
 * number, it produces a REFUSAL to author a word that the language actually uses.
 *
 * It was under-reporting. The tool split words on every non-letter, so any orthography that puts punctuation
 * INSIDE a word — Madurese's glottal `sampè'`, Oromo's `baay’isuu`, POJ's syllable hyphens in `Liap-sī`,
 * Malagasy's and Lingala's hyphenated compounds — was cut in half before the test ran and could never match.
 * Measured over `tools/corpus/attest/*.jsonc` at the time of the fix: of 522 recorded findings, ALL 11 whose
 * probed word contained an apostrophe or a hyphen came back `substring-only` with zero token hits, against an
 * 82% `attested` rate for plain words. Five languages, one bug, every verdict in the same direction.
 *
 * The opposite direction is the one the tool was BUILT to prevent, and the fix must not spend it: the file's
 * header records four occasions where a plain substring made an absent word look sourced (`lb Yen` inside
 * `Libyen`, `hr jen` inside `jendek`, `xh iiyeni` inside `yeNintendo`, `ff tere`). A false POSITIVE is worse
 * than a false negative here, because it lets a word be authored on evidence that is not there. So the
 * over-report cases below are not decoration — they are the reason the fix is a boundary and not a wider
 * split class.
 *
 * The fixtures are hand-written sentences in the shape of the orthography under test, not fetched wiki text,
 * so this test carries no third-party content and cannot rot when an article is edited.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { BLOCK_RE, fold, isHit, countHits, matchers, needsInsource, renderFinding } from "../tools/normalization/attest.ts";

describe("attest.ts — words whose orthography contains punctuation", () => {
    /** The reported case. `corpus-words.ts` scores this `attested ×14`; `attest.ts` said `0 token`. */
    test("a word-final glottal apostrophe is part of the word (mad)", () => {
        const text = "Bâkto lakonna ḍâri sobbhu sampè' pokol 10:00 bân ḍâri 1998 sampè' taon 2008.";
        expect(isHit("sampè'", text)).toBe(true);
        expect(countHits("sampè'", text)).toBe(2);
    });

    test("the wiki's apostrophe variant does not have to be the probe's (U+2019 vs U+0027)", () => {
        // mad.wikipedia writes the glottal with U+2019; the probe list and this repo write U+0027.
        const wiki = "bisa ḍâri tengnga malem sampe’ pokol 10:00, bisa ḍâri sobbhu sampe’ tengnga arè.";
        expect(isHit("sampè'", wiki)).toBe(true);
        expect(countHits("sampè'", wiki)).toBe(2);
        // …and symmetrically, a `’`-spelled probe finds a `'`-spelled text.
        expect(isHit("sampè’", "ḍâri sobbhu sampe' pokol 10:00")).toBe(true);
    });

    test("a word-internal glottal is part of the word (om)", () => {
        expect(isHit("baay’isuu", "Lakkoofsa kana baay’isuu ni dandeenya.")).toBe(true);
        expect(isHit("hir'isuu", "gatii hir’isuu qaba")).toBe(true);
    });

    test("POJ syllable hyphens do not end the word (nan)", () => {
        const text = "Liap-sī sī chi̍t ê tan-uī, kong-kin mā sī.";
        expect(isHit("Liap-sī", text)).toBe(true);
        expect(isHit("kong-kin", text)).toBe(true);
        expect(countHits("Liap-sī", text)).toBe(1);
    });

    test("hyphenated compounds are words (mg, ln)", () => {
        expect(isHit("isan-jato", "roa amby dimam-polo isan-jato amin'ny mponina")).toBe(true);
        expect(isHit("kilomɛtrɛ-kare", "etando ya kilomɛtrɛ-kare nkóto mibale")).toBe(true);
    });

    test("a ʼokina is a letter to Unicode and must still be foldable to the plain apostrophe", () => {
        // U+02BC and U+02BB are \p{Lm} — LETTERS — so a letters-only boundary walked straight past them and
        // welded the ʼokina to whatever stood beside it.
        expect(fold("Hawaiʻi")).toBe("hawai'i");
        expect(fold("sampè’")).toBe("sampe'");
        expect(isHit("Hawai'i", "ka mokupuni ʻo Hawaiʻi kekahi")).toBe(true);
    });
});

describe("attest.ts — the precision the tool exists for, unspent", () => {
    /** The four errors named in the file header. None may come back. */
    test("a word does not match inside a longer word", () => {
        expect(isHit("Yen", "Libyen, Webproxyen und moyen")).toBe(false);
        expect(isHit("jen", "jendek i jenjati")).toBe(false);
        expect(isHit("iiyeni", "isiXhosa yeNintendo iiyenika")).toBe(false);
        expect(isHit("tere", "o wonaa terekaali")).toBe(false);
    });

    test("an apostrophe glued to a letter is NOT a word boundary — the Libyen error via punctuation", () => {
        // If a trailing apostrophe merely ended the token, probing the bare stem would match the longer
        // word. It must not: `sampe'an` is a different word from `sampe`.
        expect(isHit("sampe", "kalaban sampe'an bân sampe’en")).toBe(false);
        expect(isHit("baay", "Lakkoofsa kana baay’isuu ni dandeenya.")).toBe(false);
        // The other side of the word, too.
        expect(isHit("ak", "bo w'ak bandeko na yé")).toBe(false);
    });

    test("a quotation mark or possessive apostrophe is still an ordinary boundary", () => {
        // A closing quote must not weld itself onto the quoted word and hide it…
        expect(isHit("ak", "the man said 'ak' and left")).toBe(true);
        // …and it must not manufacture a hit for a DIFFERENT word that happens to end in a glottal.
        expect(isHit("ak'", "the man said 'ak plainly'")).toBe(false);
        // An English possessive leaves the noun findable.
        expect(isHit("dogs", "the dogs' bowls")).toBe(true);
    });

    test("a hyphen is still a boundary — a compound's halves stay findable", () => {
        // ⚠ DELIBERATE ASYMMETRY WITH THE APOSTROPHE. A hyphen joins parts that are frequently words in
        // their own right, so rejecting a flanking hyphen would newly REFUSE `chit` inside `chit-ê` — a move
        // in the false-refusal direction, which is the failure this whole fix removes.
        expect(isHit("chit", "i ū chit-ê mi̍h-kiāⁿ")).toBe(true);
        expect(isHit("Nord", "die Nord-Süd-Achse")).toBe(true);
        expect(isHit("kare", "etando ya kilomɛtrɛ-kare")).toBe(true);
    });

    test("digits and punctuation are boundaries, not letters", () => {
        expect(isHit("pokol", "pokol 10:00 otabâ pokol 09:30")).toBe(true);
        expect(countHits("pokol", "pokol 10:00 otabâ pokol 09:30")).toBe(2);
        expect(isHit("koma", "(0,3-2,7%) koma, dan")).toBe(true);
    });

    test("diacritics fold but letters do not — the review gate's own rule", () => {
        expect(isHit("sentimeter", "panjhângnga 30 sèntimèter")).toBe(true);
        expect(isHit("sentimeter", "panjhângnga 30 sentimeters")).toBe(false);
    });
});

describe("attest.ts — the equivalence that makes this fix safe", () => {
    /**
     * For a probe made only of letters the new boundary and the OLD token-set membership are provably the
     * same test: a token was a maximal run of letters, so `w` was in the token set iff `w` occurred flanked
     * by non-letters. This pins that claim, which is what licenses the assertion that 511 of the 522
     * recorded findings cannot move.
     */
    const oldTokens = (text: string): Set<string> =>
        new Set(text.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "")
            .split(/[^\p{L}\p{M}]+/u).filter((t) => t !== ""));

    const CORPUS = [
        "Ang mga gilay-on sa 20 ka metros ibabaw sa dagat ug adunay 1000 ka molupyo.",
        "Dunia Tanpa Koma adalah serial televisi produksi rumah tangga, koma dan titik.",
        "die Nord-Süd-Achse ist größer als 12 Prozent, geteilt durch drei",
        "panjhângnga 30 sèntimèter, bâkto pokol 10:00 sampe’ pokol 12:00",
        "Libyen, Webproxyen und moyen — jendek i jenjati, yeNintendo",
    ].join(" ");

    test("plain letter-only words: new boundary agrees with the old token set, word for word", () => {
        const probes = ["metros", "molupyo", "koma", "serial", "nord", "süd", "prozent", "drei", "pokol",
            "sentimeter", "yen", "jen", "iiyeni", "libyen", "moyen", "dagat", "titik", "achse", "absent"];
        for (const p of probes) {
            expect([p, isHit(p, CORPUS)]).toEqual([p, oldTokens(CORPUS).has(fold(p))]);
        }
    });

    test("…and disagrees exactly where the word contains punctuation", () => {
        const text = "ḍâri sobbhu sampe’ pokol 10:00";
        expect(oldTokens(text).has(fold("sampè'"))).toBe(false); // the defect
        expect(isHit("sampè'", text)).toBe(true);               // the fix
    });
});

describe("attest.ts — phrases and unspaced scripts keep their existing contract", () => {
    test("a multi-word probe is a collocation, matched across whitespace", () => {
        const { phrase, bounded } = matchers("kiloomeeteer kaaree");
        expect(phrase).toBe(true);
        expect(bounded).toBe(true);
        expect(isHit("kiloomeeteer kaaree", "468 kiloomeeteer kaaree (181 mi kaaree)")).toBe(true);
        expect(isHit("kiloomeeteer kaaree", "468 kiloomeeteer  kaaree")).toBe(true);
        // The bare modifier is never the attestation: the phrase must not match a bare half.
        expect(isHit("kiloomeeteer kaaree", "468 kiloomeeteer laptooji")).toBe(false);
    });

    test("an unspaced script is unbounded, and the substring IS the hit test", () => {
        expect(matchers("摄氏度").bounded).toBe(false);
        expect(matchers("បូកដក").bounded).toBe(false);
        expect(isHit("摄氏度", "温度为25摄氏度左右")).toBe(true);
        // No boundary exists to reject a fragment, and the tool says so by verdict (`attested*`), not here.
        expect(isHit("បូកដក", "ប្រមាណវិធីបូកដកគុណចែក")).toBe(true);
        // Hangul is spaced, so it keeps the boundary test.
        expect(matchers("섭씨").bounded).toBe(true);
    });

    test("a regex metacharacter in a probed word is matched literally, not as a pattern", () => {
        expect(isHit("a.b", "x aXb y")).toBe(false);
        expect(isHit("a.b", "x a.b y")).toBe(true);
    });
});

/**
 * THE CACHE ROUND TRIP — the writer and the parser of `tools/corpus/attest/<lang>.jsonc`, pinned against
 * each other rather than against a hand-typed fixture.
 *
 * ⚠ WHY. `attest.ts` carries prior findings forward by re-parsing the file it wrote last time, and the two
 * halves drifted: the merge regex expected a finding's closing brace at **8** spaces while the writer emitted
 * one at **12**. So the parser found ZERO blocks in every cache this tool had ever written, the carry-forward
 * guard fired on every re-run (`REFUSING TO WRITE: N existing finding(s) could not be parsed`), and the cache
 * could only be built by one run covering every word at once.
 *
 * That is not cosmetic. A probe costs live Wikipedia fetches, so "one run covering every word" is a run that
 * a rate limit can destroy — and did: an agent deleted its cache to force the single clean run the tool
 * demanded, the wiki answered 429, and nine recorded findings survived only in an investigation document.
 *
 * A hand-typed fixture could not have caught this, because a hand-typed fixture is written by whoever is
 * looking at the regex. These tests feed `renderFinding()`'s own output back through `BLOCK_RE`, and then
 * check every cache actually in the tree, so the writer is the fixture.
 */
describe("attest.ts — the cache carry-forward round trip", () => {
    const finding = (word: string, examples: string[] = []) => ({
        word, tokenHits: examples.length, articles: examples.length, substringOnly: 0,
        examples, bounded: true, verdict: "attested" as const,
    });

    /** The frame the writer puts round the blocks, reduced to the part that matters for parsing. */
    const cache = (blocks: string[]): string =>
        `    {\n        "language": "xx",\n        "findings": [\n${blocks.join(",\n")}\n        ],\n    }\n`;

    const parse = (text: string): string[] =>
        [...text.matchAll(new RegExp(BLOCK_RE.source, BLOCK_RE.flags))].map((m) => m[0]);
    const wordsIn = (text: string): string[] =>
        [...text.matchAll(/"word":\s*"([^"]+)"/gu)].map((m) => m[1]!);

    test("what renderFinding writes is what BLOCK_RE reads back — one block per finding", () => {
        const written = cache([finding("Prozent"), finding("Eiro"), finding("Komma")].map(renderFinding));
        expect(parse(written).length).toBe(3);
        expect(parse(written).map((b) => /"word":\s*"([^"]+)"/u.exec(b)?.[1])).toEqual(["Prozent", "Eiro", "Komma"]);
    });

    test("examples do not end a block early — braces and brackets inside a quote are just characters", () => {
        const written = cache([
            finding("Grad", ["…0 bis –4 Grad Celsius {sic} [1]…", "…unta Nui Grad foin…"]),
            finding("minus", ["…Moi via, minus 10%…"]),
        ].map(renderFinding));
        const blocks = parse(written);
        expect(blocks.length).toBe(2);
        expect(blocks[0]).toContain("Grad Celsius {sic} [1]");
        // and the second block is not swallowed into the first
        expect(blocks[0]).not.toContain("minus");
    });

    test("a finding carried forward re-parses after being re-indented for re-emission", () => {
        // The writer re-emits a carried block verbatim at 8 spaces (`b.replace(/^\s+/, "")` behind a pad),
        // so its interior keeps whatever indentation it was born with. Two generations must both parse.
        const gen1 = parse(cache([renderFinding(finding("Kilometa", ["…2009 Kilometa…"]))]))[0]!;
        const gen2 = cache([`        ${gen1.replace(/^\s+/u, "")}`, renderFinding(finding("Kubikmeta"))]);
        expect(parse(gen2).length).toBe(2);
        expect(wordsIn(gen2)).toEqual(["Kilometa", "Kubikmeta"]);
    });

    test("THE DEFECT: a brace pinned at exactly 8 spaces matches nothing the writer emits", () => {
        const written = cache([finding("Prozent"), finding("Eiro")].map(renderFinding));
        const eightOnly = /\{\s*"word":[\s\S]*?\n {8}\}/gu; // the shipped regex, verbatim
        expect([...written.matchAll(eightOnly)].length).toBe(0); // …found nothing…
        expect(parse(written).length).toBe(2);                  // …while every finding was right there.
    });

    /**
     * The strongest form of the test, because it uses the artifacts rather than a model of them: every cache
     * in the tree must round-trip, block count equal to word count. A file the parser cannot read is a file
     * whose findings the next probe run refuses to write past — i.e. a language that can never be probed
     * incrementally again.
     */
    test("every cache in the tree parses, block for word", () => {
        const dir = "tools/corpus/attest";
        const files = readdirSync(dir).filter((f) => f.endsWith(".jsonc"));
        expect(files.length).toBeGreaterThan(50); // the test is only meaningful if it found the artifacts
        const broken: string[] = [];
        for (const f of files) {
            const text = readFileSync(join(dir, f), "utf8");
            const blocks = parse(text), words = wordsIn(text);
            // `wordsIn` also counts the `"word"` key inside each block, once — so the counts are comparable.
            if (blocks.length !== words.length) broken.push(`${f}: ${blocks.length} block(s), ${words.length} word(s)`);
        }
        expect(broken).toEqual([]);
    });
});

/**
 * THE SEARCH-SIDE HALF OF THE SAME BUG — because fixing the local boundary fixed the VERDICT and left the
 * SAMPLE wrong.
 *
 * CirrusSearch tokenises, and it splits a probe on its hyphen just as this tool's own tokenizer used to.
 * Probing cdo's `lī-mī` the wiki serves the query as `lī` + `mī` and returns a *full* 40 articles — none of
 * which contains the compound. The probe then reads twenty articles chosen for the wrong word and reports
 * `absent` with zero substring hits, which reads as "this word does not exist". `lī-mī`, `gŭng-gĭng` and
 * `lĭk-huŏng` were all recorded `absent` on cdo; all three are in the wiki.
 *
 * ⚠ THE TRIGGER IS THE PUNCTUATION, NOT AN EMPTY RESULT — the obvious "retry when the search found nothing"
 * guard never fires here, because the split query is not empty, it is full of the wrong articles. That is the
 * property these tests exist to hold.
 */
describe("attest.ts — probes whose article sample the remote tokenizer would get wrong", () => {
    test("a hyphen or an apostrophe in the probe forces the insource: sample", () => {
        for (const w of ["lī-mī", "gŭng-gĭng", "lĭk-huŏng", "kilomɛtrɛ-kare", "isan-jato", "Liap-sī",
            "sampè'", "baay’isuu", "Hawaiʻi"])
            expect([w, needsInsource(w)]).toEqual([w, true]);
    });

    test("a plain word does not — the tokenised query samples exactly the word it was given", () => {
        for (const w of ["Prozent", "amadola", "摄氏度", "koma", "sentimeter"])
            expect([w, needsInsource(w)]).toEqual([w, false]);
    });

    test("a phrase is not an insource: case — its space is a term separator the search handles", () => {
        expect(needsInsource("kiloomeeteer kaaree")).toBe(false);
        // …but a phrase whose parts carry punctuation is still the split case.
        expect(needsInsource("ist gleich")).toBe(false);
    });

    test("an unspaced script is excluded even if a stray hyphen appears", () => {
        expect(needsInsource("摄氏度-x")).toBe(false);
    });
});
