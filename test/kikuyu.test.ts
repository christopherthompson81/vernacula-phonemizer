import { describe, expect, test } from "vitest";

import { phonemizeWord, createKikuyu } from "../src/languages/kikuyu/kikuyu.ts";
import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/kikuyu/numbers.ts";
import { normalizeKikuyu } from "../src/languages/kikuyu/normalize.ts";

// Canonical-IPA goldens for Kikuyu / Gĩkũyũ (ki) — Niger-Congo BANTU (E51), Latin orthography, the largest language
// of Kenya (~8M). Hand-adjudicated against en.wiktionary Kikuyu (1062 IPA words), which is also the referee
// (tools/referee-eval) — its folds strip tone (unwritten), downstep, length, and the glide/sibilant/tap
// notation. Signatures: a 7-vowel ATR system where the TILDE is vowel QUALITY not nasalization
// (⟨ĩ⟩=e, ⟨ũ⟩=o, ⟨e⟩=ɛ, ⟨o⟩=ɔ); Bantu FRICATIVIZATION (⟨b⟩=β, ⟨th⟩=ð, ⟨g⟩=ɣ, ⟨c⟩=ɕ); PRENASALIZED digraphs
// (⟨mb⟩=ᵐb, ⟨nd⟩=ⁿd, ⟨nj⟩=ᶮdʑ, ⟨ng⟩=ᵑɡ); ⟨ng'⟩=ŋ, ⟨ny⟩=ɲ, ⟨r⟩=ɾ. TONE (2-tone H/L + downstep) is not written →
// not emitted; cardinal numbers are covered in their own describe block below.
describe("Kikuyu canonical IPA — greedy g2p (Bantu fricativization + prenasalization)", () => {
    test("7-vowel ATR: the TILDE is vowel QUALITY not nasal — ⟨ĩ⟩=e, ⟨ũ⟩=o; ⟨e⟩=ɛ, ⟨o⟩=ɔ", () => {
        expect(phonemizeWord("Gĩkũyũ")).toBe("ɣekojo"); // ⟨ĩ⟩→e, ⟨ũ⟩→o (the endonym)
        expect(phonemizeWord("gatego")).toBe("ɣatɛɣɔ"); // ⟨e⟩→ɛ, ⟨o⟩→ɔ
        expect(phonemizeWord("mũndũ")).toBe("moⁿdo"); // "person" — ⟨ũ⟩→o, ⟨nd⟩→ⁿd
    });

    test("Bantu FRICATIVIZATION: ⟨b⟩=β, ⟨th⟩=ð, ⟨g⟩=ɣ, ⟨c⟩=ɕ; ⟨r⟩=ɾ", () => {
        expect(phonemizeWord("thaatũ")).toBe("ðaːto"); // "three" — ⟨th⟩→ð, ⟨aa⟩→aː, ⟨ũ⟩→o
        expect(phonemizeWord("biacara")).toBe("βiaɕaɾa"); // ⟨b⟩→β, ⟨c⟩→ɕ, ⟨r⟩→ɾ
        expect(phonemizeWord("gatarũ")).toBe("ɣataɾo"); // ⟨g⟩→ɣ (Dahl's Law is orthographic)
    });

    test("PRENASALIZED digraphs ⟨mb⟩=ᵐb, ⟨nj⟩=ᶮdʑ, ⟨ng⟩=ᵑɡ; ⟨ng'⟩=ŋ, ⟨ny⟩=ɲ", () => {
        expect(phonemizeWord("mbaara")).toBe("ᵐbaːɾa"); // ⟨mb⟩→ᵐb
        expect(phonemizeWord("Njoroge")).toBe("ᶮdʑɔɾɔɣɛ"); // ⟨nj⟩→ᶮdʑ, ⟨g⟩→ɣ
        expect(phonemizeWord("bongwe")).toBe("βɔᵑɡwɛ"); // ⟨ng⟩→ᵑɡ + ⟨w⟩
        expect(phonemizeWord("nyama")).toBe("ɲama"); // ⟨ny⟩→ɲ
        expect(phonemizeWord("kĩng'angi")).toBe("keŋaᵑɡi"); // ⟨ng'⟩→ŋ (distinct from ⟨ng⟩→ᵑɡ)
    });

    test("text: words + clause punctuation (tone deferred)", () => {
        expect(createKikuyu().text("Gĩkũyũ nĩ rũthiomi.")).toBe("ɣekojo ne ɾoðiɔmi .");
    });
});

