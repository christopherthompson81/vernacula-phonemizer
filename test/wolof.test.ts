import { describe, expect, test } from "vitest";

import { createWolof, phonemizeWord } from "../src/languages/wolof/wolof.ts";
import { numberToWords } from "../src/languages/wolof/numbers.ts";
import { normalizeWolof } from "../src/languages/wolof/normalize.ts";

// Canonical-IPA goldens for Wolof / Wolof (wo) — Atlantic-Congo (Senegambian), Latin orthography, NON-tonal.
// Hand-adjudicated against kaikki Wolof (Wiktionary). ⚠ The referee is 69 words (tools/referee-eval) — the folds strip stress, syllable dots, and the variable word-initial
// glottal onset. Signatures: ATR vowels (⟨e⟩=ɛ / ⟨é⟩=e, ⟨o⟩=ɔ / ⟨ó⟩=o, ⟨ë⟩=ə, ⟨à⟩=aː), DOUBLING = length /
// gemination, the palatal STOPS ⟨c⟩=c / ⟨j⟩=ɟ. Numbers are QUINARY (see below); the Arabic (Wolofal) /
// Garay scripts are deferred.
describe("Wolof canonical IPA — greedy g2p + gemination", () => {
    test("ATR vowels: ⟨e⟩=ɛ / ⟨é⟩=e, ⟨o⟩=ɔ / ⟨ó⟩=o, ⟨ë⟩=ə", () => {
        expect(phonemizeWord("cere")).toBe("cɛrɛ"); // "couscous" — ⟨e⟩ → ɛ
        expect(phonemizeWord("jigéen")).toBe("ɟiɡeːn"); // "woman" — ⟨é⟩ → e, ⟨ée⟩ → eː (long)
        expect(phonemizeWord("gox")).toBe("ɡɔx"); // "neighbourhood" — ⟨o⟩ → ɔ
        expect(phonemizeWord("góor")).toBe("ɡoːr"); // "man" — ⟨ó⟩ → o, ⟨óo⟩ → oː (long)
        expect(phonemizeWord("kër")).toBe("kər"); // "house" — ⟨ë⟩ → ə
    });

    test("palatal STOPS ⟨c⟩=c, ⟨j⟩=ɟ; dorsals ⟨x⟩=x; ⟨ñ⟩=ɲ", () => {
        expect(phonemizeWord("baaxoñ")).toBe("baːxɔɲ"); // ⟨aa⟩→aː (long), ⟨x⟩→x, ⟨ñ⟩→ɲ
        expect(phonemizeWord("ndox")).toBe("ndɔx"); // "water" — ⟨nd⟩ + ⟨x⟩
        expect(phonemizeWord("ñuul")).toBe("ɲuːl"); // "black" — ⟨ñ⟩→ɲ, ⟨uu⟩→uː
    });

    test("CONSONANT GEMINATION (doubled → Cː) and nasal assimilation (⟨n⟩→ŋ before g/k)", () => {
        expect(phonemizeWord("benn")).toBe("bɛnː"); // "one" — ⟨nn⟩ → nː
        expect(phonemizeWord("làkk")).toBe("laːkː"); // "language" — ⟨à⟩→aː + ⟨kk⟩→kː
        expect(phonemizeWord("dëjj")).toBe("dəɟː"); // ⟨jj⟩ → ɟː
        expect(phonemizeWord("Angale")).toBe("aŋɡalɛ"); // "English" — ⟨ng⟩ → ŋɡ (nasal assimilation)
    });

    test("long vowels + a common word", () => {
        expect(phonemizeWord("weex")).toBe("wɛːx"); // "white" — ⟨ee⟩ → ɛː
    });

    // NUMBERS — the defining Wolof feature is the QUINARY (base-5) 6–9: they are 5+n compounds on juróom
    // 'five', with no monomorphemic word for six/seven/eight/nine at all. Above ten the system is decimal but
    // MULTIPLICATIVE with the multiplier FIRST (ñaar fukk = 2×10) and the multiplier may itself be quinary
    // (juróom ñeent fukk = (5+4)×10 = 90). Sources: Kosogorova 2023 (SALC 57) §4, Wiktionary Wolof cardinals,
    // Janga Wolof. See src/languages/wolof/numbers.ts.
    test("numbers: the QUINARY 6–9 (juróom + n)", () => {
        expect(numberToWords(5)).toBe("juróom");
        expect(numberToWords(6)).toBe("juróom benn"); // 5+1
        expect(numberToWords(7)).toBe("juróom ñaar"); // 5+2
        expect(numberToWords(8)).toBe("juróom ñett"); // 5+3
        expect(numberToWords(9)).toBe("juróom ñeent"); // 5+4
    });

    test("numbers: fukk tens (multiplier first, possibly quinary) + ak compounds", () => {
        expect(numberToWords(10)).toBe("fukk");
        expect(numberToWords(15)).toBe("fukk ak juróom"); // 10 + 5
        expect(numberToWords(20)).toBe("ñaar fukk"); // 2×10
        expect(numberToWords(21)).toBe("ñaar fukk ak benn");
        expect(numberToWords(47)).toBe("ñeent fukk ak juróom ñaar"); // 4×10 + (5+2)
        expect(numberToWords(90)).toBe("juróom ñeent fukk"); // (5+4)×10 — doubly quinary
        expect(numberToWords(99)).toBe("juróom ñeent fukk ak juróom ñeent");
    });

    test("numbers: téeméer hundreds, junni thousands, milyoŋ millions", () => {
        expect(numberToWords(100)).toBe("téeméer"); // bare, no multiplier
        expect(numberToWords(101)).toBe("téeméer ak benn");
        expect(numberToWords(555)).toBe("juróom téeméer ak juróom fukk ak juróom");
        expect(numberToWords(1000)).toBe("junni");
        expect(numberToWords(12345)).toBe("fukk ak ñaar junni ak ñett téeméer ak ñeent fukk ak juróom");
        expect(numberToWords(1_000_000)).toBe("milyoŋ");
        expect(numberToWords(2_000_000)).toBe("ñaar milyoŋ");
        expect(numberToWords(1_000_000_000)).toBe("milyaar");
    });

    test("numbers: end-to-end through the g2p (text path)", () => {
        expect(createWolof().text("6")).toBe("ɟuroːm bɛnː"); // ⟨óo⟩→oː, ⟨nn⟩→nː
        expect(createWolof().text("20")).toBe("ɲaːr fukː");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION (src/languages/wolof/normalize.ts). ⚠ These pin the rule's BRANCHES, not the corpus's
// instances (playbook trap 13) — including the branches this corpus does NOT exercise, and including the
// REFUSALS, because a refusal that silently starts firing is the same defect as a rule that stops.
describe("Wolof text normalization", () => {
    const say = (t: string): string => createWolof().text(t);

    test("percent → `ci téeméer`, postposed — spaced and glued", () => {
        // The word is attested with the SIGN beside it on wo.wikipedia: "50% (juroom-fukk ci téeméer)".
        expect(normalizeWolof("Wolof (43,3 %)")).toBe("Wolof (43 3 ci téeméer)");
        expect(normalizeWolof("20,3% ci jéeri")).toBe("20 3 ci téeméer ci jéeri");
        expect(normalizeWolof("5% ci at")).toBe("5 ci téeméer ci at");
        // …and it must reach the g2p as WORDS, never as a spelling in the phoneme sink (trap 6).
        expect(say("5%")).toBe("ɟuroːm ci teːmeːr");
    });

    test("currency: the bare sign, the US$ compound key, and the magnitude connective", () => {
        expect(normalizeWolof("$375")).toBe("375 dolaar");
        // `US$` is its own key: the tier's currency pattern is letter-bounded, so a bare `$` cannot reach
        // inside `US$` — without the compound key the sign was dropped and `US` read as a word.
        expect(normalizeWolof("US$5 ngir jàll")).toBe("5 dolaar ngir jàll");
        expect(normalizeWolof("US$ 65 milyoŋ")).toBe("65 milyoŋ ciy dolaar");
        // ⚠ TRAP 12, and this corpus writes it: the text already says `dolaar` after the magnitude and its
        // connective, so the sign must be dropped rather than the word said twice.
        expect(normalizeWolof("$12 miliyaar ciy dolaar")).toBe("12 miliyaar ciy dolaar");
    });

    test("units, including the two the corpus never writes and the one that was a GEMINATE", () => {
        // ⚠ `150mm` read as *…fukː mː* — this engine's gemination rule claims ⟨mm⟩, so the millimetre was a
        // plausible Wolof geminate rather than a visible leak (trap 56).
        expect(say("150mm")).toBe("teːmeːr ak ɟuroːm fukː milimɛt");
        expect(normalizeWolof("2 798 km")).toBe("2798 kilomet");
        expect(normalizeWolof("146km")).toBe("146 kilomet");
        // ⚠ THE UNEXERCISED BRANCH: `cm` is ×0 in this corpus and `kg` ×1. Both are declared, so both are
        // pinned here rather than left to be discovered (trap 8).
        expect(normalizeWolof("40 cm")).toBe("40 sàntimet");
        expect(normalizeWolof("1,5 kg")).toBe("1 5 kilogaraam");
        // The BARE symbol, with no numeral of its own — `makeBareUnitNormalizer`'s path.
        expect(normalizeWolof("ci km kaare lay tollu")).toBe("ci kilomet kaare lay tollu");
    });

    test("the exponent: superscript, ASCII, and the semicolon-less HTML entity", () => {
        expect(normalizeWolof("30.065.000 km²")).toBe("30065000 kilomet kaare");
        // ⚠ `790 km2` read as "…kilometres TWO" in Igbo (trap 53); here the ASCII exponent is claimed.
        expect(normalizeWolof("4,033 km2")).toBe("4033 kilomet kaare");
        // core/markup.ts requires the closing semicolon and wo.wikipedia writes `km&sup2` without one, ×3.
        expect(normalizeWolof("74.900.000 km&sup2")).toBe("74900000 kilomet kaare");
        expect(normalizeWolof("74.900.000 km&sup2;")).toBe("74900000 kilomet kaare"); // idempotent with core
    });

    test("degrees → `aj`, between the operands, with the redundancy guard", () => {
        // Every ° in this corpus is a coordinate or an angle; the position comes from the corpus's own gloss
        // `12°8(fukk ak ñaari aj juroom-ñett)` — the word stands BETWEEN the two numbers.
        expect(normalizeWolof("12°8 ak 16°41")).toBe("12 aj 8 ak 16 aj 41");
        expect(normalizeWolof("0° walla 20°")).toBe("0 aj walla 20 aj");
        // ⚠ TRAP 12: the text glosses the sign, so say it ONCE. After-only, deliberately — see saidAfter.
        expect(normalizeWolof("wu 60° (60 aj) ci bëj-gànnaar")).toBe("wu 60 (60 aj) ci bëj-gànnaar");
        // ⚠ REFUSED: `n° 3` is the French *numéro* in a bibliography, not a degree — no digit precedes it.
        expect(normalizeWolof("série B, n° 3")).toBe("série B, n° 3");
    });

    test("ranges → `ba`, and the three shapes that must NOT be claimed", () => {
        expect(normalizeWolof("Senghor(1906-2001)")).toBe("Senghor(1906 ba 2001)");
        expect(normalizeWolof("( 1265 - 1321 g )")).toBe("( 1265 ba 1321 g )");
        expect(normalizeWolof("yàggug 10-20 fan")).toBe("yàggug 10 ba 20 fan");
        // ⚠ SCRIPTURE, which is this corpus's dominant colon shape — 33 of 33 `N:NN` are verse references.
        expect(normalizeWolof("Jëf 19:26-27 21:27")).toBe("Jëf 19:26-27 21:27");
        // ⚠ NON-ASCENDING is not a span.
        expect(normalizeWolof("1–1 mooy")).toBe("1–1 mooy");
        // ⚠ A NEGATIVE EXPONENT written with the real minus (U+2212), and its ASCII twin after `∙`.
        expect(normalizeWolof("9,10 · 10−31 kg")).toBe("9 1 0 · 10−31 kilogaraam");
        expect(normalizeWolof("1,602 189 2 ∙ 10 -19 C")).toBe("1602 189 2 ∙ 10 -19 C");
    });

    test("de-grouping: all three conventions, and the leading-zero guard that spares a decimal", () => {
        expect(normalizeWolof("$150,000")).toBe("150000 dolaar");
        expect(normalizeWolof("am na 605 695 ciy way-dëkk")).toBe("am na 605695 ciy way-dëkk");
        expect(normalizeWolof("tollu ci 112.622 yu kaare")).toBe("tollu ci 112622 yu kaare");
        // ⚠ A grouped number never opens with a zero, so a `0` head is unambiguously a DECIMAL — this is
        // what claims the corpus's `0.449` (an HDI index) and `0,511 MeV` at a 3-digit tail.
        expect(normalizeWolof("doomi aadama ci 0.449 ci 2021")).toBe("doomi aadama ci 0 4 4 9 ci 2021");
    });

    test("decimals: read digit by digit, and the verse lists that are not decimals", () => {
        // ⚠ NO SEPARATOR WORD. `sources.ts` reports `[NONE] decimal-point`; the only candidate, `tomb`
        // ×33/19, is the geometric POINT (*ñaari tomb yi*, the two poles) and never sits between digits.
        expect(normalizeWolof("Am 15.85 miliyoŋ")).toBe("Am 15 8 5 miliyoŋ");
        expect(normalizeWolof("ak 2,8 milyoŋ")).toBe("ak 2 8 milyoŋ");
        // ⚠ Reading `85` as a NUMBER would say *juróom ñett fukk ak juróom* — eighty-five, a different
        // quantity from "point eight five".
        expect(say("15.85")).toBe("fukː ak ɟuroːm ɟuroːm ɲɛtː ɟuroːm");
        expect(normalizeWolof("ci Jëf 2:9; 19:10,22,26,27")).toBe("ci Jëf 2:9; 19:10,22,26,27");
    });

    test("the dotted era and honorific markers are DE-DOTTED, never expanded", () => {
        // `g.K.` ×23, `j.K.` ×8, `j.m` ×4, `t.s` ×3, `j.y.m` ×3 — every interior dot was a SENTENCE BREAK
        // mid-clause. No expansion is invented: a definitional gloss is the wrong register (nya's era note).
        expect(normalizeWolof("Ci 27 g.K. la juddu")).toBe("Ci 27 g K la juddu");
        expect(normalizeWolof("Yonnant bi (j.m) daan na")).toBe("Yonnant bi (j m) daan na");
        expect(normalizeWolof("darajay Yonant bi (j.y.m)")).toBe("darajay Yonant bi (j y m)");
        // ⚠ THE FINAL DOT SURVIVES WHEN THE SENTENCE VISIBLY ENDS, or the sentence break is lost.
        expect(normalizeWolof("atum 1967 g.K. Te delloosi")).toBe("atum 1967 g K. Te delloosi");
        expect(normalizeWolof("atum 1967 g.K.")).toBe("atum 1967 g K.");
        // ⚠ EVERY ELEMENT MUST BE ONE LETTER, which is what keeps this off a domain name.
        expect(normalizeWolof("ci wo.wikipedia bi")).toBe("ci wo.wikipedia bi");
    });

    test("the ampersand is `ak` — but the ENTITY fold runs first", () => {
        expect(normalizeWolof("soul, R&B, disco")).toBe("soul, R ak B, disco");
        // 7 of the retained corpus's 9 ampersands are entity references, so the tier's `&` rule would read
        // every one of them as "ak" plus a fragment. `&nbsp;` also sits in a number–unit gap.
        expect(normalizeWolof("suufus 10&nbsp;km.")).toBe("suufus 10 kilomet.");
        expect(normalizeWolof("20°. &alpha di ab ngungu")).toBe("20 aj. alpha di ab ngungu");
    });

    test("the refusals, pinned so they cannot start firing by accident", () => {
        // NO CLOCK — 33 of 33 `N:NN` in this corpus are scripture; a ceb-shaped rule fixes 0 and breaks 33.
        expect(normalizeWolof("Marko 14:2 ak Ge 1:26")).toBe("Marko 14:2 ak Ge 1:26");
        // NO FRACTION — 8 of the 10 `N/N` shapes are DATES.
        expect(normalizeWolof("ci 31/12/2007")).toBe("ci 31/12/2007");
        expect(normalizeWolof("cer (2/3) yu fekke")).toBe("cer (2/3) yu fekke");
        // NO `=` — 3 equations against ~9 lexical glosses and 2 wiki heading markers; refused WHOLE, so the
        // reading is byte-identical to what it was (trap 53's `ak` shape, not its Igbo shape).
        expect(normalizeWolof("baziira = gisug xol")).toBe("baziira = gisug xol");
        // ⚠ NO `g` KEY. All 50 digit-adjacent `g` in this corpus are the ERA MARKER, never the gram — the
        // word `garaam` ×3/3 is sourced and the KEY is what is refused.
        expect(normalizeWolof("atum 1967 g.")).toBe("atum 1967 g.");
        expect(normalizeWolof("1392 gg, dëppook")).toBe("1392 gg, dëppook");
        // ⚠ NO `m` KEY. Digit-adjacent bare `m` is ×1 and it is `2012m`, the *miladi* (Gregorian) year
        // marker in an Islamic date — 0 true metres against 1 false positive (trap 46).
        expect(normalizeWolof("ca Tuubaa (aaliya)sosu/2012m.")).toBe("ca Tuubaa (aaliya)sosu/2012m.");
        // NO ENGLISH ORDINAL INVENTED — the Latin suffix is stripped, not translated; Wolof writes `-eel(u)`.
        expect(normalizeWolof("the 20th century")).toBe("the 20 century");
    });
});
