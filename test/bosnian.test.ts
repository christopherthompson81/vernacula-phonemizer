import { describe, expect, test } from "vitest";

import { createBosnian } from "../src/languages/bosnian/bosnian.ts";
import { phonemizeWord } from "../src/languages/serbian/serbian.ts";

// Bosnian (bs, bosanski) — South Slavic, the third Serbo-Croatian standard (~2.5M). Bosnian, Croatian and Serbian are
// pluricentric standards of ONE phonological system: the SEGMENTAL grapheme→IPA is IDENTICAL (same 30-phoneme
// inventory + fully-phonemic orthography), so bosnian.ts reuses the Serbian engine's phonemizeWord verbatim (word
// output byte-identical to Serbian/Croatian). Bosnian is written in BOTH Gaj's Latin (predominant) and Cyrillic. The
// Bosnian-specific deltas: the retained ⟨h⟩ (lahko/kahva, where Serbian/Croatian drop it), the ijekavian reflex, and
// the number words (Serbian hiljada/milion + ijekavian dvjesta). The shared g2p is validated against wikipron
// hbs_latn (98.4%, the Serbo-Croatian macrolanguage referee that contains Bosnian words); these adjudicated golds lock
// the Bosnian surface. Pitch accent is unwritten → deferred. See docs/investigations/bs_native_bringup_investigation.md.
describe("Bosnian canonical IPA — shared Serbo-Croatian g2p + Bosnian deltas", () => {
    const bs = createBosnian();

    test("the retained ⟨h⟩ (=x) — Bosnian's signature, where Serbian/Croatian drop it (lako/meko)", () => {
        expect(phonemizeWord("lahko")).toBe("laxko"); // "easily" — Bosnian ⟨h⟩ retained (S/C: lako)
        expect(phonemizeWord("mehko")).toBe("mexko"); // "softly" (S/C: meko)
        expect(phonemizeWord("kahva")).toBe("kaxʋa"); // "coffee" (Turkism; S/C kafa/kava)
        expect(phonemizeWord("sahat")).toBe("saxat"); // "hour/clock" (Turkism)
    });

    test("the shared Serbo-Croatian phonemes: č=t͡ʃ, ć=t͡ɕ, đ=d͡ʑ, dž=d͡ʒ, lj=ʎ, nj=ɲ, v=ʋ", () => {
        expect(phonemizeWord("čovjek")).toBe("t͡ʃoʋjek"); // "man" — ⟨č⟩=t͡ʃ, ⟨v⟩=ʋ, ijekavian ⟨je⟩
        expect(phonemizeWord("kuća")).toBe("kut͡ɕa"); // "house" — ⟨ć⟩=t͡ɕ (alveolo-palatal)
        expect(phonemizeWord("đak")).toBe("d͡ʑak"); // "pupil" — ⟨đ⟩=d͡ʑ
        expect(phonemizeWord("džamija")).toBe("d͡ʒamija"); // "mosque" — ⟨dž⟩=d͡ʒ digraph
        expect(phonemizeWord("ljeto")).toBe("ʎeto"); // "summer" — ⟨lj⟩=ʎ, ijekavian
        expect(phonemizeWord("njiva")).toBe("ɲiʋa"); // "field" — ⟨nj⟩=ɲ
        expect(phonemizeWord("mlijeko")).toBe("mlijeko"); // "milk" — ijekavian ⟨ije⟩ (S ekavian: mleko)
    });

    test("dual script: Bosnian Cyrillic reads through the same shared engine", () => {
        expect(phonemizeWord("Босна")).toBe("bosna"); // Cyrillic "Bosnia"
        expect(phonemizeWord("Bosna")).toBe("bosna"); // Latin — byte-identical
        expect(phonemizeWord("здраво")).toBe("zdraʋo"); // Cyrillic "hello"
    });

    test("cardinal numbers: Serbian hiljada/milion lexemes + the ijekavian dvjesta", () => {
        expect(bs.text("275").trim()).toBe("dʋjesta sedamdeset pet"); // dvjesta (ijekavian, not ekavian dvesta)
        expect(bs.text("1200").trim()).toBe("xiʎadu dʋjesta"); // hiljadu (Serbian lexeme, not Croatian tisuću)
        expect(bs.text("3000000").trim()).toBe("tri miliona"); // milion (Serbian, not Croatian milijun)
    });

    test("clause assembly", () => {
        expect(bs.text("Dobar dan, Sarajevo!").trim()).toBe("dobar dan , sarajeʋo !");
    });
});