// CARDINAL NUMBERS (ki). The compositor emits the CITATION / COUNTING series (ĩmwe, igĩrĩ, ithatũ …) — the shape
// used counting aloud, since a bare integer gives the adjectival 1–5 no noun to agree with. The ALGORITHM is
// shared with Kamba (src/languages/kikuyu/e5xNumbers.ts, imported by kam) — same E5x formation, different words.
// Sources are cited in kikuyu.jsonc "numbers" — and ⚠ the MULTIPLIER slots were re-measured on the
// normalization run: Omniglot's list gives the citation form where the language writes a class concord, and
// five tens plus two hundreds plus the million word were corrected against the corpus, `attest.ts` and the
// Gĩkũyũ Bible. The affected expectations below say which form was replaced and why.
describe("Kikuyu cardinal numbers — the E5x citation series", () => {
    test("units + the additive teens", () => {
        expect(numberToWords(0)).toBe("kĩbũgũ");
        expect(numberToWords(7)).toBe("mũgwanja");
        expect(numberToWords(11)).toBe("ikũmi na ĩmwe");
        expect(numberToWords(19)).toBe("ikũmi na kenda");
    });
    // ⚠ THE TENS MULTIPLIER TAKES CLASS-4 CONCORD FROM `mĩrongo`, and this test asserted the opposite until
    // the normalization run re-measured it. The old expectations here (`mĩrongo ithathatũ`, `mĩrongo ithano`)
    // came from Omniglot's list, which gives the class-agnostic CITATION form in the multiplier slot; the
    // language does not write it there. `attest.ts` on ki.wikipedia: `mĩrongo ithathatũ` ×0 against `mĩrongo
    // ĩtandatũ` ×3, `mĩrongo ithano` ×0 against `mĩrongo ĩtano` ×2, and the same 0-vs-N for 3, 4 and 8. The
    // mined corpus spells four of them out (`mĩrongo ĩtandatũ na ithatũ` = 1963, `mĩrongo ĩtano na inya` =
    // 54, `mĩrongo ĩna na matano` = 45, `mĩrongo ĩnana na mũgwanja` = 87), and the Gĩkũyũ Bible (GKY) uses
    // `mĩrongo ĩtatũ` / `mĩrongo ĩtandatũ` in Mathayo 13 and `mĩkono ĩtano` / `mĩkono ĩtandatũ` in 1 Athamaki
    // 6:6 — the same class-4 concord on a different mĩ- noun. Corrected here rather than preserved (trap 5).
    test("tens are mĩrongo + its CLASS-4 multiplier series — the ĩ- concord, not the citation form", () => {
        expect(numberToWords(20)).toBe("mĩrongo ĩrĩ"); // ĩrĩ, not igĩrĩ
        expect(numberToWords(21)).toBe("mĩrongo ĩrĩ na ĩmwe");
        expect(numberToWords(60)).toBe("mĩrongo ĩtandatũ"); // NOT the citation ithathatũ
        expect(numberToWords(40)).toBe("mĩrongo ĩna"); // NOT inya
        expect(numberToWords(80)).toBe("mĩrongo ĩnana"); // NOT inyanya
        expect(numberToWords(7)).toBe("mũgwanja"); // 7 and 9 are invariant in BOTH slots
        expect(numberToWords(70)).toBe("mĩrongo mũgwanja");
    });
    // The class-6 `ma-` concord is the same mechanism one class over, and 6/8 were corrected with it:
    // `matandatũ` ×3 (*marĩtwa matandatũ*, *magũrũ matandatũ*) and `manana` ×6 (*mahati manana*, *mabũrũri
    // manana*) are the attested class-6 forms of six and eight, where the table had left the citation forms.
    test("hundreds take the cl.6 magana series", () => {
        expect(numberToWords(100)).toBe("igana rĩmwe");
        expect(numberToWords(200)).toBe("magana meerĩ");
        expect(numberToWords(600)).toBe("magana matandatũ"); // NOT the citation ithathatũ
        expect(numberToWords(800)).toBe("magana manana"); // NOT inyanya
        expect(numberToWords(555)).toBe("magana matano mĩrongo ĩtano na ithano"); // "na" only before the last part
    });
    // ⚠ 555 also pins the SLOT SPLIT, which is the whole point of the correction: the tens multiplier is the
    // class-4 `ĩtano` and the trailing unit is the citation `ithano`. Same value, two different words, and a
    // table that used one form for both got the middle of every 30–69 and 80–89 wrong.
    test("thousands + millions; 10⁹ is a THOUSAND MILLION (no borrowed 'billion')", () => {
        expect(numberToWords(1000)).toBe("ngiri ĩmwe");
        expect(numberToWords(2000)).toBe("ngiri igĩrĩ");
        // ⚠ `mĩrioni` was ×0 in the 3921-paragraph corpus AND ×0 on ki.wikipedia. `mirioni` is ×14/11 with
        // the sense read (*andu ta mirioni igana rimwe*, *dolari mirioni 4.33*) and ×8 in the corpus.
        expect(numberToWords(1000000)).toBe("mirioni ĩmwe");
        expect(numberToWords(1000000000)).toBe("mirioni ngiri ĩmwe");
    });
    test("end-to-end through the g2p", () => {
        expect(phonemize("20","ki").trim()).toBe("meɾɔᵑɡɔ eɾe"); // ⟨ĩ⟩→e (tilde = vowel QUALITY)
        expect(phonemize("100","ki").trim()).toBe("iɣana ɾemwɛ");
    });
});

