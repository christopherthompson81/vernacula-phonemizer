import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    phonemizeWord,
    phonemizeWordRules,
} from "../src/languages/gujarati/gujarati.ts";

// Canonical-IPA goldens for Gujarati (gu) — Indo-Aryan, the Gujarati abugida. Reuses the generic abugida engine +
// the Hindi orchestration (schwa deletion, weight stress, numbers) with a Gujarati-Unicode data file. Validated
// against wikipron guj (80.4%) + kaikki guj (82.2%), both human. Gujarati has NO phonemic length (ઇ/ઈ→i), ⟨આ⟩=a,
// the ⟨ે⟩/⟨ો⟩ mids are [e]~[ɛ]/[o]~[ɔ], dental t̪/d̪ vs retroflex ʈ/ɖ, ળ→ɭ, ષ→ʂ.
const gu = (t: string): string => phonemize(t, "gu");

describe("gujarati canonical IPA", () => {
    test("consonants, vowels, schwa deletion, anusvara", () => {
        const cases: [string, string][] = [
            ["ગુજરાત", "ɡˈud͡ʒɾat̪"], // Gujarat — medial + final schwa deleted, dental t̪
            ["નમસ્તે", "nəmˈəst̪e"], // namaste
            ["પાણી", "pˈaɳi"], // pani — retroflex ɳ
            ["ઘર", "ɡʱˈəɾ"], // ghar — breathy ɡʱ
            ["માણસ", "mˈaɳəs"], // manas — medial schwa retained
            ["બાળક", "bˈaɭək"], // balak — ળ → ɭ retroflex lateral
            ["શહેર", "ʃˈəɦeɾ"], // sheher
            ["કેમ", "kˈem"], // kem
            ["ભાષા", "bʱˈaʂa"], // bhasha — ષ → ʂ, breathy bʱ
            ["ધન્યવાદ", "d̪ʱˈənjəʋad̪"], // dhanyavad — dental d̪ʱ
            ["અંક", "ˈə̃ŋk"], // ank — anusvara → homorganic nasal ŋ
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("numbers (units, teens, round tens, magnitudes)", () => {
        expect(phonemize("5", "gu")).toBe("pˈãɲt͡ʃ"); // paanch
        expect(phonemize("10", "gu")).toBe("d̪ˈəs"); // das
        expect(phonemize("100", "gu")).toBe("ˈek sˈo"); // ek so
        expect(phonemize("1000", "gu")).toBe("ˈek ɦˈəd͡ʒaɾ"); // ek hazaar
    });

    test("Gujarati digits", () => {
        expect(phonemize("૫૦૦", "gu")).toBe("pˈãɲt͡ʃ sˈo"); // 500 = paanch so
    });

    // Whole-word schwa lexicon (cross-source consensus of wikipron+kaikki) for the proven-lexical medial-schwa
    // tail. SHIPPED phonemizeWord applies it; phonemizeWordRules (and the referee eval) bypass it.
    test("schwa lexicon: shipped override for the lexical tail; rule engine untouched", () => {
        expect(phonemizeWord("અબલખ")).toBe("ˈəbələkʰ"); // schwa RETAINED (rule over-deletes → əbləkʰ)
        expect(phonemizeWord("અન્ય")).toBe("ˈənjə"); // final schwa retained after cluster
        expect(phonemizeWord("અષ્ટકોણ")).toBe("ˈəʂʈkoɳ"); // schwa DELETED (rule under-deletes → əʂʈəkoɳ)
        // the rule engine is the honest, lexicon-free signal:
        expect(phonemizeWordRules("અબલખ")).toBe("ˈəbləkʰ");
        expect(phonemizeWordRules("અષ્ટકોણ")).toBe("ˈəʂʈəkoɳ");
        // nukta loanword ફ → [f] (not native [pʰ]) — a consensus lexicon entry
        expect(phonemizeWord("કોફી")).toBe("kˈofi");
    });

    // 21-99 are IRREGULAR compound spellings (like Hindi), authored in numbers.compound.
    test("irregular 21-99 numbers + Indic grouping", () => {
        expect(phonemize("21", "gu")).toBe("ˈekʋis"); // ekvees
        expect(phonemize("45", "gu")).toBe("pˈist̪alis"); // pistaalees
        expect(phonemize("99", "gu")).toBe("nˈəʋʋaɳũ"); // navvaanoo
        expect(phonemize("4567", "gu")).toBe("t͡ʃˈaɾ ɦˈəd͡ʒaɾ pˈãɲt͡ʃ sˈo sˈəɽsəʈʰ");
    });

    // ————————————————————————————————————————————————————————————————————————————————————————————
    // #562 TEXT NORMALIZATION. Gujarati reuses HINDI'S ENGINE and used to inherit Hindi's normalizer
    // and Hindi's symbol words, which are written in DEVANAGARI — excluded by core/unicode.ts
    // GUJARATI_WORD, so the tokenizer DELETED them. Counts below are from the gu_in FLEURS corpus
    // (1,996 unique utterances); see src/languages/gujarati/normalize.ts for the full tabulation.

    test("percent and currency were SILENTLY DROPPED by the inherited Devanagari tier", () => {
        // Before: "45%" → [pˈist̪alis] — the percent word was emitted as प्रतिशत and then vanished.
        expect(gu("45%")).toBe(gu("45 ટકા"));
        expect(gu("45%")).toContain(phonemizeWord("ટકા"));
        expect(gu("$45 મિલિયન")).toBe(gu("45 મિલિયન ડોલર"));
        expect(gu("¥50")).toContain(phonemizeWord("યેન"));
        expect(gu("€10")).toContain(phonemizeWord("યુરો"));
        expect(gu("£20")).toContain(phonemizeWord("પાઉન્ડ"));
        // US$ / AUD$ are declared keys: the tier's letter-lookbehind refuses a bare $ after a letter,
        // so without them the sign was dropped and "US" read as English letter names.
        expect(gu("US$30")).toContain(phonemizeWord("ડોલર"));
    });

    test("decimals were RAW ASCII DIGITS — the manifest had no decimalWord", () => {
        // Before: phonemize("2.3 મિલિયન", "gu") returned the literal string "2.3 mˈilijən".
        expect(gu("2.3")).toBe(gu("બે દશાંશ ત્રણ"));
        expect(gu("802.11")).toBe(gu("આઠ સો બે દશાંશ એક એક"));
        expect(/\d/.test(gu("12.8 કિ.મી."))).toBe(false);
    });

    test("an ATTACHED postposition or ordinal is ONE word with the numeral (120 in the corpus)", () => {
        // "1537માં" tokenized as a number plus a stray stressed syllable [mˈã]; the orthography says
        // સાડત્રીસમાં, and joining moves the stress.
        expect(gu("1537માં")).toBe(gu("એક હજાર પાંચ સો સાડત્રીસમાં"));
        expect(gu("15મી સદી")).toBe(gu("પંદરમી સદી"));
        expect(gu("15 મી સદી")).toBe(gu("15મી સદી")); // the spaced ordinal too, ×6 in the corpus
        expect(gu("1988થી")).toBe(gu("એક હજાર નવ સો ઈઠ્યાસીથી"));
        // …but a SPACED postposition is genuinely a separate word and is left alone.
        expect(gu("1966 ની")).toBe(gu("એક હજાર નવ સો છાસઠ ની"));
        // THE TRAILING BOUNDARY: without it મ- claims the first letter of a following word. All four of
        // these are live in the corpus ("35 મીલીમીટર", "83 મીટરની", "45 મિનિટમાં", "3 મહિનામાં").
        for (const w of ["મીલીમીટર", "મીટર", "મિનિટ", "મહિના"])
            expect(gu(`35 ${w}`)).toBe(gu(`પાંત્રીસ ${w}`));
    });

    test("suppletive ordinals 1-4/6 take their own consonant, not -મ-", () => {
        expect(gu("1લી")).toBe(phonemizeWord("પહેલી")); // corpus: "1લી અને 3જી ન્યૂ હૅમ્પશાયર"
        expect(gu("3જી")).toBe(phonemizeWord("ત્રીજી"));
        // 4થી is NOT claimed: થી is also the ablative postposition and the corpus has no instance, so
        // the ambiguity is left to the join rule rather than guessed at.
        expect(gu("4થી")).toBe(gu("ચારથી"));
    });

    test("the clock: the colon was a phrase break and :00 was read as શૂન્ય", () => {
        expect(gu("9:30 ના")).toBe(gu("નવ 30 ના"));
        expect(gu("10:00 વાગ્યે")).toBe(gu("દસ વાગ્યે")); // વાગ્યે consumed, never doubled
        expect(gu("11:00 વાગતાજ")).toBe(gu("અગિયાર વાગતાજ"));
        expect(gu("12:00 GMT વાગ્યે")).toBe(gu("12 GMT વાગ્યે")); // timezone ⇒ no second વાગ્યે
        expect(gu("07: 19 વાગ્યે")).toBe(gu("સાત 19 વાગ્યે")); // a space after the colon occurs ×3
        // The reading is deliberately minimal: Gujarati's "વાગીને … મિનિટે" is absent from this corpus,
        // so it is not invented — only the two measurable defects are fixed.
        expect(gu("8:30 વાગ્યે")).not.toContain(" , ");
        // SPORTS times are not clocks. The inherited Hindi rule claimed 4:41.30 and emitted a bogus
        // clock plus a spurious phrase break.
        expect(gu("4:41.30")).toBe(gu("4 41.30"));
    });

    test("dotted initialisms and era markers: every interior dot was a phrase break", () => {
        expect(gu("યુ.એસ. નેવી")).toBe(gu("યુ એસ નેવી")); // was [jˈu . ˈes .]
        expect(gu("ઇ.સ. પૂર્વે 400")).toBe(gu("ઈસવીસન પૂર્વે 400"));
        expect(gu("દા.ત. વિઝા")).toBe(gu("દાખલા તરીકે વિઝા"));
        expect(gu("12.8 કી.મી.")).toBe(gu("12.8 કિલોમીટર"));
        expect(gu("ડો. મોલ ને")).toBe(gu("ડૉક્ટર મોલ ને"));
        // …and an ordinary sentence period is NOT claimed. Measured over the whole corpus: 18 matches
        // of the initialism pattern, all 18 real abbreviations, and ZERO utterances lost a final pause.
        expect(gu("આ છે. તે છે.")).toContain(" . ");
    });

    test("Gujarati unit abbreviations, and the rate", () => {
        expect(gu("220 કિમી")).toBe(gu("220 કિલોમીટર")); // was read as a word, [kˈimi]
        expect(gu("56 મીમી")).toBe(gu("56 મીલીમીટર"));
        expect(gu("35 એમએમ")).toBe(gu("35 મીલીમીટર"));
        expect(gu("165 કિમી/ક")).toBe(gu("165 કિલોમીટર પ્રતિ કલાક")); // પ્રતિ is corpus-attested
    });

    test("visarga written as an ASCII colon — a CLOSED list, not the pattern", () => {
        expect(gu("પુન:સ્થાપિત")).toBe(gu("પુનઃસ્થાપિત")); // was [pˈun , st̪ʰˈapit̪]
        expect(gu("સંભવત: અન્ય")).toBe(gu("સંભવતઃ અન્ય"));
        // …but a genuine list colon stays the phrase break the manifest maps it to (×40 in the corpus).
        expect(gu("કહ્યું: બાળકો")).toContain(" , ");
    });

    test("ranges take થી only when ASCENDING — 4 of the 17 pairs are sports scores", () => {
        expect(gu("1644-1912")).toBe(gu("1644 થી 1912"));
        expect(gu("10-60 મિનિટ")).toBe(gu("10 થી 60 મિનિટ"));
        expect(gu("5-3")).toBe(gu("5 3")); // an ice-hockey win, NOT "five to three"
        expect(gu("7-2")).toBe(gu("7 2")); // a head-to-head record
        expect(gu("6-6")).toBe(gu("6 6")); // a tie-break
    });

    test("degrees, tilde, fractions — and the signs deliberately left alone", () => {
        expect(gu("+30°C")).toBe(gu("+30 ડિગ્રી સેલ્સિયસ")); // ડિગ્રી, not Marathi's અંશ
        expect(gu("~500")).toBe(gu("આશરે 500"));
        expect(gu("1/5 ઇંચ")).toBe(gu("એક ભાગ્યા પાંચ ઇંચ"));
        // 293/4 and 241/2 are MIXED NUMBERS (29¾, 24½) written without the space, so `num < den`
        // refuses them rather than saying "two hundred ninety-three divided by four".
        expect(gu("293/4 ઇંચ")).toBe(gu("293 4 ઇંચ"));
        expect(gu("+30°C")).not.toBe(gu("30°C"));
        expect(gu("+30°C")).toBe(gu("પ્લસ 30°C"));
    });

    test("NEGATIVE RESULTS worth recording", () => {
        // Gujarati digits ૦-૯ occur only 11 times, in TWO utterances — the Marathi finding (×597) does
        // NOT generalise. The fold is kept because it is loss-free and both instances are clocks.
        expect(gu("૧૨૩")).toBe(gu("123"));
        // ZERO danda ।/॥ in this corpus (it punctuates with the ASCII period), but the mark still works.
        expect(gu("ગુજરાતી ભાષા। નવીન")).toContain(" . ");
        // ZERO ZWJ/ZWNJ: the Marathi tokenizer-splitting defect does not occur here.
    });

    // #586 — `વર્ગ કિલોમીટર` ×10 and `ક્યુબિક મીટર` ×2, word-first. Neither BARE word is the evidence:
    // વર્ગ ×55 is the CLASSROOM ("વિદ્યાર્થીઓ તેમના વર્ગમાં બેસીને") and ઘન ×6 is SOLID, the state of matter —
    // so the corpus, not a label, is what picks the English loan ક્યુબિક over ઘન for the cube.
    // Bare `m` had to be declared for the cube to have a head noun (`120 m³` read as a bare letter *ˈɛm*
    // before); digit-adjacent `m` is ×0 in this corpus, and the version guard still holds below.
    test("the squared/cubed measure word (#586)", () => {
        expect(phonemize("7,83,562 km²", "gu")).toContain("ʋˈəɾɡ kˈilomiʈəɾ");
        expect(phonemize("20.2 લાખ km²", "gu")).toContain("lˈakʰ ʋˈəɾɡ kˈilomiʈəɾ"); // hops the magnitude
        expect(phonemize("120 m³", "gu")).toContain("kjˈubik mˈiʈəɾ");
        expect(phonemize("802.11m", "gu")).toContain("ˈɛm"); // a dotted designation is not a quantity
    });
});
