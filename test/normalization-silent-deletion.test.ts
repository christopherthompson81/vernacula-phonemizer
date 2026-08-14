/**
 * THE SILENT-DELETION DETECTOR — a letter that reaches the engine, is not rejected, and produces nothing.
 *
 * ⚠ WHAT MAKES THIS CLASS HARD IS NOT FINDING SILENT CHARACTERS, IT IS NOT FINDING ALL OF THEM. "A character
 * in the input that is absent from the output" fires on every space, every pause mark the engine correctly
 * drops, and every silent letter in every orthography — French `parlent`, English `knight`, Spanish `hombre`.
 * So this file pins BOTH directions on every case: the six defects that were found by hand must fire, and the
 * orthographic silences beside them must not.
 *
 * The engine is stubbed rather than imported. `silentCharsIn` takes a `Say` callback precisely so its
 * discrimination can be tested without 182 engines, and the fleet measurement lives in
 * `docs/investigations/silent_deletion_detector_investigation.md` where its numbers can be re-run.
 */
import { describe, expect, test } from "vitest";

import { ORTHOGRAPHIC_SILENCE, silentCharsIn } from "../tools/normalization/defects.ts";

/**
 * A stub engine: each character reads as its phone, an unlisted character reads as NOTHING (the defect), and
 * a `separator` character breaks the token (the other half of the defect — bal's ⟨ݔ⟩ shape).
 */
function reader(phones: Record<string, string>, separators = ""): (t: string) => string {
    return (text: string): string =>
        text.split(new RegExp(`[\\s${separators.replace(/[\\\]^-]/gu, "\\$&")}]`, "u"))
            .map((tok) => [...tok].map((c) => phones[c] ?? "").join(""))
            .filter((t) => t !== "")
            .join(" ");
}

/**
 * ⚠ A SYNTHETIC CORPUS HAS TO BE REPEATED, and the reason is the core-inventory filter, not the test. A probe
 * word is admissible only if its OTHER characters each occur at least 20 times in the corpus — that floor is
 * what removes the IPA-gloss false positives on the fleet. Repeating the lines leaves the DISTINCT-word set
 * untouched while giving the ordinary letters their ordinary frequency, which is what a real corpus has.
 */
const corpus = (lines: readonly string[]): string[] => Array.from({ length: 20 }, () => lines).flat();