// TEXT NORMALIZATION (src/languages/kikuyu/normalize.ts). Asserted through `phonemize` wherever the reading is
// what matters, and through `normalizeKikuyu` where the point is the TEXT rewrite and the IPA would only
// obscure it. Counts quoted here are from tools/corpus/mined/ki.jsonc; the file's header carries the sourcing
// for every word and the counted reason for every refusal.
// ⚠ THE BRANCHES ARE PINNED, NOT THE CORPUS'S INSTANCES (trap 13): each rule's claim arm, its refusal arm and
// the boundary between them get a case, and several of those cases are shapes this corpus does NOT contain.
describe("Kikuyu text normalization", () => {
    test("the ORTHOGRAPHIC-SUBSTITUTE fold — the tilde vowels a contributor's keyboard could not write", () => {
        // 148 vowels in 26 of the artifact's 372 paragraphs (7.0%). Unfolded, each one is DELETED by the g2p:
        // nyamű → *ɲam*, mūndū → *mⁿd*, kūrī → *kɾ*, Îri → *ɾi*.
        expect(normalizeKikuyu("nyamű műno andű")).toBe("nyamũ mũno andũ"); // U+0171
        expect(normalizeKikuyu("mūndū kūrī ūrīa")).toBe("mũndũ kũrĩ ũrĩa"); // U+016B + U+012B
        expect(normalizeKikuyu("mûno igûrû kîa Îri")).toBe("mũno igũrũ kĩa Ĩri"); // U+00FB / U+00EE / U+00CE
        // ⚠ THE REPAIR IS ON THE TEXT PATH, which is where the layer lives — `phonemizeWord` is the
        // bare word path and still sees the raw letter, which is correct: the referee reads properly
        // spelled wiktionary headwords and must not be handed a rewrite.
        expect(phonemize("nyamű", "ki").trim()).toBe(phonemize("nyamũ", "ki").trim());
        expect(phonemize("mūndū", "ki").trim()).toBe("moⁿdo");
        // ⚠ THE ACUTE ACCENTS ARE DELIBERATELY NOT FOLDED — see the header. `Fágúnwà` must survive intact.
        expect(normalizeKikuyu("Fágúnwà na Márquez")).toBe("Fágúnwà na Márquez");
    });

    test("de-grouping, and the two comma shapes that are NOT numbers", () => {
        expect(normalizeKikuyu("1,312")).toBe("1312");
        expect(normalizeKikuyu("70,560,000")).toBe("70560000");
        // The maths article's digit list and interval pair — declined by the exactly-three-digits rule.
        expect(normalizeKikuyu("ndari 1,2,3,4,5,6,7,8,9")).toBe("ndari 1,2,3,4,5,6,7,8,9");
        expect(normalizeKikuyu("ndari(0,1)")).toBe("ndari(0,1)");
        // and the grouped number that ends a clause keeps its pause (the `(?!\d|[.,]\d)` half)
        expect(normalizeKikuyu("ta 3,066.3 ft")).toBe("ta 3066 3 ft");
    });

    test("ranges take `nginya`, ASCENDING only — the descending pairs are birth–death lines", () => {
        expect(normalizeKikuyu("1891-1978")).toBe("1891 nginya 1978");
        expect(normalizeKikuyu("kuma 2013 nginya 2017")).toBe("kuma 2013 nginya 2017"); // already spelled out
        expect(normalizeKikuyu("1849 – 27 February 1936")).toBe("1849 – 27 February 1936"); // day, not a year
        // ⚠ THE CHESS ARM, which this corpus has twice and the sibling layer's guard does not carry.
        expect(normalizeKikuyu("(+1 -3 =0)")).toBe("(+1 -3 =0)");
        // ⚠ A DECIMAL RANGE IS DECLINED — the stated limit, not an oversight. The decimal step still
        // runs on the left operand, so the pair reads as two juxtaposed quantities with no false pause.
        expect(normalizeKikuyu("kilo 30.9-72")).toBe("kilo 30 9-72");
    });

    // ⚠ A SPAN THAT ENDS THE CLAUSE IS STILL A SPAN (playbook trap 58). The right guard rejected a bare
    // `.` or `,`, which is a sentence end far more often than a number's interior, so `p 237–240.` came back
    // untouched and read as two juxtaposed cardinals with no joiner at exactly the position a sentence ends.
    // The test is on the BRANCH, not on the corpus instance (trap 13): the separator must be followed by a
    // DIGIT to count as a continuation of the number.
    test("a clause-final span keeps its joiner AND its pause", () => {
        expect(normalizeKikuyu("p 237–240.")).toBe("p 237 nginya 240.");
        expect(normalizeKikuyu("mwaka wa 1991- 2009.")).toBe("mwaka wa 1991 nginya 2009.");
        expect(normalizeKikuyu("mwaka wa 1991-2009, na")).toBe("mwaka wa 1991 nginya 2009, na");
        // and the decimal half of the guard is untouched — a separator WITH a digit still declines
        expect(normalizeKikuyu("kilo 20-43.5")).toBe("kilo 20-43 5");
        // the chess arm is unaffected: it lives in the LEFT guard
        expect(normalizeKikuyu("(+2 -5 =2).")).toBe("(+2 -5 =2).");
    });

    test("percent is `harĩ igana`, composed from the engine's own hundred word and attested in the slot", () => {
        expect(normalizeKikuyu("gĩcunjĩ kĩa 33% kĩa thĩ")).toBe("gĩcunjĩ kĩa 33 harĩ igana kĩa thĩ");
        // the corpus's own frame, with the decimal tail carried into the operand and spelled out after
        expect(phonemize("gĩcunjĩ kĩa 29.2%", "ki").trim())
            .toBe("ɣeɕuᶮdʑe kea meɾɔᵑɡɔ eɾe na kɛⁿda iɣeɾe haɾe iɣana");
    });

    test("the dollar noun PRECEDES its amount, and is not said twice", () => {
        expect(normalizeKikuyu("$2.7 million")).toBe("dolari 2 7 million");
        expect(normalizeKikuyu("US$486,840")).toBe("dolari 486840");
        // trap 12: the sentence already names the currency
        expect(normalizeKikuyu("dolari milioni 4.35 na $5")).toBe("dolari milioni 4 3 5 na 5");
    });

    test("units are noun-FIRST, and the one-letter `m` key keeps its version guard (trap 46)", () => {
        expect(normalizeKikuyu("ta 1661 m (5450 ft)")).toBe("ta mita 1661 (5450 ft)"); // ft declined: an English gloss
        expect(normalizeKikuyu("ta 934.6 m")).toBe("ta mita 934 6");
        expect(normalizeKikuyu("200km")).toBe("kilomita 200");
        expect(normalizeKikuyu("12.5km")).toBe("kilomita 12 5"); // a two-letter key still reads glued
        // ⚠ THE BRANCH THIS CORPUS DOES NOT CONTAIN, which is exactly why it is pinned:
        expect(normalizeKikuyu("802.11m")).toBe("802.11m");
        expect(normalizeKikuyu("241 m3/s")).toBe("241 m3/s"); // no cube word — declined, not guessed
        expect(normalizeKikuyu("kilomita 41,200km")).toBe("kilomita 41200"); // trap 12, the corpus's own case
    });

    test("decimals lose the separator and keep every digit — there is no point word to insert", () => {
        expect(normalizeKikuyu("2.7")).toBe("2 7");
        // ⚠ reading the tail as a NUMBER would say a different quantity, so the digits are spaced apart
        expect(phonemize("1.25", "ki").trim()).toBe("emwɛ iɣeɾe iðanɔ");
        // the numbered dictionary clauses this corpus writes are not quantities
        expect(normalizeKikuyu("11.3.42 kĩbaũ")).toBe("11.3.42 kĩbaũ");
        // and the comma is a grouping mark and a pause in this language, never a decimal
        expect(normalizeKikuyu("0,5")).toBe("0,5");
    });

    test("the English ordinal suffix is stripped; Kikuyu spells its own ordinals as words", () => {
        expect(normalizeKikuyu("21st Century Fox")).toBe("21 Century Fox");
        expect(normalizeKikuyu("70th Birthday")).toBe("70 Birthday");
        expect(normalizeKikuyu("wa kerĩ")).toBe("wa kerĩ"); // the language's own ordinal, untouched
    });

    test("HTML entities are folded and NO ampersand word is spent", () => {
        expect(normalizeKikuyu("kilomita 700². &nbsp;&nbsp;Nĩ")).toBe("kilomita 700². Nĩ");
        expect(normalizeKikuyu("Niia & Lil Wayne")).toBe("Niia & Lil Wayne"); // an English name; nothing to say
    });
});
