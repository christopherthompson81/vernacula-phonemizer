import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

import { phonemizeWord, createAbkhaz } from "../src/languages/abkhaz/abkhaz.ts";
import { MANIFEST } from "../src/languages/abkhaz/manifest.ts";
import { normalizeAbkhaz } from "../src/languages/abkhaz/normalize.ts";

// Canonical-IPA goldens for Abkhaz (ab) — аҧсуа бызшәа, a Northwest Caucasian language with one of
// the world's largest consonant inventories and just 2 vowels (⟨а⟩→[a], ⟨ы⟩→[ə]). The Cyrillic writes consonants with
// base letters + MODIFIER letters: ⟨ь⟩ palatalizes, ⟨ә⟩ labializes, ⟨'⟩ pharyngealizes. Three-way voiced/aspirated/
// ejective stops. Referee: wikipron abk_cyrl broad + kaikki.
describe("Abkhaz (аҧсуа бызшәа) canonical IPA", () => {
    test("the THREE-WAY stop/affricate series (voiced / aspirated / ejective)", () => {
        expect(phonemizeWord("акы")).toBe("akʼə"); // ⟨к⟩→[kʼ] EJECTIVE; ⟨ы⟩→[ə]
        expect(phonemizeWord("аӡын")).toBe("ad͡zən"); // ⟨ӡ⟩→[d͡z] voiced affricate
        expect(phonemizeWord("аҵла")).toBe("at͡sʼla"); // ⟨ҵ⟩→[t͡sʼ] ejective affricate
        expect(phonemizeWord("аҷкәын")).toBe("at͡ʃʼkʼʷən"); // ⟨ҷ⟩→[t͡ʃʼ], ⟨кә⟩→[kʼʷ] labialized ejective
        expect(phonemizeWord("аҳ")).toBe("aħ"); // ⟨ҳ⟩→[ħ] pharyngeal
    });

    test("the MODIFIERS — ⟨ь⟩ palatal, ⟨ә⟩ labial, ⟨'⟩ pharyngeal", () => {
        expect(phonemizeWord("аҟәа")).toBe("aqʼʷa"); // 'Sukhum' — ⟨ҟә⟩→[qʼʷ] labialized uvular ejective
        expect(phonemizeWord("ажәабжь")).toBe("aʒʷabʒ"); // ⟨жә⟩→[ʒʷ], ⟨жь⟩→[ʒ]
        expect(phonemizeWord("ахәыҷ")).toBe("aχʷət͡ʃʼ"); // ⟨хә⟩→[χʷ]
        expect(phonemizeWord("аҭаацәа")).toBe("atʰaat͡ɕʷʰa"); // ⟨ҭ⟩→[tʰ], ⟨цә⟩→[t͡ɕʷʰ]
    });

    test("the endonym + base letters", () => {
        expect(phonemizeWord("аҧсуа")).toBe("apʰswa"); // 'Abkhaz' — ⟨ҧ⟩→[pʰ] aspirated
        expect(phonemizeWord("бызшәа")).toBe("bəzʃʷa"); // 'language' — ⟨шә⟩→[ʃʷ]
    });

    test("palatalized dorsals (dorsal + ʲ) + the ⟨у⟩/⟨и⟩ glide rule", () => {
        expect(phonemizeWord("зегьы")).toBe("zeɡʲə"); // ⟨гь⟩→[ɡʲ] (VOICED dorsal+ʲ, not the voiceless palatal [c])
        expect(phonemizeWord("аи")).toBe("aj"); // ⟨и⟩ next to a vowel → the glide [j]
        expect(phonemizeWord("иҭабуп")).toBe("itʰabupʼ"); // ⟨у⟩ between consonants → syllabic [u] (not the glide [w])
        expect(phonemizeWord("х’а")).toBe("χˤa"); // the CURLY apostrophe ’ still pharyngealizes ⟨х⟩→[χˤ]
        // ⚠ A GLIDE RUN ALTERNATES FROM ITS ANCHOR — the left context is the REALIZED phone, and an
        // undecided у/и on the right is no context. Keyed on letters instead, every run came out
        // nucleus-free (⟨уу⟩→[ww], ⟨иу⟩→[jw]).
        // Referee rows, exactly two: асууари → kaikki "asuwarij" / wikipron "a s u w a r i j" (our
        // missing final [j] is the referee's phonemic i=əj tail — the documented divergence class),
        // and адиуан → "adiwan", which the letter-keyed rule got WRONG (adjwan).
        expect(phonemizeWord("асууари")).toBe("asuwari");
        expect(phonemizeWord("адиуан")).toBe("adiwan"); // = referee
        // ⚠ NO REFEREE ROW for the rest — pinned for the alternation invariant, not against a source:
        expect(phonemizeWord("диит")).toBe("dijtʼ"); // ⟨ии⟩ → [ij]
        expect(phonemizeWord("ауу")).toBe("awu"); // vowel-anchored twin: glide FIRST, then syllabic
        expect(phonemizeWord("аиуит")).toBe("ajujtʼ"); // the run gets a nucleus (was the nucleus-free ajwjtʼ)
    });

    test("⟨ҩ⟩ is the PHARYNGEALIZED [ɥˤ]", () => {
        // The word corpus writes ɥˤ ~12:1 (kaikki 50× vs 4; wikipron's one non-definition ҩ-word agrees).
        // The bare-ɥ rows are the letter DEFINITION and the numeral series — the referee's inconsistent
        // corner (it also devoices б there). Chirikba /ʕʷ/, Hewitt [ɥˤ].
        expect(phonemizeWord("аҩны")).toBe("aɥˤnə"); // 'house' — kaikki aɥˤnə
        expect(phonemizeWord("ахҩа")).toBe("aχɥˤa"); // wikipron aχɥˤa
    });

    // VIGESIMAL cardinal numbers (numbers.ts). 20–99 is score·20 + a 1–19 remainder, the score in its -и
    // connective form (ҩажәа → ҩажәи); the same -и marks a non-final hundred (шәкы → шәи акы). Thousands are FUSED
    // for a multiplier of 1–10 and for exactly 100; any other multiplier takes the separate word нызқь. The
    // NON-HUMAN / abstract class series is the bare-numeral citation form.
    test("cardinal numbers are VIGESIMAL: score·20 + remainder with the -и connective", () => {
        const ab = createAbkhaz();
        expect(ab.text("7").trim()).toBe("bəʒba"); // быжьба
        expect(ab.text("20").trim()).toBe("ɥˤaʒʷa"); // ҩажәа — the bare score
        expect(ab.text("21").trim()).toBe("ɥˤaʒʷi akʼə"); // ҩажәи акы = 20 + 1
        expect(ab.text("30").trim()).toBe("ɥˤaʒʷi ʒʷaba"); // ҩажәи жәаба = 20 + 10 (no "thirty" word)
        expect(ab.text("45").trim()).toBe("ɥˤənɥˤaʒʷi χʷba"); // ҩынҩажәи хәба = 2×20 + 5
        expect(ab.text("50").trim()).toBe("ɥˤənɥˤaʒʷi ʒʷaba"); // ҩынҩажәи жәаба = 2×20 + 10
        expect(ab.text("67").trim()).toBe("χənɥˤaʒʷi bəʒba"); // хынҩажәи быжьба = 3×20 + 7
        expect(ab.text("89").trim()).toBe("pʰʃənɥˤaʒʷi ʒʷba"); // ԥшьынҩажәи жәба = 4×20 + 9
        expect(ab.text("99").trim()).toBe("pʰʃənɥˤaʒʷi zejʒʷ"); // ԥшьынҩажәи зеижә = 4×20 + 19 (a TEEN attaches too)
    });

    test("cardinal numbers: hundreds with the -и connective, FUSED thousands, millions", () => {
        const ab = createAbkhaz();
        expect(ab.text("100").trim()).toBe("ʃʷkʼə"); // шәкы
        expect(ab.text("101").trim()).toBe("ʃʷi akʼə"); // шәи акы — the hundred takes -и before a remainder
        expect(ab.text("999").trim()).toBe("ʒʷʃʷi pʰʃənɥˤaʒʷi zejʒʷ"); // жәшәи ԥшьынҩажәи зеижә
        expect(ab.text("1000").trim()).toBe("zkʰʲə"); // зқьы
        expect(ab.text("1001").trim()).toBe("zkʰʲə akʼə"); // зқьы акы — the thousand does NOT take -и
        expect(ab.text("2000").trim()).toBe("ɥˤnəzkʰʲ"); // ҩнызқь — FUSED multiplier+нызқь
        expect(ab.text("100000").trim()).toBe("ʃʷnəzkʰʲ"); // шәнызқь — likewise fused
        expect(ab.text("12345").trim()).toBe("ʒʷaɥˤa nəzkʰʲ χəʃʷi ɥˤənɥˤaʒʷi χʷba"); // жәаҩа нызқь хышәи ҩынҩажәи хәба
        expect(ab.text("1000000").trim()).toBe("milljon"); // миллион (Russian loan)
        expect(ab.text("1000000000").trim()).toBe("milljard"); // миллиард
    });
    // ── TEXT NORMALIZATION ─────────────────────────────────────────────────────────────────────────────
    // Counts are over tools/corpus/mined/ab.jsonc (an ab.wikipedia dump). Each rule answers a MEASURED
    // defect, listed in normalize.ts's header — this is the playbook's step 2, pinned.
    test("normalization: the decimal comma is not a clause pause", () => {
        const ab = createAbkhaz();
        // ×120, the commonest numeric form after bare digit runs. It reached clause punctuation and became
        // a sentence break INSIDE a number: 11,3 → "ʒʷejza , χpʰa".
        // ⚠ NO DECIMAL-POINT WORD IS SOURCEABLE for ab (sources.ts: no espeak — it does not ship Abkhaz —
        // and no manifest word), so the fraction is read DIGIT BY DIGIT with no invented connective.
        expect(ab.text("11,3 км").trim()).toBe("ʒʷejza χpʰa kʼilometʼra"); // …and км is a WORD now too
        expect(ab.text("0,723").trim()).toBe("anolʲ bəʒba ɥˤba χpʰa");
    });

    test("normalization: a grouped numeral is ONE number", () => {
        const ab = createAbkhaz();
        // ×13. The group split and the second half read as the WORD zero: 125 000 → "…χʷba anolʲ".
        expect(ab.text("125 000 ҩык").trim()).toBe("ʃʷi ɥˤaʒʷi χʷba nəzkʰʲ ɥˤəkʼ");
        // ⚠ WITHOUT THE LEFT GUARD the 1–3 digit group backtracks into a longer number, so a year beside
        // a count joined into one seven-figure number.
        expect(ab.text("1877 250 ҩык").trim()).not.toContain("milljon");
    });

    test("normalization: a range takes its attested connectives", () => {
        const ab = createAbkhaz();
        // ×71. Both words are the corpus's own, in this exact frame: инаркны ×25 "from", рҟынӡа ×25 "to".
        expect(ab.text("10-11 ашә.").trim()).toBe("ʒʷaba inarkʼnə ʒʷejza rqʼənd͡za aʃʷəʂəkʷʰsa");
        // ⚠ RANGES RUN BEFORE DECIMALS and admit a comma, because the decimal rewrite replaces that comma
        // with a SPACE and destroys the digit-dash-digit shape — "6,4-7,6" (attested) lost its dash.
        expect(ab.text("6,4-7,6").trim()).toContain("inarkʼnə");
        // ⚠ …and the "to" word is not doubled when the text already wrote one.
        expect(ab.text("1800-2000 м рҟынӡа").trim().match(/rqʼənd͡za/gu)?.length).toBe(1);
    });

    test("normalization: ⟨N-тәи⟩ is the ordinal, а + cardinal + тәи", () => {
        const ab = createAbkhaz();
        // ×36 over 12 distinct values. The suffix used to become a separate word: 6-тәи → "fba tʷʼi".
        expect(ab.text("6-тәи").trim()).toBe("afbatʷʼi"); // corpus spells афбатәи
        expect(ab.text("19-тәи").trim()).toBe("azejʒʷtʷʼi");
        expect(ab.text("1-тәи").trim()).toBe("akʼtʷʼi"); // ⚠ suppletive актәи, not *акытәи from акы
        // ⚠ THE SEPARATOR MAY BE A SPACE (×2 vs ×20 hyphenated) — "Совмин 1 тәи ихаҭыԥуаҩ". Also a
        // corpus-diff find: the hard-set only carries the hyphenated form.
        expect(ab.text("1 тәи").trim()).toBe("akʼtʷʼi");
        // ⚠ THE SUPPLETION IS ABOUT THE LAST CARDINAL WORD, not about n === 1 — keying it on the number
        // made every COMPOUND ending in one produce the very form the rule calls impossible: 21-тәи came
        // out аҩажәи *акытәи. Both 21 and 291 are attested in the corpus.
        expect(ab.text("21-тәи").trim()).toBe("aɥˤaʒʷi akʼtʷʼi");
        expect(ab.text("101-тәи").trim()).toBe("aʃʷi akʼtʷʼi");
        // …and the suffix needs a trailing boundary, or it matches the START of a longer word.
        expect(ab.text("5-тәижәа").trim()).not.toContain("aχʷbatʷʼi");
    });

    test("normalization: the year and century abbreviations expand", () => {
        const ab = createAbkhaz();
        // ×125. ⟨ш.⟩ read as a bare letter and its dot as a full stop mid-date. The expansions are the
        // corpus's own spellings (шықәса ×35 inflected, ашәышықәса ×16).
        expect(ab.text("1452ш.").trim()).toBe("zkʰʲə pʰʃəʃʷi ɥˤənɥˤaʒʷi ʒʷaɥˤa ʂəkʷʰsa");
        expect(ab.text("1908-1915 шш.").trim()).toContain("ʂəkʷʰsakʷʰa");
        // ⚠ ⟨ш.ш.⟩ is a spelling of ⟨шш.⟩ (×3 vs ×12) and needs its own row: the abbreviation dot is not
        // a LETTER, so the lookbehind does not stop a ⟨ш⟩-keyed rule matching the second half — it read
        // *шықәсашықәса. Found by reading the corpus diff, not by probing.
        expect(ab.text("1870-74 ш.ш.").trim()).toContain("ʂəkʷʰsakʷʰa");
        // ⚠ THE ABBREVIATION DOT MAY BE THE SENTENCE'S TOO — consuming it unconditionally ran two
        // sentences together with no pause.
        expect(ab.text("Ари 1452ш. Аҩбатәи ауп.").trim()).toContain(" . ");
    });

    // ── SYMBOLS: words sourced from the FULL ab.wikipedia text (docs/abkhaz_vocabulary_investigation.md),
    // because the sampled corpus artifact attests none of them and espeak does not ship Abkhaz. Asserted
    // at the TEXT level: what matters here is which word lands where, not its phonemes.
    test("normalization: percent takes the postposed word — once", () => {
        // Full wiki ×10, always straight after the numeral ("18 процент"). The decimal comma inside
        // "52,8%" must still reach the decimal rule after the word moves in.
        expect(normalizeAbkhaz("аҟынтәи 95%),")).toBe("аҟынтәи 95 процент),");
        expect(normalizeAbkhaz("52,8%")).toBe("52 ааба процент");
        // ⚠ NOT TWICE. Percent and currency go through the shared symbol tier for its already-said
        // suppression — hand-rolled, ⟨95% процент⟩ read *процент процент* (the Malayalam defect).
        expect(normalizeAbkhaz("95% процент")).toBe("95 процент");
    });

    test("normalization: a single comma group de-groups unless it leads with 0", () => {
        // The artifact's own `\d{1,3},\d{3}` instances split 7 thousands-groupings vs 5 decimals, and
        // every decimal begins ⟨0,⟩ — so the integer part is the discriminator. The first version kept
        // ALL single groups as decimals and mis-read the majority class.
        expect(normalizeAbkhaz("301,340 км²")).toBe("301340 километра квадрат");
        expect(normalizeAbkhaz("21,000 К")).toBe("21000 К");
        expect(normalizeAbkhaz("0,723")).toContain("быжьба ҩба хԥа"); // 0,723 stays a decimal
    });

    test("normalization: degrees — ⟨°C⟩ is the attested unit name, bare ⟨°⟩ is градус, ⟨°F⟩ untouched", () => {
        // "180 градус" ×9 postposed; ⟨Цельси иградус⟩ is the СИ article's own name for the unit, and
        // Цельси is NEVER attested bare after a number — so the name is used verbatim.
        expect(normalizeAbkhaz("+23,2 °C ыҟоуп")).toBe("+23 ҩба Цельси иградус ыҟоуп");
        expect(normalizeAbkhaz("анаара 3,4° ауп")).toBe("анаара 3 ԥшьба градус ауп");
        // ⚠ SYMBOLS RUN BEFORE RANGES, or the unit detaches: in "−73–83°C" the range rewrite would leave
        // ⟨°C⟩ touching ⟨рҟынӡа⟩ instead of a digit. The corpus's own string, verbatim — its trailing
        // рҟынӡа also exercises the range rule's no-doubling guard in the same breath.
        expect(normalizeAbkhaz("90–220 К (−73–83°C) рҟынӡа")).toContain("73 инаркны 83 Цельси иградус");
        // No Fahrenheit word is attested (куб- and минус-class gap), so ⟨°F⟩ deliberately falls through.
        expect(normalizeAbkhaz("451 °F")).toBe("451 °F");
        // ⚠ ⟨С⟩ MAY BE CYRILLIC (U+0421 — what a Russian keyboard types). Latin-only, this fell through
        // to the bare rule and GLUED: *градусС.
        expect(normalizeAbkhaz("23 °С ыҟоуп")).toBe("23 Цельси иградус ыҟоуп");
        // ⚠ …and the skip class wants a STANDALONE letter: a following WORD starting with C/F/K must not
        // suppress the degree word ("60° Кырҭтәыла" kept its raw °, silently dropped downstream).
        expect(normalizeAbkhaz("аԥхарра 60° Кырҭтәыла")).toBe("аԥхарра 60 градус Кырҭтәыла");
    });

    test("normalization: currency lands LAST, after any scale word — and never twice", () => {
        // "8 миллиард доллар" (Формула Аку) fixes the order: number, scale, currency. млрд/млн expand to
        // the миллиард/миллион the numbers table carries — by REFERENCE (symbols.scales maps to numbers
        // keys), so the two paths cannot drift.
        expect(normalizeAbkhaz("$1,86 млрд")).toBe("1 ааба фба миллиард доллар");
        expect(normalizeAbkhaz("€ 30 млн")).toBe("30 миллион евро");
        expect(normalizeAbkhaz("£200")).toBe("200 фунт стерлинг");
        expect(normalizeAbkhaz("£29,721,250")).toBe("29721250 фунт стерлинг");
        // ⚠ THE SHARED TIER'S GUARDS, exercised: already-said suppression (the Nepali defect — a written
        // ⟨доллар⟩ after the sum must silence the sign, not double the word)…
        expect(normalizeAbkhaz("$1000 доллар")).toBe("1000 доллар");
        // …and letter-bounded longest-first keys: a bare ⟨$⟩ must not split ⟨US$⟩ and strand a raw "US";
        // ⟨B£⟩ is the corpus's own Brixton pound ("B£20 абанкнотаҿы").
        expect(normalizeAbkhaz("US$30 млрд")).toBe("30 миллиард доллар");
        expect(normalizeAbkhaz("B£20 абанкнотаҿы")).toBe("20 фунт абанкнотаҿы");
    });

    test("normalization: the scale dot is consumed — unless it is the sentence's", () => {
        // млн./млрд. are the dotted Russian-convention spellings (attested in sibling corpora); undotted
        // they left a stray full stop that read as a sentence break mid-noun-phrase.
        expect(normalizeAbkhaz("30 млн. аԥара")).toBe("30 миллион аԥара");
        // Same re-emit rule as the year abbreviations: whitespace + upper-case means the dot was doing
        // double duty as the full stop.
        expect(normalizeAbkhaz("30 млн. Аҩбатәи")).toBe("30 миллион. Аҩбатәи");
        // The scales map must reference REAL numbers keys — loadManifest casts without validating, so a
        // typo there would reach the output as the literal string "undefined".
        for (const slot of Object.values(MANIFEST.symbols.scales))
            expect(typeof MANIFEST.numbers[slot]).toBe("string");
    });

    test("normalization: ⟨км⟩/⟨м⟩ read as the corpus's own километра/метра — squared composes", () => {
        // The corpus's own digit-adjacent spellings ("900 метра", "15-20 километра"; attest.ts: метра
        // ×35, километра ×27 on the live wiki, incl. "600 инаркны 1600 метра рҟынӡа" — our range frame).
        expect(normalizeAbkhaz("11,3 км")).toBe("11 хԥа километра");
        expect(normalizeAbkhaz("150 м здиаметр")).toBe("150 метра здиаметр");
        expect(normalizeAbkhaz("422 000 км². Иара")).toBe("422000 километра квадрат. Иара");
        // ⚠ THE ASCII EXPONENT IS THE SAME CLASS: the corpus writes "8 км2" too, and the tier's ASCII
        // arm is Latin-only by design — folded to ² before the tier (the Bulgarian lesson).
        expect(normalizeAbkhaz("8 км2 аҭыԥ")).toBe("8 километра квадрат аҭыԥ");
        // ⚠ мм/кг/г/т are NOT declared (no spelled singular attested — грамм exists only as граммақәа),
        // and an undeclared unit must stay untouched, not half-read.
        expect(normalizeAbkhaz("3 кг")).toBe("3 кг");
    });

    test("normalization: cubes and unknown rate denominators — the tier's visible-gap policy, pinned", () => {
        // No cubic word is attested (куб ×0): a DECLARED unit re-emits its ³ where the leak gate can
        // see it; an UNDECLARED one stays whole.
        expect(normalizeAbkhaz("100 м³")).toBe("100 метра³");
        expect(normalizeAbkhaz("5,24 г/см³")).toContain("см³");
        // A rate with a DECLARED denominator is refused whole (no per-word, no half reading)…
        expect(normalizeAbkhaz("0,6км/км²")).toContain("км/км²");
        // …but an UNKNOWN denominator is not a rate the tier can see: the numerator reads as a word and
        // ⟨/с⟩ stays visible. Header comment states this; pinned so a tier-level change shows up here.
        expect(normalizeAbkhaz("100 м/с")).toBe("100 метра/с");
    });

    test("normalization: the DOT decimal reads like the comma one — except in the clock frame", () => {
        // Latin-source passages write dot decimals ("28.28 гр.", "0.02°", "1.98847") and the dot was a
        // full-stop pause mid-number. Digits on both sides keep sentence periods out.
        expect(normalizeAbkhaz("28.28 гр.")).toBe("28 ҩба ааба гр.");
        expect(normalizeAbkhaz("1877. Ашәышықәса")).toBe("1877. Ашәышықәса");
        // ⚠ GLUE: "0,6км" fused the last fraction word with the unit into one nonword (*фбакм).
        expect(normalizeAbkhaz("38.61мм")).toBe("38 фба акы мм");
        // ⚠ "асааҭ 10.00 инаркны 16.00" is the corpus's own DOT-SEPARATED CLOCK — a clock ONLY when
        // anchored on the hour word itself (single, hyphenated, or инаркны-joined)…
        expect(normalizeAbkhaz("асааҭ 10.00 инаркны 16.00 рҟынӡа")).toBe("асааҭ 10 инаркны 16 рҟынӡа");
        expect(normalizeAbkhaz("асааҭ 10.00-16.00")).toBe("асааҭ 10 инаркны 16 рҟынӡа");
        // …trailing punctuation is not a refusal (only a digit continuation is)…
        expect(normalizeAbkhaz("асааҭ 10.00, нас")).toBe("асааҭ 10, нас");
        // …and a bare инаркны does NOT anchor a clock: an ordinary decimal in the range frame — the
        // corpus's "600 инаркны 1600 метра" shape — must stay a decimal ("2.50" is not "2 50").
        expect(normalizeAbkhaz("1 инаркны 2.50 метра рҟынӡа")).toBe("1 инаркны 2 хәба аноль метра рҟынӡа");
        // ⚠ A TWO-PART DOT DATE (MM.YYYY) keeps its dot as a pause, like the three-part chain.
        expect(normalizeAbkhaz("11.1946 азы")).toBe("11.1946 азы");
    });

    test("normalization: a range's endpoints admit the DOT decimal too", () => {
        // The corpus's own "7.9-8.2" (and 6.7-7.6, 1.3-1.5): comma-only endpoints let the range match
        // the INNER digits and strand ".2" after the "to" word.
        expect(normalizeAbkhaz("7.9-8.2 балл")).toBe("7 жәба инаркны 8 ҩба рҟынӡа балл");
    });

    test("normalization: the clock word goes BEFORE the number and is not doubled", () => {
        // "асааҭ 6 рзы" / "асааҭ 18:21:56 рзы" — the corpus wrote the frame itself once, so the guard
        // from the range rule applies here too.
        expect(normalizeAbkhaz("22:30 рзы")).toBe("асааҭ 22 30 рзы");
        expect(normalizeAbkhaz("асааҭ 18:21:56 рзы")).toBe("асааҭ 18 21 56 рзы");
        // TRAILING zero components are dropped, not read: асааҭ 10, never "10 аноль".
        expect(normalizeAbkhaz("асааҭ 10:00 инаркны 16:00 рҟынӡа")).toBe("асааҭ 10 инаркны асааҭ 16 рҟынӡа");
        // ⚠ …TRAILING ONLY. Dropping a MEDIAL zero collapsed 10:00:30 into the same output as the
        // different time 10:30 — the seconds slid into the minutes slot.
        expect(normalizeAbkhaz("асааҭ 10:00:30 рзы")).toBe("асааҭ 10 0 30 рзы");
        expect(normalizeAbkhaz("10:05:00")).toBe("асааҭ 10 5");
        // ⚠ THE SAID-LOOKBACK IS LETTER-BOUNDED: the и- prefix is productive, so a word merely ENDING in
        // асааҭ must not suppress the frame word.
        expect(normalizeAbkhaz("иасааҭ 22:30 рзы")).toBe("иасааҭ асааҭ 22 30 рзы");
        // ⚠ A RACE TIME IS NOT A CLOCK: "(1:51.4)" is in the corpus, and fractional "minutes" mark a
        // duration — no асааҭ. (Its ⟨51.4⟩ half now reads as the decimal it is; the colon stays a pause.)
        expect(normalizeAbkhaz("(1:51.4)")).toBe("(1:51 ԥшьба)");
        // And no wall clock shows 25:99 (h<24, mm<60).
        expect(normalizeAbkhaz("25:99")).toBe("25:99");
    });

    test("normalization: a hyphenated clock RANGE says the frame word once and keeps step 4's connectives", () => {
        // Rewriting endpoint-by-endpoint doubled асааҭ and stranded the hyphen where the digit-range
        // rule could no longer see it ("асааҭ 10-асааҭ 16"). The corpus frame carries the word once for
        // the pair: "асааҭ 10.00 инаркны 16.00".
        expect(normalizeAbkhaz("асааҭ 10:00-16:00 рзы")).toBe("асааҭ 10 инаркны 16 рҟынӡа рзы");
        expect(normalizeAbkhaz("10:00-16:00")).toBe("асааҭ 10 инаркны 16 рҟынӡа");
    });

    test("normalization: what it must NOT touch", () => {
        const ab = createAbkhaz();
        // ⚠ ROMAN NUMERALS ARE A REGISTRY-LEVEL SEAM, not an engine one: registry.ts wraps text() with
        // normalizeRomans, so this must be probed through phonemize() — createAbkhaz().text() never sees
        // the conversion and drops the Latin run instead. Pinned because the normalizer must not disturb
        // the input the wrapper hands it.
        expect(phonemize("XX ашәышықәса", "ab").trim()).toBe("ɥˤaʒʷa aʃʷəʂəkʷʰsa");
        // A hyphenated WORD is not a range: the guard requires digits on both sides.
        expect(ab.text("аԥсуа-аурыс").trim()).not.toContain("inarkʼnə");
    });


    test("⟨щ⟩ — the Russian-loan letter that read as a HOLE in the middle of the word", () => {
        // Found by the silent-deletion detector: ×7 in the artifact, all in Russian quoted in Abkhaz text.
        // ⟨щ⟩ is not in the Abkhaz alphabet, but neither are ⟨в ф ц⟩, which the base table already carries at
        // their nearest Abkhaz values. `обращаться` read `obraatʼʲsja` — the letter simply absent.
        expect(phonemizeWord("обращаться")).toContain("ɕ");
        expect(phonemizeWord("щ")).toBe("ɕ");
    });
});
