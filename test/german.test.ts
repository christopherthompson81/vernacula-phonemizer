import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/german/german.ts";

// Canonical-IPA goldens for Standard German (de), espeak-independent. Rule-based g2p (long/short vowels from
// spelling, diphthongs aɪ̯/aʊ̯/ɔʏ̯, ch ich-/ach-laut, sch, sp-/st-→ʃ, final devoicing, r-vocalization ɐ̯,
// schwa in weak endings) + mostly-Germanic stress (first syllable, or after an unstressed prefix) with a
// kaikki stress lexicon for loanwords. Stress mark is placed before the stressed VOWEL (repo convention).
describe("german canonical IPA", () => {
    test("vowel length + schwa endings + r-vocalization", () => {
        expect(phonemizeWord("Vater")).toBe("fˈaːtɐ"); // long aː (single C), -er → ɐ
        expect(phonemizeWord("Wasser")).toBe("vˈasɐ"); // short a (double s → single), -er → ɐ
        expect(phonemizeWord("machen")).toBe("mˈaxən"); // -en → ə
        expect(phonemizeWord("über")).toBe("ˈyːbɐ");
        expect(phonemizeWord("lieben")).toBe("lˈiːbən"); // ie → iː
        expect(phonemizeWord("sehen")).toBe("zˈeːən"); // silent h, s → z
        expect(phonemizeWord("Hamburg")).toBe("hˈambʊɐ̯k"); // coda r → ɐ̯, final g → k
        expect(phonemizeWord("das")).toBe("das"); // short function-word monosyllable
    });

    test("ch split, sch, sp/st, diphthongs, devoicing", () => {
        expect(phonemizeWord("ich")).toBe("ɪç"); // ich-laut
        expect(phonemizeWord("Buch")).toBe("buːx"); // ach-laut, long u
        expect(phonemizeWord("König")).toBe("kˈøːnɪç"); // -ig → ɪç
        expect(phonemizeWord("Straße")).toBe("ʃtʁˈaːsə"); // st- → ʃt, ß → s
        expect(phonemizeWord("Zeit")).toBe("t͡saɪ̯t"); // z → t͡s, ei → aɪ̯
        expect(phonemizeWord("Deutschland")).toBe("dˈɔʏ̯t͡ʃlant"); // eu → ɔʏ̯, tsch → t͡ʃ, final d → t
        expect(phonemizeWord("Häuser")).toBe("hˈɔʏ̯zɐ"); // äu → ɔʏ̯
        expect(phonemizeWord("müssen")).toBe("mˈʏsən"); // short ü → ʏ (the census primitive)
        expect(phonemizeWord("Tag")).toBe("taːk"); // final devoicing g → k
        expect(phonemizeWord("Hund")).toBe("hʊnt");
    });

    test("prefix reduction, sp/st after prefix", () => {
        expect(phonemizeWord("gemacht")).toBe("ɡəmˈaxt"); // ge- prefix → ə
        expect(phonemizeWord("bestimmt")).toBe("bəʃtˈɪmt"); // be- → ə, st after prefix → ʃt
        expect(phonemizeWord("gehen")).toBe("ɡˈeːən"); // ge- ROOT not reduced (stress on first)
    });

    test("morphology: compound + affix boundary phonology", () => {
        // Compound seams reset element-initial context (sp/st→ʃ), devoice the preceding stem, and block assimilation.
        expect(phonemizeWord("Laubsturm")).toBe("lˈaʊ̯pʃtʊɐ̯m"); // st→ʃt at seam, b→p devoiced
        expect(phonemizeWord("Warenkorb")).toBe("vˈaːʁənkɔɐ̯p"); // n·k NOT assimilated to ŋ
        expect(phonemizeWord("aufstehen")).toBe("ˈaʊ̯fʃteːən"); // separable prefix stressed, st→ʃt
        expect(phonemizeWord("verstehen")).toBe("fəɐ̯ʃtˈeːən"); // ver- → fə here (kaikki reduction lexicon; cf. vergessen fɛɐ̯ — per-word)
        expect(phonemizeWord("freundlich")).toBe("fʁˈɔʏ̯ntlɪç"); // -lich suffix, d→t devoiced at boundary
        expect(phonemizeWord("Zeitung")).toBe("t͡sˈaɪ̯tʊŋ"); // -ung
        // Vowel-initial inflection resyllabifies (no boundary): lieben not lieb·en, Häuser not häus·er.
        expect(phonemizeWord("lieben")).toBe("lˈiːbən"); // b stays (not devoiced)
        expect(phonemizeWord("Häuser")).toBe("hˈɔʏ̯zɐ"); // s → z (onset), not final s
    });

    test("flag-driven decomposition: linking-s, false-prefix guards", () => {
        expect(phonemizeWord("Zeitungsartikel")).toBe("t͡sˈaɪ̯tʊŋsaɐ̯tiːkəl"); // Fugen-s via the s flag
        expect(phonemizeWord("Geburtstag")).toBe("ɡəbˈuːɐ̯tstaːk"); // geburts·tag; ge- reduces to ə (kaikki ɡəˈbuːɐ̯tstaːk)
        expect(phonemizeWord("beiden")).toBe("bˈaɪ̯dən"); // NOT be·iden (iden isn't a word)
        expect(phonemizeWord("beten")).toBe("bˈeːtən"); // be- ROOT, dict-stressed on first
        expect(phonemizeWord("bestimmt")).toBe("bəʃtˈɪmt"); // real be- prefix (dict stress ord 1)
        // splittability test: a consonant-initial suffix is only stripped if the stem resolves.
        expect(phonemizeWord("Möglichkeit")).toBe("mˈøːɡlɪçkaɪ̯t"); // möglich·keit (möglich is a word)
        expect(phonemizeWord("endlich")).toBe("ˈɛndlɪç"); // NOT end·lich (end isn't a word)
    });

    test("Run 9 — unstressed loanword vowel tensing (lax → tense, kaikki-derived quality lexicon)", () => {
        expect(phonemizeWord("November")).toBe("nofˈɛmbɐ"); // ɔ → o
        expect(phonemizeWord("digital")).toBe("diɡitˈaːl"); // ɪ → i (×2)
        expect(phonemizeWord("Dezember")).toBe("det͡sˈɛmbɐ"); // ɛ → e
        expect(phonemizeWord("Plural")).toBe("pluʁˈaːl"); // ʊ → u
    });

    test("Run 8 — no stressed schwa (weak-schwa mis-fire on a stressed root → ɛ, lengthened where flagged)", () => {
        expect(phonemizeWord("gesetz")).toBe("ɡəzˈɛt͡s"); // setz is the stressed root, not a schwa ending
        expect(phonemizeWord("generell")).toBe("ɡənəʁˈɛl");
        expect(phonemizeWord("Problem")).toBe("pʁoblˈeːm"); // ɛ→eː (length 1L) + unstressed ɔ→o (quality lexicon)
        expect(phonemizeWord("machen")).toBe("mˈaxən"); // control: genuine unstressed -en schwa unaffected
    });

    test("Run 7 — unstressed e→ə reduction (lexical: native ə, loanword ɛ)", () => {
        expect(phonemizeWord("wesentlich")).toBe("vˈeːzəntlɪç"); // native: -ent- e → ə
        expect(phonemizeWord("anderen")).toBe("ˈandəʁən"); // native: -er- e → ə
        expect(phonemizeWord("helikopter")).toBe("helikˈɔptɐ"); // LOANWORD: unstressed e/i TENSE (quality lexicon), not reduced to ə
    });

    test("Run 6 — Latin -tion/-tial suffix (ti + o/a → t͡si̯), native -tie unaffected", () => {
        expect(phonemizeWord("Aktion")).toBe("akt͡si̯ˈoːn"); // ti + o → t͡si̯
        expect(phonemizeWord("Nation")).toBe("naːt͡si̯ˈoːn");
        expect(phonemizeWord("Garantie")).toBe("ɡaʁantˈiː"); // word-final -tie (ie digraph) → tiː, NOT t͡si̯
        expect(phonemizeWord("Studie")).toBe("ʃtˈuːdɪ"); // ⟨di⟩ not ⟨ti⟩ — unaffected
    });

    test("numbers + text", () => {
        expect(phonemize("21", "de")).toBe("ˈaɪ̯nʊntt͡svant͡sɪç"); // einundzwanzig
        expect(phonemize("100", "de")).toBe("ˈaɪ̯nhʊndɐt"); // einhundert
        expect(phonemize("Ich wohne in Berlin.", "de")).toBe(
            "ɪç vˈoːnə ɪn bəɐ̯lˈiːn .",
        );
    });
});
