import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/umbundu/umbundu.ts";
import { numberToWords } from "../src/languages/umbundu/numbers.ts";
import { normalizeUmbundu } from "../src/languages/umbundu/normalize.ts";

// Canonical-IPA goldens for Umbundu (umb) — Bantu (R11, Angola), Latin orthography. Authored from
// Schadeberg (1982) "Nasalization in UMbundu" (the primary R11 phonology, Table 1 inventory) + the orthography —
// REFEREE-SCARCE (no wikipron/kaikki/epitran/Wiktionary-IPA), ASJP Umbundu-3 corroborated. This gold is a MEANINGFUL
// correctness anchor (Umbundu is a distinct, documented language, not a clone — the Igbo/Naija no-referee
// pattern). ⚠ It is also the ONLY evidence: single-source, with no machine referee to fall back on.
// Signatures: VOICED obstruents ONLY prenasalised (⟨mb nd nj ng⟩→ᵐb ⁿd ᶮd͡ʒ ᵑɡ), ⟨c⟩→t͡ʃ (palatal
// obstruent, not [ʃ]), ⟨v⟩→v, ⟨ñ⟩/⟨ny⟩→ɲ, ⟨ng'⟩→ŋ, ⟨l⟩→l (no native /r/). Tone (H/L+downstep) unwritten → stripped,
// deferred.
describe("Umbundu canonical IPA", () => {
    test("Schadeberg (1982) attested verb forms (the b~v/d~l/j~y/g~∅ ~ N alternations)", () => {
        expect(phonemizeWord("mbanja")).toBe("ᵐbaᶮd͡ʒa"); // "I look" (N+v→mb; N+y→nj)
        expect(phonemizeWord("ndanda")).toBe("ⁿdaⁿda"); // "I buy" (N+l→nd)
        expect(phonemizeWord("njeva")).toBe("ᶮd͡ʒeva"); // "I hear" (N+y→nj)
        expect(phonemizeWord("ngenda")).toBe("ᵑɡeⁿda"); // "I go" (N+∅→ng)
        expect(phonemizeWord("cila")).toBe("t͡ʃila"); // "dance!" — ⟨c⟩ palatal obstruent
    });

    test("prenasalised voiced stops (only voiced obstruents in native Umbundu)", () => {
        expect(phonemizeWord("Umbundu")).toBe("uᵐbuⁿdu"); // ⟨mb⟩→ᵐb, ⟨nd⟩→ⁿd
        expect(phonemizeWord("ondalu")).toBe("oⁿdalu"); // fire — ⟨nd⟩→ⁿd
        expect(phonemizeWord("Kalunga")).toBe("kaluᵑɡa"); // ⟨ng⟩→ᵑɡ
        expect(phonemizeWord("onjo")).toBe("oᶮd͡ʒo"); // house — ⟨nj⟩→ᶮd͡ʒ
        expect(phonemizeWord("olombo")).toBe("oloᵐbo"); // ⟨mb⟩→ᵐb
    });

    test("⟨c⟩→t͡ʃ, ⟨v⟩→v, open CV vowels", () => {
        expect(phonemizeWord("ocitumba")).toBe("ot͡ʃituᵐba"); // ⟨c⟩→t͡ʃ + ⟨mb⟩→ᵐb
        expect(phonemizeWord("ovava")).toBe("ovava"); // water — ⟨v⟩→v
        expect(phonemizeWord("omunu")).toBe("omunu"); // person
        expect(phonemizeWord("ekumbi")).toBe("ekuᵐbi"); // sun
    });

    test("nasals ⟨ny⟩/⟨ñ⟩→ɲ, ⟨ng'⟩→ŋ (plain velar nasal, ≠ ⟨ng⟩=ᵑɡ)", () => {
        expect(phonemizeWord("nyama")).toBe("ɲama"); // meat — ⟨ny⟩→ɲ
        expect(phonemizeWord("ng'ombe")).toBe("ŋoᵐbe"); // ⟨ng'⟩→ŋ (cattle)
    });

    test("tone accents stripped (deferred), nasalisation tilde kept", () => {
        expect(phonemizeWord("Kalúnga")).toBe("kaluᵑɡa"); // acute (H tone) stripped
        expect(phonemizeWord("tãi")).toBe("tãi"); // tilde (nasal vowel) kept
    });

    test("sentence: clause punctuation", () => {
        expect(phonemize("Ndapandula calwa.", "umb").trim()).toBe("ⁿdapaⁿdula t͡ʃalwa .");
    });
});

