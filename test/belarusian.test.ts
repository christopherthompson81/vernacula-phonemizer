import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord, createBelarusian } from "../src/languages/belarusian/belarusian.ts";
import { normalizeBelarusian } from "../src/languages/belarusian/normalize.ts";
import { ROMAN_POLICY } from "../src/languages/belarusian/romanOrdinals.ts";

// Belarusian (be) — East Slavic, Cyrillic. Rule g2p mirroring Ukrainian's iotated/palatalisation machinery, plus
// Belarusian signatures: г→ɣ, retroflex ж/ш/ч→ʐ/ʂ/t͡ʂ, ⟨і⟩ iotated (Іван→jivan), ⟨ў⟩→u̯/w, дз/дж affricates, dark
// л→ɫ, and — unlike Ukrainian — regressive voicing + final devoicing (akanne is spelled → no stress dict).
// Referee: wikipron bel_cyrl narrow (human).
describe("Belarusian canonical IPA — rule g2p (Standard Belarusian)", () => {
    test("core segments: г→ɣ, dark л→ɫ, ы→ɨ, retroflex ч→t͡ʂ", () => {
        expect(phonemizeWord("вада")).toBe("vada"); // akanne spelled → no reduction
        expect(phonemizeWord("галава")).toBe("ɣaɫava"); // г→ɣ, dark ɫ
        expect(phonemizeWord("чалавек")).toBe("t͡ʂaɫavʲek"); // ч→t͡ʂ (retroflex), в→vʲ before е
        expect(phonemizeWord("яблык")).toBe("jabɫɨk"); // я→ja (initial), ы→ɨ
    });

    test("⟨і⟩ is iotated (word-initial → ji); soft vowels palatalise", () => {
        expect(phonemizeWord("Іван")).toBe("jivan"); // і → ji word-initial
        expect(phonemizeWord("ён")).toBe("jon"); // ё → jo word-initial
        expect(phonemizeWord("дзень")).toBe("d͡zʲenʲ"); // дз→d͡zʲ (soft), нь→nʲ
        expect(phonemizeWord("люблю")).toBe("lʲublʲu"); // soft л before ю
    });

    test("⟨ў⟩→u̯/w; apostrophe separates (jV)", () => {
        expect(phonemizeWord("воўк")).toBe("vou̯k"); // ў → u̯ after a vowel
        expect(phonemizeWord("ўзяць")).toBe("wzʲat͡sʲ"); // ў → w word-initial, зя→zʲa, ць→t͡sʲ
        expect(phonemizeWord("сям'я")).toBe("sʲamja"); // ся→sʲa, apostrophe → я=ja
    });

    test("voicing: final devoicing + regressive palatalisation", () => {
        expect(phonemizeWord("горад")).toBe("ɣorat"); // final д → t
        expect(phonemizeWord("хлеб")).toBe("xlʲep"); // final б → p
        expect(phonemizeWord("снег")).toBe("sʲnʲex"); // regressive с→sʲ before nʲ; final г→x
        expect(phonemizeWord("везці")).toBe("vʲesʲt͡sʲi"); // с softens before the palatalised affricate t͡sʲ
        expect(phonemizeWord("абразлівы")).toBe("abrazʲlʲivɨ"); // з softens before soft л
        expect(phonemizeWord("нерв")).toBe("nʲerv"); // в does NOT devoice to [f] (it vocalises, unlike Russian)
    });

    test("cardinal numbers", () => {
        const be = createBelarusian();
        expect(be.text("0").trim()).toBe("nulʲ");
        expect(be.text("5").trim()).toBe("pʲat͡sʲ"); // пяць
        expect(be.text("21").trim()).toBe("dvat͡sːat͡sʲ ad͡zʲin"); // дваццаць адзін (geminate цц)
        expect(be.text("100").trim()).toBe("sto");
        expect(be.text("1000").trim()).toBe("tɨsʲat͡ʂa"); // тысяча — bare (no leading "адзін")
    });

    // MAGNITUDE-NOUN AGREEMENT (the shared East-Slavic compositor in ukrainian/numbers.ts). тысяча is FEMININE
    // → дзве/адна, and it inflects for the count: nom.sg after …1, nom.pl after …2–4, gen.pl after 5+/11–14.
    // мільён is masculine and keeps два.
    test("cardinal numbers: gender + count agreement on the magnitude nouns", () => {
        const be = createBelarusian();
        expect(be.text("1000").trim()).toBe("tɨsʲat͡ʂa"); // тысяча
        expect(be.text("2000").trim()).toBe("d͡zʲvʲe tɨsʲat͡ʂɨ"); // дзве тысячы — FEM two + nom.pl (not *два тысяча)
        expect(be.text("5000").trim()).toBe("pʲat͡sʲ tɨsʲat͡ʂ"); // пяць тысяч — gen.pl after 5
        expect(be.text("21000").trim()).toBe("dvat͡sːat͡sʲ adna tɨsʲat͡ʂa"); // дваццаць адна тысяча — …1 → fem sg
        expect(be.text("1000000").trim()).toBe("ad͡zʲin mʲilʲjon"); // адзін мільён — masc, multiplier KEPT
        expect(be.text("2000000").trim()).toBe("dva mʲilʲjonɨ"); // два мільёны — nom.pl (not *два мільён)
    });

    test("text: words + clause punctuation", () => {
        expect(createBelarusian().text("Мова жыве.")).toBe("mova ʐɨvʲe .");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION (src/languages/belarusian/normalize.ts + the shared symbol tier + romanOrdinals.ts).
//
// ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (playbook trap 13). The ordinal notation has
// four branches the corpus does not evenly exercise — the irregular table, the composed tens, the whole-
// thousand stem, and the OBLIQUE CARDINAL that shares the same notation — so one case from each is pinned,
// several of them values this corpus does not contain.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe("belarusian text normalization", () => {
    const be = createBelarusian();

    test("the two defects that were a fluent WRONG reading, not silence", () => {
        // `3 000 000` read as *тры нуль нуль* — "three zero zero" — because the number token is `\d+` and
        // cannot span the grouping space. This is the largest wrong-magnitude defect in the language.
        expect(be.text("3 000 000").trim()).toBe("trɨ mʲilʲjonɨ");
        expect(be.text("31 800").trim()).toBe("trɨt͡sːat͡sʲ adna tɨsʲat͡ʂa vosʲemsot");
        // `+28 °C` read the ⟨C⟩ as the ENGLISH letter name [sˈiː] — the Cyrillic-only TOKEN drops the Latin
        // run to core/foreign.ts. The degree class must therefore carry BOTH ⟨C⟩ and Cyrillic ⟨С⟩.
        expect(normalizeBelarusian("+28 °C")).toBe("плюс 28 градусаў Цэльсія");
        expect(normalizeBelarusian("+28 °С")).toBe("плюс 28 градусаў Цэльсія"); // the Cyrillic homoglyph
        expect(be.text("+28 °C").trim()).toBe("plʲus dvat͡sːat͡sʲ vosʲem ɣradusau̯ t͡sɛlʲsʲija");
    });

    test("the decimal comma is a QUANTITY, not a phrase break", () => {
        // 64,420 corpus instances. `5,3 %` read as *пяць , тры* — a pause inside a number.
        expect(be.text("5,3 %").trim()).toBe("pʲat͡sʲ koska trɨ prat͡sɛnta"); // gen.sg after a decimal
        expect(be.text("12,5 км").trim()).toBe("dvanat͡sːat͡sʲ koska pʲat͡sʲ kʲiɫamʲetra");
        // …and the dot decimal folds to it. be's 82 dot-decimals are mostly GENUINE (`+57.7 °C`,
        // `$7.2 мільярда`, `(74.2 %)`), which is why this is wider than Ukrainian's 1–2-digit rule; the
        // known misfires (`81-717.5М`, `«2.5G»`) carry a LETTER after the fraction and are excluded.
        expect(normalizeBelarusian("74.2 %")).toBe("74,2 %");
        expect(normalizeBelarusian("81-717.5М")).toBe("81 да 717.5М"); // a train model, not a decimal
    });

    test("the ordinal notation: the table, the composed tens, the thousand stem, and the oblique CARDINAL", () => {
        expect(normalizeBelarusian("1-ы")).toBe("першы");
        expect(normalizeBelarusian("4-га")).toBe("чацвёртага"); // gen — «Войскі 1-га Беларускага фронту»
        expect(normalizeBelarusian("7-е месца")).toBe("сёмае месца"); // neuter nom
        expect(normalizeBelarusian("30-ай")).toBe("трыццатай"); // fem obl — «30-ай па велічыні эканомікай»
        expect(normalizeBelarusian("2000-я гады")).toBe("двухтысячныя гады"); // the whole-thousand stem
        expect(normalizeBelarusian("2010-х")).toBe("дзве тысячы дзясятых"); // only the LAST element inflects
        expect(normalizeBelarusian("1950-х")).toBe("тысяча дзевяцьсот пяцідзясятых");
        // ⚠ THE SAME NOTATION WRITES AN OBLIQUE CARDINAL: «з 28-мі краін» is *дваццаці васьмі*, not an
        // ordinal. Both are generated and the written letters choose — a form that does not end with what
        // the writer typed is never returned, which is what makes guessing at a paradigm safe.
        expect(normalizeBelarusian("з 28-мі краін")).toBe("з дваццаці васьмі краін");
        // A suffix no paradigm produces leaves the text alone rather than inventing one.
        expect(normalizeBelarusian("28-гадовы")).toBe("28-гадовы"); // a compound adjective, not an ordinal
    });

    test("abbreviations, and the three letters that mean something else", () => {
        expect(normalizeBelarusian("1991 г.")).toBe("1991 года"); // was the bare consonant [x]
        expect(normalizeBelarusian("2014-2016 гг.")).toBe("2014 да 2016 гадоў");
        expect(normalizeBelarusian("У 438 г. н.э.")).toBe("У 438 года нашай эры."); // the final dot survives
        expect(normalizeBelarusian("да н.э.")).toBe("да нашай эры.");
        expect(normalizeBelarusian("Python, Ruby і г.д.")).toBe("Python, Ruby і гэтак далей.");
        expect(normalizeBelarusian("нар. 1920")).toBe("нарадзіўся 1920");
        // ⚠ THE RATE RULE MUST RUN FIRST, or `км/г.` loses its hour to the year rule. `г` is three
        // different words and only the context separates them.
        expect(normalizeBelarusian("574,8 км/г.")).toBe("574,8 кіламетраў на гадзіну.");
        // ⚠ NOT DECLARED, each on a counted corpus fact: `с.` is *старонка* in every bibliography instance
        // (`552 с.`), `т.` is *том*, and `г` after a digit is *год* in 7 of its 8 instances — declaring the
        // gram would misread every year in the language.
        expect(normalizeBelarusian("552 с.")).toBe("552 с.");
        expect(normalizeBelarusian("БЭ ў 18 т.")).toBe("БЭ ў 18 т.");
        // The magnitude abbreviations, with the form the numeral governs.
        expect(normalizeBelarusian("16 млрд долараў")).toBe("16 мільярдаў долараў");
        expect(normalizeBelarusian("2,5 млн")).toBe("2,5 мільёна"); // gen.sg after a decimal
        expect(normalizeBelarusian("3 млн")).toBe("3 мільёны"); // nom.pl after 2–4
    });

    test("percent, currency and the unit tier — three-way Slavic agreement", () => {
        expect(be.text("70 %").trim()).toBe("sʲemd͡zʲesʲat prat͡sɛntau̯"); // gen.pl after 70
        expect(be.text("21 %").trim()).toBe("dvat͡sːat͡sʲ ad͡zʲin prat͡sɛnt"); // nom.sg after a compound in 1
        expect(be.text("22 %").trim()).toBe("dvat͡sːat͡sʲ dva prat͡sɛntɨ"); // nom.pl after 2–4
        expect(be.text("$ 300").trim()).toBe("trɨsta doɫarau̯");
        expect(be.text("100 кг").trim()).toBe("sto kʲiɫaɣramau̯");
        expect(be.text("10 км²").trim()).toBe("d͡zʲesʲat͡sʲ kvadratnɨx kʲiɫamʲetrau̯"); // adjective BEFORE the noun
        expect(be.text("5²").trim()).toBe("pʲat͡sʲ u kvadrat͡sʲe"); // the bare power, sourced ×10
    });

    test("signs — sourced from one sentence that reads the notation aloud", () => {
        // «2 ⋅ 3 = 6 … чытаецца «два памножыць на тры роўна шасці», або проста «два на тры ёсць шэсць»»
        // The SHORT register is taken because `роўна` governs the dative (*роўна шасці*) and this layer
        // emits nominative digits; `ёсць шэсць` in the same sentence is nominative.
        expect(normalizeBelarusian("фунт стэрлінгаў = 100 пенсаў")).toBe("фунт стэрлінгаў ёсць 100 пенсаў");
        // ⚠ AND `=` REQUIRES A DIGIT: 7 of the corpus's 9 are BIBLIOGRAPHIC TITLE SEPARATORS, where "ёсць"
        // would assert an equation about a translation — the Lithuanian lesson.
        expect(normalizeBelarusian("Запісы = Zapisy")).toBe("Запісы = Zapisy");
        expect(normalizeBelarusian("2 < 5")).toBe("2 менш за 5");
        expect(normalizeBelarusian("5 > 2")).toBe("5 больш за 2");
        expect(normalizeBelarusian("(0,28±0,04)")).toBe("(0,28 плюс-мінус 0,04)");
        expect(normalizeBelarusian("−16 °C")).toBe("мінус 16 градусаў Цэльсія"); // U+2212, not a hyphen
        expect(be.text("270×18 метраў").trim()).toBe("d͡zʲvʲesʲt͡sʲe sʲemd͡zʲesʲat na vasʲamnat͡sːat͡sʲ mʲetrau̯");
    });

    test("ranges read `да`, and the rule must survive a full stop (trap 58)", () => {
        expect(normalizeBelarusian("10—20 мм")).toBe("10 да 20 мм");
        expect(normalizeBelarusian("1-3 працоўных дзён")).toBe("1 да 3 працоўных дзён");
        // ⚠ CLAUSE-FINAL: `на глыбіні 100—200 м.` is how this corpus ends a sentence, and a lookahead
        // requiring a space or a word boundary after the second operand would decline exactly there.
        expect(be.text("100—200 м.").trim()).toBe("sto da d͡zʲvʲesʲt͡sʲe mʲetrau̯ .");
    });

    test("fractions are bounded at ten, because every slash in this corpus is an ALTERNATIVE DATE", () => {
        expect(normalizeBelarusian("1/3")).toBe("адна трэцяя"); // fem, agreeing with the elided частка
        expect(normalizeBelarusian("2/5")).toBe("дзве пятыя");
        // `(пам. 29/30.10.1937)`, `(нар. 673/674)`, `285/286: Марк Аўрэлій Юліян` — a birth or death year
        // known only to within a year. Not one of the seven is a fraction.
        expect(normalizeBelarusian("673/674")).toBe("673/674");
        expect(normalizeBelarusian("285/286")).toBe("285/286");
        expect(normalizeBelarusian("64/67")).toBe("64/67");
    });

    test("initialisms are spelled, and a century is an ORDINAL", () => {
        expect(be.text("ЗША").trim()).toBe("zɛ ʂa a"); // was the cluster [sʂa]
        expect(be.text("СССР").trim()).toBe("ɛs ɛs ɛs ɛr");
        expect(be.text("ВУП").trim()).toBe("vɛ u pɛ");
        expect(ROMAN_POLICY.ordinal(19)).toBe("дзевятнаццатае"); // NEUTER — стагоддзе is neuter
        expect(ROMAN_POLICY.ordinal(20)).toBe("дваццатае");
        expect(ROMAN_POLICY.ordinal(21)).toBe("дваццаць першае"); // only the LAST element inflects
        // ⚠ THROUGH `phonemize`, NOT THE RAW ENGINE: core/roman.ts runs in registry.ts wrapping the engine,
        // so it sees the RAW `ст.` and not the `стагоддзя` normalize.ts step 4 later expands it to. Written
        // for the expanded form alone the policy silently never fires on the form the corpus writes.
        expect(phonemize("XIX ст.", "be").trim()).toBe("d͡zʲevʲatnat͡sːataje staɣodː͡zʲa .");
        expect(phonemize("XIX стагоддзе", "be").trim()).toBe("d͡zʲevʲatnat͡sːataje staɣodː͡zʲe");
        // `век` is excluded from the context on purpose — the table is neuter and `век` is masculine, so it
        // keeps the cardinal rather than acquiring a wrong-gender ordinal.
        expect(phonemize("XX век", "be").trim()).toBe("dvat͡sːat͡sʲ vʲek");
    });

    test("clock, and the three-field timestamp that is not one", () => {
        expect(normalizeBelarusian("10:30")).toBe("дзесяць трыццаць");
        expect(normalizeBelarusian("23:59")).toBe("дваццаць тры пяцьдзесят дзевяць");
        expect(normalizeBelarusian("06:00")).toBe("шэсць"); // a round hour reads no spurious "нуль"
        expect(normalizeBelarusian("11:12:01")).toBe("11 12 01"); // colons spent on spaces, nothing invented
    });
});
