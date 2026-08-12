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
import { describe, expect, test } from "vitest";
import { fold, isHit, countHits, matchers } from "../tools/normalization/attest.ts";

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
