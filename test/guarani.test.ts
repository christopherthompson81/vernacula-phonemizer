import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/guarani/guarani.ts";
import { normalizeGuarani } from "../src/languages/guarani/normalize.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Paraguayan Guaraní (gn) — Avañe'ẽ, Tupian, co-official in Paraguay.
// Signature: the 12-vowel system (⟨y⟩→[ɨ] + six NASAL vowels ⟨ã ẽ ĩ õ ũ ỹ⟩), the PRENASALIZED voiced stops
// ⟨mb nd⟩→[ᵐb ⁿd] (⟨ng⟩ is always [ŋ]), the glottal ⟨'⟩ (puso)→[ʔ], ⟨ch⟩→[ʃ], ⟨j⟩→[d͡ʒ], ⟨g⟩→[ɰ] / ⟨gu⟩→[w],
// ⟨ñ⟩→[ɲ]; glide formation (prevocalic i→j, u→w); default final-syllable (oxytone) stress.
// ⚠ Referee: wikipron gug_latn_broad — its folded score is dragged down by NASAL HARMONY, which is partly
// lexical and so not derivable here; symbol accuracy is the meaningful reading.
describe("Guaraní (Avañe'ẽ) canonical IPA", () => {
    test("12 vowels: ⟨y⟩→ɨ + nasal vowels; the glottal ⟨'⟩ (puso)", () => {
        expect(phonemizeWord("y")).toBe("ˈɨ"); // 'water' — ⟨y⟩ is the high central vowel [ɨ]
        expect(phonemizeWord("avañe'ẽ")).toBe("aʋaɲeˈʔẽ"); // 'Guaraní language' — ñ→ɲ, ⟨'⟩→ʔ, nasal ẽ
        expect(phonemizeWord("mba'e")).toBe("ᵐbaˈʔe"); // 'thing' — prenasalized ⟨mb⟩ + puso
        expect(phonemizeWord("tetã")).toBe("teˈtã"); // 'country' — nasal vowel ã
    });

    test("prenasalized stops, ⟨ch⟩, ⟨ñ⟩; ⟨ng⟩ is a plain velar nasal", () => {
        expect(phonemizeWord("ñande")).toBe("ɲaˈⁿde"); // 'our (incl.)' — ñ→ɲ, prenasalized ⟨nd⟩
        expect(phonemizeWord("che")).toBe("ˈʃe"); // 'I/my' — ⟨ch⟩→ʃ
        expect(phonemizeWord("kuñatãi")).toBe("kuɲaˈtãi"); // 'young woman' — nasal ã attracts stress
    });

    test("⟨g⟩/⟨gu⟩ and ⟨j⟩; glide formation", () => {
        expect(phonemizeWord("guata")).toBe("waˈta"); // 'to walk' — ⟨gu⟩ before a back vowel → [w]
        expect(phonemizeWord("jagua")).toBe("d͡ʒaˈwa"); // 'dog' — ⟨j⟩→d͡ʒ, ⟨gu⟩→w
        expect(phonemizeWord("Paraguay")).toBe("paɾawaˈɨ"); // ⟨gu⟩→w, final ⟨y⟩→ɨ
    });

    test("acute accent overrides the default oxytone stress", () => {
        expect(phonemizeWord("mbo'ehára")).toBe("ᵐboʔeˈhaɾa"); // 'teacher' — á accent → stress on ⟨há⟩ (not final)
    });

    test("stress precedes a C+glide onset; the puso curly apostrophe is the glottal stop", () => {
        expect(phonemizeWord("kuéra")).toBe("ˈkweɾa"); // plural — ⟨ku⟩→[kw] is one onset, stress before the whole cluster
        expect(phonemizeWord("guyra")).toBe("ɰɨˈɾa"); // 'bird' — ⟨gu⟩ before the central ⟨y⟩ → [ɰ]
        expect(phonemizeWord("avañe’ẽ")).toBe("aʋaɲeˈʔẽ"); // curly apostrophe ’ (U+2019) → the glottal [ʔ], same as U+0027
    });

    // ═══ CARDINAL NUMBERS — the 20th-century NEOLOGISM system (Decoud Larrosa; Estigarribia 2020 §3.4.3).
    // PROMINENT CAVEAT: Estigarribia calls this system "purely of academic use" — colloquial Paraguayan
    // Guaraní uses SPANISH numerals beyond irundy '4'. We still implement the neologisms because they are the
    // only numerals attested IN GUARANÍ ORTHOGRAPHY (written Guaraní otherwise just prints Arabic digits), so a
    // Spanish-loan path would mean inventing respellings. See src/languages/guarani/numbers.ts for the full
    // argument and sources. This reads as the written/academic register, by design.
    test("cardinals: native 1–4, then the po/pa neologisms (apheresis + fusion)", () => {
        const gn = getPhonemizer("gn");
        expect(gn.text("0").trim()).toBe("ᵐbaʔeˈʋe"); // mba'eve 'nothing'
        expect(gn.text("4").trim()).toBe("iɾuˈⁿdɨ"); // irundy — the last PRE-CONTACT numeral
        expect(gn.text("6").trim()).toBe("poteˈĩ"); // poteĩ = po 'hand' + teĩ (apheresised peteĩ)
        expect(gn.text("11").trim()).toBe("pateˈĩ"); // pateĩ = pa + teĩ, FUSED
        expect(gn.text("13").trim()).toBe("paʔaˈpɨ"); // pa'apy = pa + 'apy (apheresised mbohapy)
        expect(gn.text("21").trim()).toBe("moˈkõipa peteˈĩ"); // mokõipa peteĩ — tens FUSED, then a SPACE
    });

    test("cardinals: the scale words are MULTIPLICATIVE, and the multiplier ONE is dropped", () => {
        const gn = getPhonemizer("gn");
        expect(gn.text("100").trim()).toBe("ˈsa"); // sa (< rasa) — never *peteĩsa
        expect(gn.text("101").trim()).toBe("ˈsa peteˈĩ"); // sa peteĩ
        expect(gn.text("234").trim()).toBe("moˈkõisa ᵐbohapɨˈpa iɾuˈⁿdɨ"); // mokõisa mbohapypa irundy
        expect(gn.text("1000").trim()).toBe("ˈsu"); // su (< guasu)
        expect(gn.text("10000").trim()).toBe("paˈsu"); // pasu = pa × su, the same rule as Estigarribia's pasua
        expect(gn.text("1000000").trim()).toBe("ˈswa"); // sua
        expect(gn.text("10000000").trim()).toBe("paˈswa"); // pasua = pa × sua — straight from the grammar's table
    });
});

