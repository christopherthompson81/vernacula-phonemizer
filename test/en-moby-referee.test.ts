/**
 * THE DERIVED MOBY REFEREE — what it folds, and what it MUST NOT.
 *
 * ⚠ A REFEREE NORMALISED TOWARD THE THING IT JUDGES IS A MIRROR. This corpus is only usable because the
 * generator draws a line: transcription CONVENTION is folded (Moby spells out what this engine writes as
 * one phone), and PHONOLOGY is not — except in the one case where this engine provably cannot regress.
 * The line is the artifact's entire claim to independence, so it is pinned here rather than left to the
 * generator's comments.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const read = (f: string): Map<string, string> => {
    const m = new Map<string, string>();
    for (const l of readFileSync(`tools/referee-eval/referees/${f}`, "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [w, ipa] = l.split("\t");
        m.set(w!, ipa!);
    }
    return m;
};
const lex = read("en.moby-lexicon.tsv");
const oov = read("en.moby-oov.tsv");

describe("the Moby referee corpora", () => {
    test("they are large, disjoint, and one reading per headword", () => {
        expect(lex.size).toBeGreaterThan(30_000);
        // ⚠ 39,485, NOT THE ORIGINAL 57,503: #1344 imported 16,227 of these headwords into the dictionary
        // and the generator now EXCLUDES every imported word from both corpora, because scoring ourselves
        // against Moby on a word whose reading we took from Moby is a mirror. The remainder is the harder
        // residue — gold has no reading for most of it — so its score is not comparable to the pre-import
        // number and the config says so.
        expect(oov.size).toBeGreaterThan(38_000);
        // ⚠ DISJOINT BY CONSTRUCTION: the split IS "does g2p-dict.tsv carry this word", which is what makes
        // the second file a referee for the OOV tier rather than a second opinion on the lexicon.
        expect([...lex.keys()].filter((w) => oov.has(w))).toEqual([]);
    });

    // ⚠ THE NON-RHOTIC EXCLUSION IS PINNED HERE BECAUSE A REGEX EDIT MOVES HUNDREDS OF ROWS SILENTLY,
    // and because the line it draws is the subtle one in this file: RP is dropped, a LOANWORD is not.
    // Moby writes `afterwards` as æftəwədz because the transcription is BRITISH — we say the /r/. It
    // writes `dossier` as dɑsieɪ because the ⟨r⟩ is silent in GenAm too, we read it r-less as well, and
    // the row passes. The discriminator is OUR OWN reading, not the spelling: a spelling test exempted
    // `pliers` (ours `P L AY1 ER0 Z`) and `messier` — where Moby has the ASTRONOMER and our headword is
    // the comparative of `messy`.
    test("RP rows are dropped and GenAm-silent loanwords are kept", () => {
        for (const w of ["afterwards", "backwards", "bifurcate", "binoculars", "comfortable",
            // ⚠ THE `-ered` FAMILY IS THE LARGEST CLASS AND THE FIRST RULE ALONE MISSES IT: the ⟨e⟩
            // after the ⟨r⟩ is a vowel LETTER even when silent, so the coda lookahead rejects the word.
            "battered", "coloured", "chambered", "unanswered", "tattered",
            // ⚠ AND AN ONSET /ɹ/ SHIELDS A NON-RHOTIC CODA unless the test looks at the TAIL only.
            "particolored"])
            expect([lex.has(w), oov.has(w)]).toEqual([false, false]);
        // Kept: we are r-less here too, so these are not RP and they score.
        expect(lex.get("dossier")).toBe("dɑsieɪ");
        expect(lex.get("boucher")).toBe("buʃeɪ");
        // ⚠ AND THESE WERE EXEMPTED BY A SPELLING RULE AND SHOULD NOT HAVE BEEN — our reading is rhotic,
        // so the row can never pass and is RP readmitted by hand.
        for (const w of ["pliers", "messier", "tourniquet", "angers"])
            expect([lex.has(w), oov.has(w)]).toEqual([false, false]);
    });

    // ⚠ A ROW WHOSE BODY IS A DIFFERENT WORD CANNOT ARBITRATE ANYTHING, so MOBY_DEFECTIVE drops it from
    // both corpora. Pinned because the list is hand-curated and silence is how it would rot.
    test("defective rows reach neither corpus", () => {
        for (const w of ["gorbachev", "carr", "pathology", "workbasket", "sleipnir", "monosaccharide"])
            expect([lex.has(w), oov.has(w)]).toEqual([false, false]);
    });

    test("NOTATION is folded — Moby's two symbols become this engine's one", () => {
        expect(lex.get("general")).toBe("d͡ʒɛnɚəl");    // ə + r  → ɚ
        expect(lex.get("history")).toBe("hɪstɚi");
        expect(lex.get("download")).toBe("daʊnloʊd");   // æ + ʊ  → aʊ
    });

    // ⚠ Moby writes ONE symbol for STRUT and schwa and separates them by STRESS, exactly as CMUdict does.
    // Stripping stress before the IPA map wrote every unstressed schwa in the corpus as ʌ — `general` came
    // out `dʒɛnɚʌl` and `carolina` `kæɹʌlaɪnʌ`.
    test("schwa and STRUT are separated by stress, not collapsed", () => {
        expect(lex.get("about")).toBe("əbaʊt");
        expect(lex.get("carolina")).toBe("kæɹəlaɪnə");
    });

    // ⚠ SAFE ONLY BECAUSE CMUdict HAS NO SUCH DISTINCTION — `more` and `nor` are both AO R — so this engine
    // has no FORCE to regress into and the fold can hide nothing.
    test("FORCE→NORTH is folded", () => {
        expect(lex.get("more")).toBe("mɔɹ");
        expect(lex.get("nor")).toBe("nɔɹ");
    });

    // ⚠ AND IT IS GATED ON THE SPELLING, because the phone shape cannot tell a FORCE coda from a compound
    // seam: `chorus` is also `AO R` before a vowel and DOES merge. Without the `owr` exemption the builder
    // wrote `ʃɔɹum`/`tɔɹoʊp` and scored our correct GOAT readings wrong, with the damage baked into the
    // artifact where no config fold could reach it.
    test("FORCE→NORTH does NOT fire across a compound seam", () => {
        expect(lex.get("showroom")).toBe("ʃoʊɹum");
        expect(lex.get("elbowroom")).toBe("ɛlboʊɹum");
        expect(oov.get("towrope")).toBe("toʊɹoʊp");
        // `bowring` is NOT one of these — Moby writes it with a source `/O/`, not an OW the fold collapsed.
        expect(lex.get("bowring")).toBe("bɔɹɪŋ");
    });

    // ⚠ THE LOAD-BEARING NEGATIVE. 402 dictionary rows moved on the marry–merry axis in #1336 and this
    // engine writes BOTH æɹ and ɛɹ, so folding Moby's unmerged reading would blind the referee to exactly
    // the class most recently changed. `carol` MUST stay æ here while the engine says ɛ.
    test("marry–merry is NOT folded, so a regression there is still scoreable", () => {
        expect(lex.get("carol")).toBe("kæɹəl");
        expect(lex.get("carat")).toBe("kæɹət");
    });

    test("every reading is plain broad IPA — none of the engine's narrow detail leaked in", () => {
        // aspiration, dark l, flapped t and the superscript offglides are the ENGINE's notation; a referee
        // written in them reads as a mirror even where the folds would score it the same.
        const narrow = /[ʰɫ̬ᶦᶷ]/u;
        const bad = [...lex.entries()].filter(([, ipa]) => narrow.test(ipa)).slice(0, 5);
        expect(bad).toEqual([]);
    });
});
