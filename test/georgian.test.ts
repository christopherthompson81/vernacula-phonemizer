import { describe, expect, test } from "vitest";

import { phonemizeWord, createGeorgian } from "../src/languages/georgian/georgian.ts";
import { normalizeGeorgian, ordinalWord } from "../src/languages/georgian/normalize.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Georgian / ქართული (ka) — Kartvelian, the Mkhedruli script, Georgia (~4M). A greedy g2p
// over the 33-letter one-letter-one-phoneme alphabet + ONE context rule (word-final voiced-stop devoicing).
// Referee: wikipron kat_geor_narrow (human) — the folds strip its narrow allophony (ä/e̞/o̞, dark ɫ, the ვ
// labialisation ʷ, ⟨ყ⟩'s [χʼ]). Signatures: the three-way
// VOICED / ASPIRATED / EJECTIVE stop contrast, uvulars ღ=ʁ / ხ=χ / ყ=qʼ, and 5 vowels a ɛ i ɔ u. Stress not marked.
describe("Georgian canonical IPA — greedy g2p (Mkhedruli, three-way stop contrast)", () => {
    test("the three-way stop contrast VOICED / ASPIRATED / EJECTIVE", () => {
        expect(phonemizeWord("ბუ")).toBe("bu"); // ⟨ბ⟩ voiced b
        expect(phonemizeWord("ფული")).toBe("pʰuli"); // ⟨ფ⟩ aspirated pʰ ("money")
        expect(phonemizeWord("პური")).toBe("pʼuɾi"); // ⟨პ⟩ ejective pʼ ("bread")
        expect(phonemizeWord("თბილისი")).toBe("tʰbilisi"); // ⟨თ⟩ aspirated tʰ (Tbilisi); ⟨ტ⟩ ejective, ⟨დ⟩ voiced
        expect(phonemizeWord("კაცი")).toBe("kʼat͡sʰi"); // ⟨კ⟩ ejective kʼ, ⟨ც⟩ aspirated affricate t͡sʰ ("man")
    });

    test("uvulars: ღ=ʁ (voiced), ხ=χ (voiceless), ყ=qʼ (ejective)", () => {
        expect(phonemizeWord("ღვინო")).toBe("ʁvinɔ"); // "wine" — ⟨ღ⟩ voiced uvular fricative ʁ
        expect(phonemizeWord("ხაჭაპური")).toBe("χat͡ʃʼapʼuɾi"); // "khachapuri" — ⟨ხ⟩ χ, ⟨ჭ⟩ ejective t͡ʃʼ, ⟨პ⟩ pʼ
        expect(phonemizeWord("წყალი")).toBe("t͡sʼqʼali"); // "water" — ⟨წ⟩ ejective t͡sʼ, ⟨ყ⟩ uvular ejective qʼ
    });

    test("affricates (voiced / aspirated / ejective) + ⟨ჯ⟩ ⟨ჟ⟩ ⟨შ⟩", () => {
        expect(phonemizeWord("გამარჯობა")).toBe("ɡamaɾd͡ʒɔba"); // "hello" — ⟨ჯ⟩ d͡ʒ
        expect(phonemizeWord("ძაღლი")).toBe("d͡zaʁli"); // "dog" — ⟨ძ⟩ voiced affricate d͡z, ⟨ღ⟩ ʁ
        expect(phonemizeWord("ბავშვი")).toBe("bavʃvi"); // "child" — ⟨შ⟩ ʃ
    });

    test("5 vowels a ɛ i ɔ u; ⟨ღ⟩/⟨ხ⟩ places", () => {
        expect(phonemizeWord("საქართველო")).toBe("sakʰaɾtʰvɛlɔ"); // "Georgia" — a, ɛ, ɔ; ⟨ქ⟩ kʰ, ⟨თ⟩ tʰ
        expect(phonemizeWord("დედა")).toBe("dɛda"); // "mother" — ⟨ე⟩ ɛ, ⟨დ⟩ d
        expect(phonemizeWord("ქართული")).toBe("kʰaɾtʰuli"); // "Georgian" — u, i
    });

    test("word-final voiced-stop devoicing: ⟨ბ დ გ⟩ → pʰ tʰ kʰ (the one context rule)", () => {
        expect(phonemizeWord("კარგად")).toBe("kʼaɾɡatʰ"); // "well" — final ⟨დ⟩ devoices to tʰ (the -ad adverbial)
        expect(phonemizeWord("მადლობად")).toBe("madlɔbatʰ"); // final ⟨დ⟩→tʰ; a non-final ⟨დ⟩ stays d
        expect(phonemizeWord("გუდა")).toBe("ɡuda"); // non-final ⟨დ⟩ stays voiced (d) — the rule is word-final only
    });

    test("clause assembly: words + punctuation (incl. the ჻ paragraph separator)", () => {
        expect(createGeorgian().text("გამარჯობა, საქართველო!").trim()).toBe("ɡamaɾd͡ʒɔba , sakʰaɾtʰvɛlɔ !");
        expect(createGeorgian().text("სახლი჻ ბაღი").trim()).toBe("saχli . baʁi"); // ჻ → sentence pause
    });

    // VIGESIMAL cardinal numbers (numbers.ts + the georgian.jsonc table). 20–99 is score·20 + a 1–19 remainder
    // joined by -და- as ONE word; from 100 up the groups are separate words and a numeral followed by a smaller
    // number drops its final ⟨ი⟩ (ასი→ას, ათასი→ათას).
    test("cardinal numbers are VIGESIMAL: score·20 + remainder joined by -და-", () => {
        const ka = createGeorgian();
        expect(ka.text("20").trim()).toBe("ɔt͡sʰi"); // ოცი — the bare score
        expect(ka.text("21").trim()).toBe("ɔt͡sʰdaɛɾtʰi"); // ოცდაერთი = 20 + 1
        expect(ka.text("30").trim()).toBe("ɔt͡sʰdaatʰi"); // ოცდაათი = 20 + 10 (there is no "thirty" word)
        expect(ka.text("45").trim()).toBe("ɔɾmɔt͡sʰdaχutʰi"); // ორმოცდახუთი = 2×20 + 5
        expect(ka.text("50").trim()).toBe("ɔɾmɔt͡sʰdaatʰi"); // ორმოცდაათი = 2×20 + 10
        expect(ka.text("67").trim()).toBe("samɔt͡sʰdaʃvidi"); // სამოცდაშვიდი = 3×20 + 7
        expect(ka.text("70").trim()).toBe("samɔt͡sʰdaatʰi"); // სამოცდაათი = 3×20 + 10
        expect(ka.text("89").trim()).toBe("ɔtʰχmɔt͡sʰdat͡sʰχɾa"); // ოთხმოცდაცხრა = 4×20 + 9
        expect(ka.text("90").trim()).toBe("ɔtʰχmɔt͡sʰdaatʰi"); // ოთხმოცდაათი = 4×20 + 10
        expect(ka.text("99").trim()).toBe("ɔtʰχmɔt͡sʰdat͡sʰχɾamɛtʼi"); // ოთხმოცდაცხრამეტი = 4×20 + 19 (a TEEN attaches too)
    });

    test("cardinal numbers: units, hundreds with ⟨ი⟩-truncation, thousands, millions", () => {
        const ka = createGeorgian();
        expect(ka.text("7").trim()).toBe("ʃvidi"); // შვიდი
        expect(ka.text("8").trim()).toBe("ɾva"); // რვა (no final ⟨ი⟩)
        expect(ka.text("100").trim()).toBe("asi"); // ასი — group-final, keeps ⟨ი⟩
        expect(ka.text("101").trim()).toBe("as ɛɾtʰi"); // ას ერთი — the hundred TRUNCATES before a remainder
        expect(ka.text("555").trim()).toBe("χutʰas ɔɾmɔt͡sʰdatʰχutʰmɛtʼi"); // ხუთას ორმოცდათხუთმეტი (2×20+15)
        expect(ka.text("999").trim()).toBe("t͡sʰχɾaas ɔtʰχmɔt͡sʰdat͡sʰχɾamɛtʼi"); // ცხრაას ოთხმოცდაცხრამეტი
        expect(ka.text("1000").trim()).toBe("atʰasi"); // ათასი — no *ერთი ათასი
        expect(ka.text("1001").trim()).toBe("atʰas ɛɾtʰi"); // ათას ერთი — the thousand truncates
        expect(ka.text("12345").trim()).toBe("tʰɔɾmɛtʼi atʰas samas ɔɾmɔt͡sʰdaχutʰi"); // თორმეტი ათას სამას ორმოცდახუთი
        expect(ka.text("1000000").trim()).toBe("ɛɾtʰi miliɔni"); // ერთი მილიონი (borrowed noun — keeps ერთი)
        expect(ka.text("1000000000").trim()).toBe("ɛɾtʰi miliaɾdi"); // ერთი მილიარდი
    });

    test("Mtavruli titlecase (all-caps) lowercases to Mkhedruli — not silently dropped", () => {
        expect(phonemizeWord("ᲓᲐᲕᲔ")).toBe(phonemizeWord("დავე")); // U+1C90-block → the U+10D0 table keys
        expect(phonemizeWord("ᲡᲐᲥᲐᲠᲗᲕᲔᲚᲝ")).toBe("sakʰaɾtʰvɛlɔ"); // all-caps "Georgia"
    });
});