// CARDINAL NUMBERS (umb). The compositor emits the CITATION / COUNTING series (mosi, vali, tatu, kwãla, tãlo …):
// 1–5 are adjectival and take class concord, so a bare integer — with no noun to agree with — must use the
// counting shape. 6–9 (epandu, epandu vali, ecelãla, ecea) are QUINARY-BASED NOUNS and never inflect, which is
// why they are identical in every multiplier slot. Sources + the extrapolations are cited in umbundu.jsonc
// "numbers" (Camacho, "Números em Umbundo", 2013 + Omniglot "Numbers in Umbundu").
describe("Umbundu cardinal numbers — citation series, quinary 6–9, la/l' connective", () => {
    test("units: the quinary residue in 6–9", () => {
        expect(numberToWords(5)).toBe("tãlo");
        expect(numberToWords(6)).toBe("epandu");
        expect(numberToWords(7)).toBe("epandu vali");
        expect(numberToWords(9)).toBe("ecea");
    });
    test("teens use 'la', elided to l'' before a vowel (attested)", () => {
        expect(numberToWords(11)).toBe("ekwi la mosi");
        expect(numberToWords(13)).toBe("ekwi la vitatu"); // the post-'la' series is irregular: 3 takes vi-
        expect(numberToWords(16)).toBe("ekwi l'epandu"); // elision
    });
    test("tens take the cl.6 a- series, hundreds the cl.8 vi- series (two DIFFERENT tables)", () => {
        expect(numberToWords(20)).toBe("akwi avali");
        expect(numberToWords(21)).toBe("akwi avali la mosi");
        expect(numberToWords(60)).toBe("akwi epandu"); // 6 never inflects
        expect(numberToWords(100)).toBe("ocita");
        expect(numberToWords(200)).toBe("ovita vivali");
        expect(numberToWords(555)).toBe("ovita vitãlo l'akwi atãlo la vitãlo");
    });
    test("thousands + millions; 10⁹ is a THOUSAND MILLION (no attested word for it)", () => {
        expect(numberToWords(1000)).toBe("ohulukãyi");
        expect(numberToWords(2000)).toBe("ohulukãyi vivali");
        expect(numberToWords(1000000)).toBe("ohulua");
        expect(numberToWords(1000000000)).toBe("ohulua ohulukãyi");
    });
    test("end-to-end through the g2p", () => {
        expect(phonemize("21", "umb").trim()).toBe("akwi avali la mosi");
        expect(phonemize("16", "umb").trim()).toBe("ekwi lepaⁿdu"); // the elided l'' glues into one word
        expect(phonemize("200", "umb").trim()).toBe("ovita vivali");
    });
});