describe("the six defects found by hand, at the readings their engines gave before each fix", () => {
    // Every corpus word below is real text from that language's mined artifact, and every reading is the one
    // the engine produced at the commit BEFORE the fix, recorded by running this detector against a tree
    // extracted at `<fix>^`. See the investigation doc, Run 6.

    test("gn — ⟨ꞌ⟩ U+A78C SALTILLO, the puso, a PHONEME, ×301 in 433 segments", () => {
        // Pre-fix (`6d24232^`): `heꞌõporã → heõpoˈɾã`. The glottal stop is simply absent from the reading.
        const say = reader({ h: "h", e: "e", õ: "õ", p: "p", o: "o", r: "ɾ", ã: "ã", a: "a", j: "d͡ʒ", u: "u", k: "k", s: "s", ꞌ: "" });
        const hits = silentCharsIn("gn", corpus(["heꞌõporã ojepuruꞌakue soꞌo"]), say, "Latin");
        expect(hits.map((h) => h.ch)).toEqual(["ꞌ"]);
        expect(hits[0]!.mode).toBe("inert");
    });

    test("ee — ◌͂ U+0342 perispomeni written for the nasal tilde, ×6 in the whole artifact", () => {
        // ⚠ THE SMALLEST OF THE SIX, and the reason there is no occurrence threshold. A character that deletes
        // a phonemic contrast is a defect at ×6 exactly as at ×301; ee's was found by a hand-run census and
        // would be invisible to any rule that asked for scale first.
        const say = reader({ h: "h", a: "a", k: "k", t: "t", ŋ: "ŋ", ɔ: "ɔ", s: "s", ɛ: "ɛ", "͘": "", "͂": "" });
        const hits = silentCharsIn("ee", corpus(["ha͂ kata͂ ŋɔ͂tsɛ"]), say, "Latin");
        expect(hits.map((h) => h.ch)).toEqual(["͂"]);
    });

    test("sat — ⟨ᱻ⟩ U+1C7B RELAA, inside the word class and claimed by no branch", () => {
        // Pre-fix (`23a6615^`): `ᱵᱮᱲᱟᱻᱫᱚ → beɽadɔ`. The length mark vanishes between two letters it is
        // between — the shape that has no leak, no drop and no diff.
        const say = reader({ "ᱵ": "b", "ᱮ": "e", "ᱲ": "ɽ", "ᱟ": "a", "ᱫ": "d", "ᱚ": "ɔ", "ᱢ": "m", "ᱤ": "i", "ᱛ": "t", "ᱻ": "" });
        const hits = silentCharsIn("sat", corpus(["ᱵᱮᱲᱟᱻᱫᱚ ᱢᱤᱻᱢᱤᱫ ᱛᱤᱻ"]), say, "Ol_Chiki");
        expect(hits.map((h) => h.ch)).toEqual(["ᱻ"]);
    });

    test("bm — ⟨ε⟩ U+03B5 and ⟨ԑ⟩ U+0511, Greek and Cyrillic homoglyphs for ⟨ɛ⟩", () => {
        // ⚠ THE HOMOGLYPH IS THE HARDEST HALF OF THE CLASS TO SEE BY EYE: ⟨ε⟩, ⟨ԑ⟩ and ⟨ɛ⟩ are three
        // codepoints that print identically, which is why `mine.ts` prints U+XXXX beside the character.
        const say = reader({ b: "b", ε: "", "ԑ": "", ɛ: "ɛ", s: "s", n: "n", c: "t͡ʃ", o: "o", ɡ: "ɡ", g: "ɡ", k: "k", a: "a", ɲ: "ɲ", t: "t", y: "j", r: "r" });
        // ⚠ Every probe word is a whole word of the language, because a two-letter `bε` is HALF homoglyph and
        // the majority-script test — which is what keeps a foreign name out of the evidence — rightly rejects
        // it. The real artifact supplies both; the detector needs three of the longer ones.
        const hits = silentCharsIn("bm", corpus(["sεbεncogo kanɲε cεnkoro kԑnԑya bԑnkan tԑmԑna"]), say, "Latin");
        expect(hits.map((h) => h.ch).sort()).toEqual(["ε", "ԑ"]);
        // ⟨ɛ⟩ itself is read, and must never be reported beside its homoglyphs.
        expect(hits.map((h) => h.ch)).not.toContain("ɛ");
    });

    test("ki — ⟨ū⟩ ⟨ī⟩, keyboard substitutes for ⟨ĩ⟩ ⟨ũ⟩, 7 % of paragraphs", () => {
        const say = reader({ a: "a", n: "n", d: "d", h: "h", r: "ɾ", i: "i", m: "m", t: "t", b: "b", o: "o", u: "u", "ū": "", "ī": "" });
        const hits = silentCharsIn("ki", corpus(["harī mītambo inīra mūtambo mūrimi ūhoro"]), say, "Latin");
        expect(hits.map((h) => h.ch).sort()).toEqual(["ī", "ū"]);
    });

    test("bal — ⟨ݔ⟩ U+0754 OUTSIDE the token class: the word SPLITS and the letter is lost", () => {
        // ⚠ THIS IS WHY THE SPACE PROBE EXISTS. `مسترݔن → mast̪ir n` is NOT `say(word without ݔ)` — the
        // fragments either side are phonemized separately — so a deletion-only detector reads this clean.
        const say = reader({ "م": "m", "س": "s", "ت": "t̪", "ر": "r", "ن": "n", "ا": "a", "ب": "b", "ز": "z", "ی": "i", "ݔ": "" }, "ݔ");
        const hits = silentCharsIn("bal", corpus(["مسترݔن بازݔن مݔز"]), say, "Arabic");
        expect(hits.map((h) => h.ch)).toEqual(["ݔ"]);
        expect(hits[0]!.mode).toBe("separator");
    });
});