// ── TEXT NORMALIZATION (src/languages/georgian/normalize.ts) ──────────────────────────────────────────
// Counts in the comments are over the retained text of tools/corpus/mined/ka.jsonc (453 segments out of a
// 1,025,770-paragraph ka.wikipedia dump); the "was" readings are what the engine produced before the layer.
//
// ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (trap 13). The ordinal has a table branch, a
// score-compound branch, a round-score branch, a round-hundred branch and a thousands branch, and the corpus
// exercises only two of them — so the cases the corpus does NOT contain are the ones that matter here.
describe("Georgian normalization — the glued case suffix, the ordinal circumfix, and the symbol tier", () => {
    const ka = createGeorgian();
    const say = (t: string): string => ka.text(t).trim();

    // trap 14: a suffix written after the DIGITS cannot agree, because the digit only becomes words in the
    // tokenizer. Was: `100-ზე` → *asi zɛ*, the bound postposition standing alone as a word.
    test("the glued case ending attaches to the numeral WORD, with the stem alternation", () => {
        expect(say("100-ზე")).toBe("aszɛ"); // ასი → ას-ზე: the nominative -ი is LOST
        expect(say("2000-მდე")).toBe("ɔɾi atʰasamdɛ"); // ათასი → ათას-ამდე: -მდე inserts -ა- on a consonant stem
        expect(say("83 500-ს")).toBe("ɔtʰχmɔt͡sʰdasami atʰas χutʰass"); // dative on the LAST word only
        expect(say("90-იან")).toBe("ɔtʰχmɔt͡sʰdaatʰian"); // the decade adjective, written attributively
        expect(say("1900-იანი")).toBe("atʰas t͡sʰχɾaasiani"); // …and its full nominative
        expect(say("4.52-ია")).toBe("ɔtʰχi ɔɾmɔt͡sʰdatʰɔɾmɛtʼia"); // the copula, on a decimal operand
    });

    // The VOWEL stems რვა (8) and ცხრა (9) are the branch the corpus never exercises: they truncate before
    // -ის/-ით/-იდან and keep the vowel before -ს/-ზე/-მდე/-ჯერ.
    test("a VOWEL-stem numeral truncates before some endings and not others", () => {
        expect(say("9-ის")).toBe("t͡sʰχɾis"); // ცხრა → ცხრ-ის, the -ა drops
        expect(say("8-ჯერ")).toBe("ɾvad͡ʒɛɾ"); // რვა-ჯერ, the -ა stays — one word, not *ɾva d͡ʒɛɾ*
        expect(say("9-მდე")).toBe("t͡sʰχɾamdɛ"); // ცხრა-მდე: no -ა- insertion on a vowel stem
    });

    // ⚠ THE INVARIANT trap 15 turns on for this language, and it is a NEGATIVE one. A Georgian numeral before
    // a noun does not decline; the NOUN carries the case, and 312 artifact instances are written that way.
    // Nothing here may touch them.
    test("a SPACED year noun is left alone — the numeral stays a plain cardinal", () => {
        expect(say("2011 წელს")).toBe("ɔɾi atʰas tʰɛɾtʰmɛtʼi t͡sʼɛls");
        expect(say("2014 წლის")).toBe("ɔɾi atʰas tʰɔtʰχmɛtʼi t͡sʼlis");
        expect(normalizeGeorgian("1995 წლებში")).toBe("1995 წლებში"); // byte-identical through the layer
    });

    // The circumfix. The corpus writes `მე-5` (prefix half) and `25-ე` (suffix half) for the same category.
    test("ordinals: both written halves of the მე-…-ე circumfix reach the same word", () => {
        expect(say("მე-5")).toBe("mɛχutʰɛ"); // მეხუთე
        expect(say("25-ე")).toBe("ɔt͡sʰdamɛχutʰɛ"); // ოცდამეხუთე — the circumfix goes INSIDE the score compound
        expect(say("179-ე")).toBe("as samɔt͡sʰdamɛt͡sʰχɾamɛtʼɛ"); // ას სამოცდამეცხრამეტე
        expect(say("1-ლი")).toBe("pʼiɾvɛli"); // ⚠ SUPPLETIVE and abbreviated differently; ×0 in the corpus
        expect(say("21-ე")).toBe("ɔt͡sʰdamɛɛɾtʰɛ"); // …but ONE inside a compound is regular: ოცდამეერთე
    });

    // The branches the corpus does NOT write — a round score, a round hundred, a round thousand and a
    // thousands head. Read straight off `ordinalWord`, which is where a table/composition seam hides a bug.
    test("ordinal BRANCHES the corpus never exercises", () => {
        expect(ordinalWord(20)).toBe("მეოცე");
        expect(ordinalWord(40)).toBe("მეორმოცე");
        expect(ordinalWord(100)).toBe("მეასე");
        expect(ordinalWord(1000)).toBe("მეათასე");
        expect(ordinalWord(2016)).toBe("ორი ათას მეთექვსმეტე");
        expect(ordinalWord(8)).toBe("მერვე"); // the vowel stem: რვა → მე-რვ-ე
        expect(ordinalWord(9)).toBe("მეცხრე");
        expect(ordinalWord(1)).toBe("პირველი"); // isolated ONE is suppletive
        expect(ordinalWord(0)).toBeUndefined();
    });

    // Roman centuries arrive here as DIGITS — ka is not in ROMAN_NATIVE, so registry.ts has already
    // converted them. Georgian reads a century as an ordinal; the corpus writes მეთვრამეტე საუკუნის in words.
    // ⚠ THROUGH `phonemize`, NOT THE ENGINE DIRECTLY: the roman pass wraps `engine.text()` in registry.ts, so
    // asserting on `createGeorgian().text()` would test a string this rule never sees (trap 16's ordering
    // check). The operand is deliberately one that breaks if the order is wrong — `XVIII`, not `II`.
    test("a century is an ORDINAL, not a cardinal (63 artifact instances, via the roman pass)", () => {
        expect(phonemize("XVIII საუკუნეში", "ka").trim()).toBe("mɛtʰvɾamɛtʼɛ saukʼunɛʃi"); // was *tʰvɾamɛtʼi …*
        expect(say("20-ე საუკუნე")).toBe("mɛɔt͡sʰɛ saukʼunɛ");
        // ⚠ A SINGLE-LETTER ROMAN IS NOT CONVERTED BY THE SHARED PASS — "never worth the risk", by design —
        // so ⟨V⟩ ×4 and ⟨X⟩ ×1 were reading as the ENGLISH letter names *vˈiː* / *ˈɛks*. The century noun is
        // the language-specific disambiguator, so this arm is local rather than a core widening.
        expect(phonemize("V საუკუნეში", "ka").trim()).toBe("mɛχutʰɛ saukʼunɛʃi");
        expect(phonemize("X საუკუნის", "ka").trim()).toBe("mɛatʰɛ saukʼunis");
        expect(phonemize("C საუკუნე", "ka").trim()).toBe("sˈiː saukʼunɛ"); // ⟨C⟩ is the Celsius letter ×75
        expect(phonemize("V ნაწილი", "ka").trim()).toBe("vˈiː nat͡sʼili"); // no century noun — untouched
    });

    // Was: `5 000` → *χutʰi nuli*, "five zero" — the TOKEN's `\d+` split on the space and 000 read as ნული.
    test("thousands de-group before anything reads a number or a pause", () => {
        expect(say("5 000")).toBe("χutʰi atʰasi");
        expect(say("1 900 000")).toBe("ɛɾtʰi miliɔn t͡sʰχɾaasi atʰasi");
        expect(say("5,837,213")).toBe("χutʰi miliɔn ɾvaas ɔt͡sʰdat͡ʃʰvidmɛtʼi atʰas ɔɾas t͡sʰamɛtʼi");
        expect(say("1,300")).toBe("atʰas samasi"); // a single English-style group, 7/7 in the artifact
        expect(normalizeGeorgian("0,3 %")).toBe("ნული სამი პროცენტი"); // …but a leading `0,` is a DECIMAL
    });

    // Was: `15:00` → *tʰχutʰmɛtʼi , nuli*, the colon a CLAUSE PAUSE. The component frame is the corpus's own,
    // "365 დღე, 5 საათი, 49 წუთი და 12 წამი"; a following საათ… is consumed and its case moved to the last
    // component (trap 12 + trap 10).
    test("the clock needs a context, and the hour noun is said ONCE", () => {
        expect(say("15:00 საათზე")).toBe("tʰχutʰmɛtʼi saatʰzɛ");
        expect(say("03:14:08-ზე")).toBe("sami saatʰi , tʰɔtʰχmɛtʼi t͡sʼutʰi da ɾva t͡sʼamzɛ");
        expect(say("04:35 UTC")).toContain("ɔtʰχi saatʰi da ɔt͡sʰdatʰχutʰmɛtʼi t͡sʼutʰi");
        // ⚠ A BARE `H:MM` IS REFUSED. 11 of the artifact's 12 colon-times carry a context; the twelfth is a
        // TRACK LENGTH in a discography, and reading it as a time of day would be the ceb/ilo error.
        expect(normalizeGeorgian("8:04")).toBe("8:04");
    });

    // Both signs were DROPPED outright. The words are attested against their own symbol on ka.wikipedia:
    // "პროცენტი (… აღნიშვნა: %)" and "პრომილე (… აღინიშნება ‰ სიმბოლოთი)".
    test("percent and per mille, postposed, with the ending on the WORD", () => {
        expect(say("5 %")).toBe("χutʰi pʼɾɔt͡sʰɛntʼi");
        expect(say("82%-ით")).toBe("ɔtʰχmɔt͡sʰdaɔɾi pʼɾɔt͡sʰɛntʼitʰ"); // was *…ɔɾi itʰ*, the ending alone
        expect(say("98 %-მა")).toBe("ɔtʰχmɔt͡sʰdatʰvɾamɛtʼi pʼɾɔt͡sʰɛntʼma");
        expect(say("210 ‰")).toBe("ɔɾas atʰi pʼɾɔmilɛ");
    });

    // Was: `12 °C` → *tʰɔɾmɛtʼi sˈiː* — the degree sign dropped and ⟨C⟩ read as the ENGLISH letter name.
    test("degrees: the scale name follows the degree noun (34 გრადუსი ცელსიუსი)", () => {
        expect(say("12 °C")).toBe("tʰɔɾmɛtʼi ɡɾadusi t͡sʰɛlsiusi");
        expect(say("2 °C-მდე")).toBe("ɔɾi ɡɾadusi t͡sʰɛlsiusamdɛ");
        expect(say("100 °F")).toBe("asi ɡɾadusi pʰaɾɛnhaitʼi"); // ×0 in the corpus — the neighbour, trap 8
        expect(say("41,5º განედსა")).toContain("ɡɾadusi"); // U+00BA folded onto U+00B0 (the scan's RAWMARK)
    });

    // Was: `500 კმ²` → *χutʰasi kʼm* — the exponent dropped AND the abbreviation into the IPA as a raw
    // cluster, which is pronounceable garbage no leak class sees (trap 56).
    test("units, the exponent (preposed measure word) and the rate", () => {
        expect(say("500 მმ")).toBe("χutʰasi milimɛtʼɾi");
        expect(say("500 მმ-ია")).toBe("χutʰasi milimɛtʼɾia");
        expect(say("500 კმ²")).toBe("χutʰasi kʼvadɾatʼuli kʼilɔmɛtʼɾi");
        expect(say("5 სმ³")).toBe("χutʰi kʼubuɾi santʼimɛtʼɾi");
        // the attributive adjective truncates when the noun takes an ending
        expect(say("1 კმ²-ზე")).toBe("ɛɾtʰi kʼvadɾatʼul kʼilɔmɛtʼɾzɛ");
        expect(say("120 კმ/სთ")).toBe("as ɔt͡sʰi kʼilɔmɛtʼɾi saatʰʃi");
        expect(say("1000 კვტ/სთ")).toBe("atʰasi kʼilɔvatʼ saatʰi"); // a kilowatt-HOUR is not a rate (trap 44)
        expect(say("15 ათ.")).toBe("tʰχutʰmɛtʼi atʰasi"); // the abbreviation's own dot is consumed
        // the LATIN spellings are robustness, not a measured repair (⟨km⟩ is ×0 here) — but a bare `5 km`
        // reached the IPA as the cluster *ˈʊkm* through the English fallback, which no leak class sees
        expect(say("5 km")).toBe("χutʰi kʼilɔmɛtʼɾi");
        expect(say("5 km²")).toBe("χutʰi kʼvadɾatʼuli kʼilɔmɛtʼɾi");
    });

    // Was: `$25 მილიონი` → *ɔt͡sʰdaχutʰi miliɔni*, the sign gone.
    test("currency is postposed after the magnitude, and is not said twice (trap 12)", () => {
        expect(say("$25 მილიონი")).toBe("ɔt͡sʰdaχutʰi miliɔni dɔlaɾi");
        expect(say("860 $")).toBe("ɾvaas samɔt͡sʰi dɔlaɾi"); // the postposed sign
        // the sign AND the word: say it once, in the position the language put it
        expect(normalizeGeorgian("$5 მილიარდი დოლარის დახმარება")).toBe("ხუთი მილიარდი დოლარის დახმარება");
    });

    // Was: `ძვ. წ. 480` → *d͡zv . t͡sʼ .* — two consonant clusters and two false clause pauses.
    test("era markers and dotted abbreviations expand, without losing a sentence pause", () => {
        expect(say("ძვ. წ. 480")).toBe("d͡zvɛli t͡sʼɛltʰaʁɾit͡sʰχvitʰ ɔtʰχas ɔtʰχmɔt͡sʰi");
        expect(say("ე. წ. სახელი")).toBe("ɛɡɾɛtʰ t͡sʼɔdɛbuli saχɛli");
        expect(normalizeGeorgian("დაახლ.ძვ.წ. 480")).toBe("დაახლოებით ძველი წელთაღრიცხვით 480");
        expect(say("სხვ.")).toBe("sχva ."); // clause-final: the abbreviation dot becomes the sentence pause
    });

    // ⚠ THE SLASH IS MOSTLY NOT A FRACTION: 2 of the artifact's 10 instances are, the rest are date
    // alternatives, year spans and divisions. The guards are what make the rule safe.
    test("fractions, and the six slash instances the rule must decline", () => {
        expect(say("1/3")).toBe("ɛɾtʰi mɛsamɛdi"); // was *ɛɾtʰi sami*
        expect(say("1/3-ს")).toBe("ɛɾtʰi mɛsamɛds"); // …and it claims its own ending
        expect(say("1/2")).toBe("naχɛvaɾi"); // suppletive
        expect(say("3/4")).toBe("sami mɛɔtʰχɛdi"); // the composed branch, ×0 in the corpus (trap 8)
        expect(normalizeGeorgian("21/22 მარტი")).toBe("21/22 მარტი"); // a DATE alternative
        expect(normalizeGeorgian("180/190")).toBe("180/190"); // a YEAR span — denominator > 100
        expect(normalizeGeorgian("1900/400")).toBe("1900/400"); // a DIVISION — numerator > denominator
    });

    // trap 24's shape, measured: 12 true negatives in the artifact against 0 false positives, and the two
    // ranges that end in a degree mark stay ranges.
    test("the minus fires on a true negative and never on a range or a value-introducing dash", () => {
        expect(say("- 32 °C")).toBe("minus ɔt͡sʰdatʰɔɾmɛtʼi ɡɾadusi t͡sʰɛlsiusi");
        expect(normalizeGeorgian("(-28 მ)")).toContain("მინუს");
        expect(normalizeGeorgian("(23-28 °C)")).not.toContain("მინუს"); // a RANGE, digit-preceded
        expect(normalizeGeorgian("მაქსიმუმი – 760 მმ")).not.toContain("მინუს"); // a value-introducing dash
        expect(normalizeGeorgian("−500")).toContain("მინუს"); // U+2212 is unambiguous
        // the wider GLUED arm: 12 true / 2 false in the artifact, and the two false ones are these
        expect(say("-28 მეტრიდან")).toBe("minus ɔt͡sʰdaɾva mɛtʼɾidan"); // a spelled unit — no ° to guard on
        expect(normalizeGeorgian("(1627 –1628)")).not.toContain("მინუს"); // a year range, spaced on the left
        expect(normalizeGeorgian("(1885-–1889)")).not.toContain("მინუს"); // …and the doubled-dash typo
        expect(say("(63+33)")).toBe("samɔt͡sʰdasami pʼlus ɔt͡sʰdat͡sʰamɛtʼi");
        expect(normalizeGeorgian("1900/400 = 4")).toContain("უდრის");
        expect(normalizeGeorgian("Lingua Latina = ლათინური ენა")).not.toContain("უდრის"); // a title equivalence
    });

    // ⚠ THE DECIMAL WORD IS REFUSED — unsourceable (see the file header: `ნული მთელი`/`ერთი მთელი` are ×0 on
    // ka.wikipedia and both bare candidates fail on sense). What the layer removes is the CLAUSE PAUSE,
    // which is wrong under every candidate reading; it puts nothing in its place. Pin the invariant, not
    // the absence: if a decimal word is ever sourced, this test is what says where it goes.
    test("the decimal separator loses its false clause pause and gains no word", () => {
        expect(say("1,5")).toBe("ɛɾtʰi χutʰi"); // was *ɛɾtʰi , χutʰi*
        expect(normalizeGeorgian("4.52")).toBe("4 52");
        expect(normalizeGeorgian("1,5")).toBe("1 5");
    });

    // The range joiner is refused too (93,177 dump-wide, no attested connective for a bare dash) — so a span
    // must still read as two clean cardinals, and an ISBN must not become one.
    test("a bare dash range stays two cardinals", () => {
        expect(say("1972-1985")).toBe("atʰas t͡sʰχɾaas samɔt͡sʰdatʰɔɾmɛtʼi atʰas t͡sʰχɾaas ɔtʰχmɔt͡sʰdaχutʰi");
        expect(normalizeGeorgian("ISBN 3-900052-04-2")).toBe("ISBN 3-900052-04-2");
    });
});