// ⚠ EVERY TEST BELOW ENCODES A MEASUREMENT OVER FLEURS `umb_ao` (2,111 rows → 1,493 unique utterances),
// which is the ONLY source this language has: espeak ships no `umb_list`, there is no referee config, and
// umb.wikipedia.org does not exist (Umbundu is still in Incubator). Several of these pin a REFUSAL, and
// those are the load-bearing ones — a refusal nobody can re-derive is one that quietly becomes a wrong rule
// in the next round.
describe("Umbundu text normalization", () => {
    test("the GREEK IOTA is folded to the Latin nasal vowel it is drawn as — ×10, trap 61 in mirror", () => {
        // ⟨ῖ⟩ U+1FD6 renders identically to Umbundu's own ⟨ĩ⟩ U+0129 and is the ONLY non-Latin letter in
        // the corpus. `umbundu.ts`'s TOKEN is bounded to `\p{Script=Latin}` (correctly), so the stray letter
        // ENDED the word: the run was split and the letter deleted. No gate sees that — nothing is dropped
        // that DROPPABLE hunts and both halves are well-formed Umbundu syllables (trap 56).
        expect(normalizeUmbundu("lyakulῖhiwa-vo")).toBe("lyakulĩhiwa-vo");
        // `akwῖ` ×2 beside `akwĩ` ×12 — and `akwĩ` is TEN, one of the commonest words in the language.
        expect(phonemize("akwῖ avali", "umb").trim()).toBe(phonemize("akwĩ avali", "umb").trim());
        // `okupitῖla` ×2 beside `okupitĩla` ×3, in the same corpus.
        expect(phonemize("okupitῖla", "umb").trim()).toBe(phonemize("okupitĩla", "umb").trim());
    });

    test("the DOT groups thousands and the COMMA decimates — Portuguese convention, unanimous here", () => {
        // 20 three-digit dot groups over 25 dotted-number instances; every comma has one or two digits
        // after it and not one groups. Untouched, the dot reached clausePunctuation and read as a FULL
        // STOP inside the number — the corpus's worst defect, and invisible to every leak class.
        expect(normalizeUmbundu("isoka 3.850 km²")).toBe("isoka 3850 km²");
        expect(normalizeUmbundu("lya 400.000 k’olombeyi")).toBe("lya 400000 k’olombeyi");
        // ⚠ THE WHOLE NUMBER AT ONCE (trap 63): joined one group per pass, `5.000.000` re-anchors inside
        // the remainder and reads as two well-formed numerals.
        expect(normalizeUmbundu("ka tendelo ya 5.000.000 vakombe")).toBe("ka tendelo ya 5000000 vakombe");
        // The decimal is NEUTRALISED, not spoken: `sources.ts` reports `[NONE] decimal-point` and there is
        // no second source to ask. Dropping the mark beats speaking a word this corpus cannot supply.
        expect(normalizeUmbundu("lya 163,52 km/h")).toBe("lya 163 52 km/h");
    });

    test("a clause-final figure keeps its pause and its grouping — trap 58/63", () => {
        // The trailing guard rejects a DIGIT and nothing else. `(?![\d.,])` would decline every figure at
        // the end of a sentence, and this corpus ends sentences on them.
        expect(normalizeUmbundu("ociva cikale 55.000.")).toBe("ociva cikale 55000.");
        expect(phonemize("yafetika ko 10:00.", "umb").trim().endsWith(".")).toBe(true);
        expect(phonemize("yeyi 7-2.", "umb").trim().endsWith(".")).toBe(true);
    });

    test("the VERSION dot and the SECTION dot are declined by the exact three-digit group", () => {
        // `802.11n` has two digits after the dot and `1.1` has one, so neither shape can be reached from
        // the de-grouping rule at all — and the tier's own NOT_VERSION guard still has a dot to see,
        // because the tier runs BEFORE de-grouping (traps 39/46).
        expect(normalizeUmbundu("Elupuko lya 802.11n lilomboloka")).toBe("Elupuko lya 802.11n lilomboloka");
        expect(normalizeUmbundu("okum-ola ociluvyavya 1.1.")).toBe("okum-ola ociluvyavya 1.1.");
    });

    test("the CLOCK is spent on its colon, and a SPORTS TIME is not a clock", () => {
        // 11 clocks; the writer supplies the hour word where they want one (`07:19 k’akukutu`), so only
        // the colon is spent.
        expect(normalizeUmbundu("Eci kwapita 11:00, omanu")).toBe("Eci kwapita 11 00, omanu");
        expect(normalizeUmbundu("cakala 07:19 k’akukutu")).toBe("cakala 07 19 k’akukutu");
        // ⚠ THE GUARD IS `(?!\.\d)` AND NOT `(?![\d.,])` — trap 58 both ways. Three downhill results sit
        // in one sentence (minutes and hundredths, not clocks) and must not be claimed; a guard carrying a
        // bare `.` would additionally decline every clause-final clock, which the test above pins.
        expect(normalizeUmbundu("isoka 4:41.30, itito vali la 2:11.60"))
            .toBe("isoka 4:41.30, itito vali la 2:11.60");
    });

    test("the PORTUGUESE hour notation `20h30` loses its bare letter", () => {
        // ×2 (`20h30`, `15h00 UTC`); the `h` reached the g2p as a letter inside the figure. No hour word is
        // placed — the corpus's own hour phrase is a clitic (`k’akukutu`) whose placement here is unattested.
        expect(normalizeUmbundu("cafetika kolo 20h30, otembo (15h00 UTC)"))
            .toBe("cafetika kolo 20 30, otembo (15 00 UTC)");
    });

    test("the SPACED dash is a clause dash; only the TIGHT hyphen is a range", () => {
        // kaa's em-dash finding in a different mark. `–` ×12, eleven of them an apposition in running
        // prose; neither `–` nor a spaced `-` is ever a minus here. Neither is in clausePunctuation, so
        // the pause was simply LOST (trap 17).
        expect(normalizeUmbundu("vyalwa – olopintula vyosimbu")).toBe("vyalwa, olopintula vyosimbu");
        expect(normalizeUmbundu("Ovyendelo vyakwavo - ukalimbe")).toBe("Ovyendelo vyakwavo, ukalimbe");
        // 9 ranges, every one written TIGHT. The dash is spent on a PAUSE, not a connective: Umbundu writes
        // the span out where it means it (`kolo 4 ale kolo 5`, `11.000 ko 22.500`), so imposing a
        // connective would double a word the writer had already chosen or deliberately not chosen.
        expect(normalizeUmbundu("olonjanja vyalwa 35-40 mph")).toBe("olonjanja vyalwa 35, 40 mph");
        expect(normalizeUmbundu("120-160 metelo")).toBe("120, 160 metelo");
    });

    test("`Covid-19` is a DESIGNATION and its hyphen stays silent — the left guard, trap 23", () => {
        // `\p{M}` sits beside `\p{L}` in the guard, or it goes blind wherever a nasal vowel is written
        // decomposed rather than precomposed.
        expect(normalizeUmbundu("wakwata Uveyi yo Covid-19.")).toBe("wakwata Uveyi yo Covid-19.");
    });

    test("REFUSED: `km` `mm` `kg` `mph` — no unit word exists in ANY source, and the refusal is WHOLE", () => {
        // `kilometelo`, `quilometro`, `kilograma`, `milimetelo` are ×0 in the only source this language
        // has, and `kilo` ×27 is the Fula-`tere` trap inside the corpus itself: 25 are inside `efetikilo`
        // ("the beginning") and 2 are the postposition `kilo lyomunda` ("on top of the hill"). `Metro` ×4
        // is the SUBWAY. Declaring `m` cannot bite `km` — the tier's leading guard rejects a key with a
        // letter before it — so `km²` reads exactly as it did rather than becoming a wrong LENGTH with an
        // ASCII exponent read as a NUMBER (trap 53, ak's rule).
        expect(phonemize("isoka 3.850 km²", "umb")).toContain("km");
        expect(phonemize("isoka 3.850 km²", "umb")).not.toContain("metelo");
    });

    test("`m` IS declared, on the single attestation FLEURS's universal sentence supplies", () => {
        // `metelo` ×1: "Luno wakwatele 120-160 metelo k’okulepa lyo-kombustivel" — trap 45's cubic-metre
        // sentence. ⚠ AND IT SUPPLIES THE NOUN AND NOT THE MODIFIER: this translation drops "cubic"
        // exactly as `as`, `bg` and `xh` mangle the same sentence, so the metre is sourced and the CUBE
        // WORD IS NOT. Every digit-adjacent `m` in the corpus is a genuine metre.
        expect(phonemize("cikwete 100 pés (38,48m)", "umb")).toContain("metelo");
        expect(phonemize("cisoka 100m kwenda", "umb")).toContain("metelo");
    });

    test("REFUSED: `º` is not a degree sign four times in seven — `°` is ×0 in this corpus", () => {
        // U+00BA MASCULINE ORDINAL INDICATOR ×7: DEGREE ×3, Portuguese ORDINAL ×2 (`10º yaswalãli`, the
        // Italian 10th Army), NUMERO ×1 (`Nº 11`), typo ×1. A ported `°` rule would be wrong four times in
        // seven, and no degree word is sourceable anyway (`grau`/`selsiyu`/`Celsius` all ×0). ⚠ The one
        // instance naming both scales writes the Celsius letter LOWERCASE: `90º F (32ºc)`.
        expect(normalizeUmbundu("vilinga 37º ofeka linene")).toBe("vilinga 37º ofeka linene");
        expect(normalizeUmbundu("o uya ya pitila 90º F (32ºc)")).toBe("o uya ya pitila 90º F (32ºc)");
    });

    test("the tier reads `%` on `porcento` and `&` on `kwenda`, POSTPOSED — not Swahili's order", () => {
        // `unitPrefix`/`currencyPrefix` exist because a measure noun heads its phrase in Bantu (Swahili
        // *kilomita 19,500*). This corpus refutes that in every instance: `120-160 metelo`,
        // `22.500 vyondolale`, `4 ale kolo 5 porcento`. The tier's DEFAULT postposition is correct here
        // and both flags are deliberately unset (trap 55).
        expect(phonemize("etendelo lisoka 20% lyovava", "umb")).toContain(phonemize("porcento", "umb").trim());
        expect(phonemize("olo B&Bs valikwama", "umb")).toContain(phonemize("kwenda", "umb").trim());
    });
});