// ═══ TEXT NORMALIZATION (src/languages/guarani/normalize.ts) ═══════════════════════════════════════════
// Assertions are on the READING through `phonemize` wherever the point is what a listener hears, and on
// `normalizeGuarani` directly where the point is which rule fired. Per trap 13 these pin the rule's
// BRANCHES — including branches the corpus does not exercise — and not merely the corpus's instances.
describe("Guaraní text normalization", () => {
    // ── THE PUSO'S THREE GLYPHS. The saltillo ⟨ꞌ⟩ U+A78C is ×301 in 433 corpus segments and was SILENTLY
    // DELETED: it is `\p{Script=Latin}`, so it survived tokenization and nativisation and then fell out of
    // `graphemes`, taking a PHONEME of Guaraní with it. U+02BC is the mirror failure — `phonemizeWord`
    // already folds it and could never see it, because it is script COMMON and the tokenizer split the word
    // first. Both must reach the same IPA as the ASCII apostrophe.
    test("the puso: saltillo ⟨ꞌ⟩ and ⟨ʼ⟩ reach the same [ʔ] as ⟨'⟩ and ⟨’⟩", () => {
        const gn = getPhonemizer("gn");
        const want = gn.text("mba'e").trim();
        expect(want).toBe("ᵐbaˈʔe");
        for (const v of ["mba’e", "mbaꞌe", "mbaʼe"]) expect(gn.text(v).trim()).toBe(want); // U+2019, U+A78C, U+02BC
        expect(gn.text("ñeꞌẽ").trim()).toBe("ɲeˈʔẽ"); // 'language/word' — the saltillo word this wiki writes most
        expect(gn.text("Mboꞌehára").trim()).toBe("ᵐboʔeˈhaɾa"); // 'teacher' — puso AND an acute-accented stress
        // ⚠ U+02BC is the one that proves the fix belongs ABOVE the tokenizer: unfolded it SPLIT the word.
        expect(gn.text("ñeʼẽ").trim().split(/\s+/)).toHaveLength(1);
    });

    // ── THE OTHER TWO CHARACTERS THE TOKEN CLASS MISHANDLES. A zero-width space split a word in two; the
    // Spanish ordinal indicator ⟨º⟩ is Latin script, so it was matched as a WHOLE WORD with no grapheme
    // behind it and read as THE EMPTY STRING (11 such tokens in the retained text).
    test("zero-width space does not split a word; ⟨º⟩ no longer reads as the empty string", () => {
        const gn = getPhonemizer("gn");
        expect(gn.text("ñe'ẽ​me").trim().split(/\s+/)).toHaveLength(1);
        expect(normalizeGuarani("1º")).toBe("1");
        expect(normalizeGuarani("15.º")).toBe("15.");
        // ⚠ AND ⟨º⟩ STANDING IN FOR THE DEGREE SIGN IS A DIFFERENT BRANCH — the corpus writes `21º C`,
        // `0º C` and even the feminine `40ª C`, all meaning °C. It must fold, not be deleted.
        expect(normalizeGuarani("21º C")).toBe("21 Celsius");
        expect(normalizeGuarani("40ª C")).toBe("40 Celsius");
    });

    // ── THE ARC-MINUTE MARK IS NOT A PUSO. After the fold above, a coordinate's `'` is indistinguishable
    // from the glottal stop, and `25° 15'` read as *…paˈpo ʔ* — a phoneme INVENTED out of a coordinate.
    // The coordinate reading itself is refused (no Guaraní word for a degree of arc is attested).
    test("a prime after digits is dropped, not read as the glottal stop", () => {
        const gn = getPhonemizer("gn");
        expect(gn.text("25° 15'")).not.toContain("ʔ");
        expect(normalizeGuarani("22°00´")).toBe("22°00");
        // ⚠ THE ADVERSARIAL NEIGHBOUR (trap 8): an ordinary intra-word puso must be untouched by that rule.
        expect(gn.text("mba'e").trim()).toBe("ᵐbaˈʔe");
    });

    // ── DE-GROUPING, the biggest defect this layer repairs. Three conventions at once (period, space and
    // the `&nbsp;` the entity decoder turns into a space), all of which were clause punctuation or token
    // breaks: `1.098.581` read as THREE SENTENCES.
    test("thousands separators: period, space and nbsp all de-group", () => {
        expect(normalizeGuarani("1.098.581")).toBe("1098581");
        expect(normalizeGuarani("12 169 501")).toBe("12169501");
        expect(normalizeGuarani("21 696")).toBe("21696");
        expect(normalizeGuarani("755.838,7")).toBe("755838,7"); // a group followed by its own decimal comma
        const gn = getPhonemizer("gn");
        expect(gn.text("1.324 mm").trim()).toBe("ˈsu ᵐbohapɨˈsa moˈkõipa iɾuˈⁿdɨ miˈlimetɾo"); // 1324 mm
    });

    // ⚠ THE BRANCH THE CORPUS BARELY EXERCISES, and the one guard that separates grouping from a decimal:
    // an integer part beginning with `0`. `0.572` is a Human Development Index figure and must NOT become
    // `0572`. Everything else with three fractional digits in this corpus IS a thousands group.
    test("a leading zero refuses de-grouping — `0.572` is a decimal, not a group", () => {
        expect(normalizeGuarani("0.572")).toBe("0,572");
        expect(normalizeGuarani("1.324")).toBe("1324");
        expect(normalizeGuarani("430.9")).toBe("430,9"); // fewer than three fractional digits: never a group
    });

    // ── THE DECIMAL SEPARATOR IS DELIBERATELY NOT A WORD. Two independent sourcing passes found that
    // written Guaraní never spells one out; `kyguái` is the name of the COMMA, wordlist-grade, and shipping
    // it would be confidently wrong 1,777 times. What the rule does is stop a decimal PERIOD from reading
    // as a sentence end, so both conventions fall out alike.
    test("a decimal reads as a pause, never as an unsourced word", () => {
        const gn = getPhonemizer("gn");
        for (const s of ["8,70 %", "3.61%"]) {
            expect(gn.text(s)).not.toMatch(/kɨwaˈi|ˈkɨta/); // no kyguái, no kyta
        }
        expect(gn.text("3.61%").trim()).toBe("ᵐbohaˈpɨ , poteˈĩpa peteˈĩ ˈpoɾ kjeˈⁿto");
    });

    // ── THE ORDINAL SUFFIX, and this is trap 14: a digit becomes words in the TOKENIZER, so `12ha` could
    // never be made to agree by gluing — it read *paˈkõi ˈha*, "twelve AND", the coordinator. The operand
    // is converted to words inside the rule and the suffix attached to the last of them.
    test("the ordinal `-ha` is attached to the WORDED cardinal, not glued to digits", () => {
        expect(normalizeGuarani("12ha")).toBe("pakõiha"); // 12 → pakõi → pakõiha
        expect(normalizeGuarani("2ha")).toBe("mokõiha"); // the table branch
        expect(normalizeGuarani("21ha")).toBe("mokõipa peteĩha"); // the compositional branch — suffix on the LAST word
        expect(normalizeGuarani("100ha")).toBe("saha"); // the scale branch, where the multiplier ONE is dropped
        const gn = getPhonemizer("gn");
        expect(gn.text("12ha").trim()).toBe("paˈkõiha");
    });

    // ⚠ THE RIGHT CONTEXT IS THE DISCRIMINATOR (trap 24). One of the corpus's fifteen `Nha` is the
    // COORDINATOR written tight against a year — `Ijapytépe 1932ha 1934`, "between 1932 and 1934" — and an
    // ordinal is never immediately followed by a bare number. 14 fixed, 1 declined, 0 broken.
    test("`Nha` followed by a bare number is the conjunction, and is declined", () => {
        expect(normalizeGuarani("1932ha 1934")).toBe("1932ha 1934");
        expect(normalizeGuarani("12ha producto")).toBe("pakõiha producto");
    });

    // ── THE SHARED TIER. Every word here is attested on gn.wikipedia in the slot; `kilómetro` and
    // `kilogramo` come from articles that name their own abbreviation in Guaraní prose.
    test("units, the squared/cubed words, currency and percent", () => {
        const gn = getPhonemizer("gn");
        expect(gn.text("5 km").trim()).toBe("ˈpo kiˈlometɾo");
        expect(gn.text("1.540 milímetro").trim()).toContain("miˈlimetɾo"); // already spelled: not doubled
        expect(gn.text("27 km²").trim()).toBe("moˈkõipa poˈkõi kiˈlometɾo kwadɾaˈdo");
        expect(gn.text("27 km2").trim()).toBe("moˈkõipa poˈkõi kiˈlometɾo kwadɾaˈdo"); // the ASCII exponent too
        expect(gn.text("1 m³").trim()).toBe("peteˈĩ metˈɾo ˈkubiko");
        expect(gn.text("$65.000").trim()).toBe("poteˈĩpa poˈsu ˈdolaɾ"); // 65000 dollars, de-grouped first
        expect(gn.text("US$ 121").trim()).toBe("ˈsa moˈkõipa peteˈĩ ˈdolaɾ"); // the compound key
        expect(gn.text("50%").trim()).toBe("poˈpa ˈpoɾ kjeˈⁿto");
        expect(gn.text("44 sua km²").trim()).toBe("iɾuⁿdɨˈpa iɾuˈⁿdɨ ˈswa kiˈlometɾo kwadɾaˈdo"); // magnitude hop
    });

    // ⚠⚠ THE REFUSAL THAT MATTERS MOST IN THIS LANGUAGE. `sources.ts` reports `ha` ×30 after a number and
    // invites declaring the HECTARE. Every one of those thirty is the coordinator "and" or the ordinal
    // suffix — ZERO hectares — so `ha` is not a unit key and a number followed by it must stay a number.
    test("`ha` is NEVER the hectare — the conjunction and the ordinal own those thirty instances", () => {
        const gn = getPhonemizer("gn");
        const r = gn.text("70 ha 80% rupi").trim();
        expect(r).toBe("poˈkõipa ˈha poapɨˈpa ˈpoɾ kjeˈⁿto ɾuˈpi"); // "70 AND 80 percent"
        expect(r).not.toContain("hekˈtaɾea");
        expect(normalizeGuarani("1.400 ha 1.600 milímetro")).toBe("1400 ha 1600 milímetro");
    });

    // ── TEMPERATURE. `39°C` read as *…poɾuˈⁿdɨ k* — the sign dropped AND ⟨C⟩ read through `graphemes` as a
    // bare [k], a stray consonant emitted as a word (trap 56: a defect that produces a READING). The SCALE
    // name is sourced and the degree word is not, so this deliberately under-reads rather than inventing.
    test("°C reads the scale name and drops the stray [k]; the degree word is withheld", () => {
        const gn = getPhonemizer("gn");
        expect(gn.text("39°C").trim()).toBe("ᵐbohapɨˈpa poɾuˈⁿdɨ kelˈsjus");
        expect(gn.text("23 °C").trim()).toBe("moˈkõipa ᵐbohaˈpɨ kelˈsjus");
        expect(normalizeGuarani("100°F")).toBe("100 Fahrenheit");
        // ⚠ A BARE ° IS NOT A TEMPERATURE and must not pick up the scale name (`1° jasypápe` is a date).
        expect(normalizeGuarani("1° jasypápe")).toBe("1° jasypápe");
    });

    // ── YEAR SPANS take the corpus's own frame, `guive … peve`, which it writes out between digits itself
    // (`1932 guive 1935 peve oiko Cháko Ñorairõ`). Both are POSTPOSITIONS taking one operand each, so the
    // infix position is grammatical — unlike Fula's `hakkunde`, the standing part-of-speech check.
    test("a four-digit year span takes `guive … peve`", () => {
        expect(normalizeGuarani("1816-1828")).toBe("1816 guive 1828 peve");
        expect(normalizeGuarani("1864–1870")).toBe("1864 guive 1870 peve"); // en dash too
    });

    // ⚠ A SPAN THAT ENDS THE CLAUSE IS STILL A SPAN (playbook trap 58) — A BRANCH REPAIR WITH NO CORPUS
    // INSTANCE, and said so rather than counted as a win (trap 22). The right guard rejected a bare `.` or
    // `,`, which is a clause end far more often than a number's interior; this corpus has no clause-final
    // FOUR-DIGIT pair, so the corpus diff is 0 and the branch is pinned here instead.
    test("a clause-final year span keeps its joiner AND its pause", () => {
        expect(normalizeGuarani("1816-1828.")).toBe("1816 guive 1828 peve.");
        expect(normalizeGuarani("1932-1935, oiko")).toBe("1932 guive 1935 peve, oiko");
        // the separator-plus-digit half is what still refuses `12-14.000`, and the cap still refuses the
        // Spanish page range and the ISBN tail even when the sentence ends on them
        expect(normalizeGuarani("12-14.000 ary")).toBe("12-14000 ary");
        expect(normalizeGuarani("20: 169-180.")).toBe("20: 169-180.");
        expect(normalizeGuarani("ISBN: 99925-68-04-06.")).toBe("ISBN: 99925-68-04-06.");
    });

    // ⚠ THE MEASURED REFUSALS. Of 28 hyphen-joined digit pairs in the retained text only 9 are spans; the
    // four-digit cap and the hyphen-chain guard refuse the other 19 — ISBNs, telephone numbers, Spanish
    // page ranges and a two-date lifespan. 9 fixed, 0 broken.
    test("ISBNs, page ranges and telephone numbers are not spans", () => {
        expect(normalizeGuarani("ISBN: 99925-68-04-06")).toBe("ISBN: 99925-68-04-06");
        expect(normalizeGuarani("978-84-206-2566-9")).toBe("978-84-206-2566-9");
        expect(normalizeGuarani("20: 169-180")).toBe("20: 169-180"); // a Spanish journal citation
        expect(normalizeGuarani("ary 1907-24 jasypateĩ")).toBe("ary 1907-24 jasypateĩ"); // two dates, not a span
    });

    // ── THE CLOCK, and the narrowness is the whole measurement (trap 55, the `ilo` case). The `clock` cell
    // reports ×158 whole-corpus on a `\d{1,2}[:.]\d{2}` regex which in THIS corpus mostly matches a grammar
    // article's SECTION NUMBERS and any two-digit decimal. Only the colon form, only on the hour — `aravo`
    // is richly sourced, the minute-joining frame is not, so a non-zero time is refused WHOLE.
    test("the clock is read on the hour only, and never in the dot form", () => {
        const gn = getPhonemizer("gn");
        expect(gn.text("11:00").trim()).toBe("pateˈĩ aɾaˈʋo");
        expect(normalizeGuarani("16:00")).toBe("16 aravo");
        expect(normalizeGuarani("1:15")).toBe("1:15"); // a non-zero minute is refused whole
        expect(normalizeGuarani("3.4.10.")).toBe("3.4.10."); // a section number is NOT a clock
        expect(normalizeGuarani("3.61%")).toBe("3,61 por ciento"); // nor is a two-digit decimal
        // ⚠ AND IT MUST NOT DOUBLE A NOUN THE TEXT ALREADY WROTE (trap 12) — the wiki writes `15:30 aravo`.
        expect(normalizeGuarani("12:00 aravo")).toBe("12:00 aravo");
    });

    // ── ORDINARY TEXT MUST SURVIVE. The hard-set proves the rules fire; only ordinary prose shows what a
    // rule BREAKS, and every rule above matches on shapes that Guaraní words also contain (`ha`, `-ha`,
    // an apostrophe, a period).
    test("ordinary Guaraní prose is untouched", () => {
        for (const s of [
            "Avañe'ẽ ha karaiñe'ẽ ha'e Paraguái retãme ñe'ẽ tee.",
            "Ko táva pe oiko heta tapicha ha oguereko mbo'ehao.",
            "Ñe'ẽ peteĩha ha'e jueheguaty réra ha mokõiha ha'e peteĩ juehegua.",
        ]) expect(normalizeGuarani(s)).toBe(s);
    });
});
