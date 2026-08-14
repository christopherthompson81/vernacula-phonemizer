/**
 * NAMED CHARACTER ENTITIES — the rows added to `core/markup.ts`, and the nine deliberately NOT added.
 *
 * The decoder's rule is not "does the entity occur" but "does the engine READ what it decodes to": an
 * unknown entity is left literal on purpose, which is the right answer for a name nothing can render. These
 * tests pin both halves of that rule, because the declines are the part a future reader is most likely to
 * undo by pasting an HTML5 entity table over the file.
 *
 * ⚠ THE DECLINE CASES ARE NOT ASSERTIONS THAT THE CURRENT READING IS GOOD. `&gamma;` reads as a word and
 * that is wrong; it is left literal because the alternative measured WORSE — a silent deletion, which no
 * leak class can see. If the lone-foreign-letter fall-through is ever fixed, these cases should be revisited
 * together, not one entity at a time.
 */
import { describe, expect, test } from "vitest";
import { stripMarkup } from "../src/core/markup.ts";
import { phonemize } from "../src/index.ts";

describe("entities that decode", () => {
    /** ⚠ ASCII SPACE, NOT U+00A0 / U+2009. 42 engines de-group a thousands separator only on an ASCII
     *  space, and every corpus instance of both entities is a thousands separator. See the row's comment. */
    test("the space family folds to an ASCII space", () => {
        expect(stripMarkup("176&thinsp;215&nbsp;km")).toBe("176 215 km");
        expect(stripMarkup("&nbsp;&bull; 100")).toBe("   100");
    });

    test("the invisible controls decode to the real characters, not to nothing", () => {
        expect(stripMarkup("a&zwnj;b")).toBe("a‌b");
        expect(stripMarkup("a&lrm;b")).toBe("a‎b");
    });

    test("precomposed accented Latin decodes", () => {
        expect(stripMarkup("fon&ccedil;age")).toBe("fonçage");
        expect(stripMarkup("peri&ograve;de")).toBe("periòde");
        expect(stripMarkup("Companhi&aacute;")).toBe("Companhiá");
        expect(stripMarkup("trypa&ocirc;")).toBe("trypaô");
        expect(stripMarkup("&agrave;&eacute;&egrave;&ecirc;&iacute;&icirc;")).toBe("àéèêíî");
    });

    /** The point of decoding an accent mid-token: the literal does not merely mispronounce the word, it
     *  splits it into three, and the corpus writes ordinary Occitan vocabulary this way. */
    test("oc reads the word instead of shattering it", () => {
        expect(phonemize("fon&ccedil;age", "oc")).toBe(phonemize("fonçage", "oc"));
        expect(phonemize("lo peri&ograve;de", "oc")).toContain("peɾjɔde");
        expect(phonemize("N&ograve;rd", "oc")).toContain("nɔɾt");
    });

    /** ⚠ ZERO-WIDTH is a leak class: decoding an invisible character is only right if the engine strips it.
     *  Measured across all 188 engines before the rows were added; these two are the spot check that keeps
     *  the property. */
    test("a decoded invisible control never reaches the IPA", () => {
        for (const [lang, text] of [
            ["kaa", "fdˤl&zwnj;alh"],
            ["pnb", "ہو&lrm;ئی"],
            ["ta", "a&zwnj;b"],
            ["fa", "a&zwnj;b"],
        ] as [string, string][])
            expect(phonemize(text, lang)).not.toMatch(/[​-‏⁠﻿]/u);
    });

    /** The defect that opened this: `&thinsp;` reaching the phoneme stream as a WORD. */
    test("a space entity is no longer spoken", () => {
        expect(phonemize("176&thinsp;215", "gn")).not.toMatch(/hinsp/u);
        expect(phonemize("14&thinsp;119", "la")).not.toMatch(/ĩːsp|hinsp/u);
    });
});