describe("⚠ and the silences that are CORRECT — the population the naive detector cannot tell apart", () => {
    test("a letter silent in ONE word is not silent in the language — Spanish ⟨h⟩ and the ⟨ch⟩ digraph", () => {
        // `hombre` says nothing for the ⟨h⟩ and that is correct Spanish. `chico` reads it as part of /t͡ʃ/.
        // One contributing word claims the character; universality is the whole discrimination.
        const say = (text: string): string =>
            text.replace(/ch/gu, "").split(/\s+/u)
                .map((tok) => [...tok].map((c) => ({ "": "t͡ʃ", h: "", o: "o", m: "m", b: "b", r: "ɾ", e: "e", i: "i", c: "k", a: "a", s: "s", n: "n" } as Record<string, string>)[c] ?? "").join(""))
                .filter((t) => t !== "").join(" ");
        expect(silentCharsIn("es", corpus(["hombre chico hacer chinos hierba"]), say, "Latin").map((h) => h.ch)).toEqual([]);
    });

    test("⚠ and the CAPITAL of that letter must not fire either — case folding, measured on six engines", () => {
        // ⟨H⟩ occurs only in names (`Honshu`), where it IS correctly silent, so an unfolded detector reports
        // it in an, ast, es, gl, it and oc while ⟨h⟩ passes. A letter's case variants are the same letter.
        const say = (text: string): string =>
            text.toLowerCase().replace(/ch/gu, "").split(/\s+/u)
                .map((tok) => [...tok].map((c) => ({ "": "t͡ʃ", h: "", o: "o", n: "n", s: "s", u: "u", i: "i", c: "k", a: "a", e: "e", r: "ɾ", b: "b", m: "m" } as Record<string, string>)[c] ?? "").join(""))
                .filter((t) => t !== "").join(" ");
        expect(silentCharsIn("es", corpus(["Honshu Hachi chico hombre Hermano"]), say, "Latin").map((h) => h.ch)).toEqual([]);
    });

    test("a French-style silent final ⟨t⟩ does not fire, because the same ⟨t⟩ is read initially", () => {
        const say = reader({ p: "p", a: "a", r: "ʁ", l: "l", e: "", n: "", t: "t", b: "b", i: "i", o: "o", u: "u" });
        // `parlent` ends silently; `table`, `tour`, `petit` all read the ⟨t⟩.
        const hits = silentCharsIn("fr", corpus(["parlent table tour petit brut"]), say, "Latin");
        expect(hits.map((h) => h.ch)).not.toContain("t");
    });

    test("two words are not evidence about a language", () => {
        // A character seen in fewer than three distinct words says nothing about an orthography, and the
        // artifacts are full of one-off foreign names.
        const say = reader({ a: "a", b: "b", c: "k", d: "d", "ǂ": "" });
        expect(silentCharsIn("xx", corpus(["abǂc dǂab"]), say, "Latin")).toEqual([]);
    });

    test("a Han corpus is excluded by SCRIPT, and the exclusion is deliberate", () => {
        // There the candidate alphabet IS the corpus, so the class degenerates into a dictionary-coverage
        // meter: gan 417 + hsn 122 + cjy 20 + wuu 2 findings, 76 % of the fleet, all of them "a hanzi outside
        // the dictionary reads as nothing" — which has its own probe.
        const say = reader({ "中": "t͡ʂʊŋ", "国": "kwo", "人": "ʐən" });
        expect(silentCharsIn("gan", corpus(["中国扗人 扗中国 人扗"]), say, "Han")).toEqual([]);
    });

    test("a character the LEAK tables already own is not this class's business", () => {
        // ⚠ DERIVED FROM `LEAK_CLASSES`, NEVER RE-LISTED — three drifted copies of that table were found in
        // one week. U+00BA ⟨º⟩ is `\p{L}` to Unicode and RAWMARK's to this repo; eu's `ºI → i` was reported
        // by both until the candidate test consulted the leak table itself.
        const say = reader({ i: "i", k: "k", h: "h", a: "a", "º": "" });
        expect(silentCharsIn("eu", corpus(["ºi ºka ºha"]), say, "Latin").map((h) => h.ch)).toEqual([]);
    });
});

