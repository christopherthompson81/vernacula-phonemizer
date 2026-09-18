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
        expect(oov.size).toBeGreaterThan(50_000);
        // ⚠ DISJOINT BY CONSTRUCTION: the split IS "does g2p-dict.tsv carry this word", which is what makes
        // the second file a referee for the OOV tier rather than a second opinion on the lexicon.
        expect([...lex.keys()].filter((w) => oov.has(w))).toEqual([]);
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