describe("entities deliberately left literal", () => {
    /** ⚠ EACH OF THESE OCCURS IN A MINED CORPUS AND IS STILL NOT DECODED. The reason is per character and
     *  is recorded in `core/markup.ts`; the shared shape is that the decode target is not read. */
    test("the nine declines stay literal", () => {
        for (const e of ["fnof", "gamma", "phi", "lambda", "Pi", "alpha", "nu", "real", "image"])
            expect(stripMarkup(`x&${e};y`)).toBe(`x&${e};y`);
    });

    /** `ƒ` is not merely unread — it SURVIVES into the phoneme stream in about half the fleet, so decoding
     *  `&fnof;` would swap a spoken token for a raw letter in the IPA. */
    test("U+0192 would leak into the IPA, which is why fnof is not decoded", () => {
        expect(phonemize("a ƒ b", "lo")).toContain("ƒ");
        expect(phonemize("a &fnof; b", "lo")).not.toContain("ƒ");
    });

    /** ⚠ THE MEASURED TRADE, KEPT EXECUTABLE — AND ITS FIRST HALF HAS NOW MOVED. The lone Greek letter used
     *  to be silently DELETED (in 191 of 193 engines, measured), which is the whole reason these six
     *  entities were declined: decoding `&gamma;` fed the decoder's output into that deletion. The router
     *  now reads the lone letter as its NAME (`core/scripts.ts`, `GREEK_LETTER_NAME`), so both halves of
     *  this case are read and the blocker on the six is gone.
     *
     *  ⚠ THE DECLINES STAY UNTIL THE ENTITY TABLE IS REVISITED AS A GROUP, which is what the file header
     *  asks for. This test now pins the NEW behaviour so that revisit starts from a measurement rather than
     *  from this comment. */
    test("a lone Greek letter is read as its name, and a run is read as Greek", () => {
        for (const lang of ["gd", "sn", "si", "yo"]) {
            expect(phonemize(`xa γ ax`, lang)).not.toBe(phonemize(`xa ax`, lang));
            expect(phonemize(`xa γ ax`, lang)).toContain("ɣama");
            expect(phonemize(`xa Παν ax`, lang)).toContain("pan");
        }
    });

    /** ⚠ THE ONE-LETTER GREEK WORD IS THE COUNTER-CASE, and it is still declined — an ACCENT or breathing
     *  is what separates Greek prose (`ή` "or", `ἡ` the article) from a mathematical symbol, and the census
     *  behind that split is in `GREEK_LETTER_NAME`. lg's and crh's corpus lines are the live instances. */
    test("an ACCENTED lone Greek letter is still declined", () => {
        for (const lang of ["lg", "crh", "en"]) {
            expect(phonemize(`xa ή ax`, lang)).toBe(phonemize(`xa ax`, lang));
            expect(phonemize(`xa ἡ ax`, lang)).toBe(phonemize(`xa ax`, lang));
        }
    });

    /** ℜ and ℑ are read by nothing at all, el included — the strongest of the nine declines. */
    test("the letterlike symbols are read by no engine", () => {
        for (const lang of ["yo", "el", "en"]) {
            expect(phonemize("xa ℜ ax", lang)).toBe(phonemize("xa ax", lang));
            expect(phonemize("xa ℑ ax", lang)).toBe(phonemize("xa ax", lang));
        }
    });
});

/**
 * ⚠ THE ARTIFACT DOES NOT SAY WHAT THE ENGINE READS. The mined corpora store the RAW entity (`&nbsp;`
 * ×2,305) and `stripMarkup` decodes at read time, so a rule author writing a character class from what an
 * artifact shows is writing it against text the engine never sees. This is not hypothetical — it is why
 * `nbsp` folds to an ASCII space rather than to U+00A0, and it is the trap gn walked into from the other
 * side. Pinned here so the property is stated somewhere executable.
 */
describe("artifact text is not runtime text", () => {
    test("the decoded form and the raw character are NOT interchangeable to every engine", () => {
        // The 42 engines whose grouping class is ASCII-only; km is one of them. This is the defect the
        // ASCII fold masks, asserted so that "fix" the fold and this test tells you what it costs.
        const viaEntity = phonemize("1&nbsp;904&nbsp;569", "km");
        const viaCharacter = phonemize("1 904 569", "km");
        expect(viaEntity).not.toBe(viaCharacter);
    });
});