describe("an orthographic silence is a NOTE, not a defect, and not a silence", () => {
    test("Maltese ⟨h⟩ is reported, and reported as orthographic", () => {
        // ×1,315 in the artifact. The /ħ/ of the language is written ⟨ħ⟩ — a different letter, which the
        // engine reads — so a silent ⟨h⟩ is correct here in a way it is not in Wolof, where ⟨h⟩ is a phoneme.
        const say = reader({ h: "", i: "ɪ", j: "j", a: "a", ħ: "ħ", o: "ɔ", m: "m", l: "l", u: "u" });
        const hits = silentCharsIn("mt", corpus(["hija hallu ħalla hom"]), say, "Latin");
        expect(hits.map((h) => [h.ch, h.orthographic])).toEqual([["h", true]]);
    });

    test("⚠ the exemption never removes the hit — a quiet exemption is a clean scan", () => {
        // This is how the class survived being found six times: nothing appeared that should not have.
        const say = reader({ "ل": "l", "ـ": "", "ب": "b", "و": "w", "ج": "d͡ʒ", "د": "d" });
        const hits = silentCharsIn("ary", corpus(["لـوجود بـلد لـبو"]), say, "Arabic");
        expect(hits.map((h) => h.ch)).toEqual(["ـ"]);
        expect(hits[0]!.orthographic).toBe(true);
    });

    test("the table may only name characters that are silent BY RULE", () => {
        // An entry naming a letter an engine merely fails to read would be a defect being silenced — the same
        // discipline `VOWELLESS_WORDS` keeps for `rawLatinIn`. Every entry is argued in the file.
        expect(Object.keys(ORTHOGRAPHIC_SILENCE).sort())
            .toEqual(["*", "ab", "ba", "be", "chv", "ky", "mn", "mt", "tg", "tt"]);
        expect(ORTHOGRAPHIC_SILENCE["*"]).toEqual(["ـ"]);
        // ⚠ THE SOFT SIGN IS EXEMPT IN THREE LANGUAGES AND NOT IN THE FOURTH, and that asymmetry is the point:
        // tt/tg/ky have no palatalisation contrast for ⟨ь⟩ to mark (each language's own referee is quoted in
        // the table), while Chuvash's referee writes `выльӑх ˈʋɯlʲəχ` — so chv EMITS [ʲ] and is not exempt.
        for (const l of ["tt", "tg", "ky"]) expect(ORTHOGRAPHIC_SILENCE[l]).toContain("ь");
        expect(ORTHOGRAPHIC_SILENCE["chv"] ?? []).not.toContain("ь");
        // U+0301 on a Cyrillic base is a dictionary STRESS ANNOTATION, not a letter — silent by rule once
        // `foldCyrillicStressMarks` stops it splitting the word. Cyrillic-scoped, never `"*"`: the same
        // codepoint is letter-forming in vi, es and umbundu.
        for (const l of ["ab", "ba", "be", "chv", "mn", "tg", "tt"])
            expect(ORTHOGRAPHIC_SILENCE[l]).toContain("\u0301");
    });
});

describe("the evidence a report carries", () => {
    test("occurrences, distinct words, mode and examples all come back with the character", () => {
        const say = reader({ a: "a", b: "b", d: "d", k: "k", "ꞌ": "" });
        const hits = silentCharsIn("xx", corpus(["aꞌb baꞌd kaꞌ"]), say, "Latin");
        expect(hits[0]!.occurrences).toBe(60); // ×3 per line, 20 repetitions
        expect(hits[0]!.words).toBe(3);
        expect(hits[0]!.examples[0]).toBe("aꞌb → ab");
    });
});
