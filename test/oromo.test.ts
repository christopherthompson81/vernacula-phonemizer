import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord, phonemizeWordSegmental } from "../src/languages/oromo/oromo.ts";

// Canonical-IPA goldens for Oromo / Afaan Oromoo (om) — shallow near-phonemic Qubee Latin orthography. Signature
// Cushitic features: EJECTIVES c→t͡ʃʼ, q→kʼ, x→tʼ, ph→pʼ; retroflex IMPLOSIVE dh→ᶑ; DOUBLED vowels = long (aa→aː),
// DOUBLED consonants = geminate (bb→bː); apostrophe → glottal stop [ʔ]. Cross-checked vs epitran orm-Latn (100%
// folded) + kaikki human IPA (96%). See docs/investigations/om_native_bringup_investigation.md.
describe("Oromo canonical IPA", () => {
    test("ejectives, implosive, length, gemination, glottal", () => {
        const cases: [string, string][] = [
            ["dhugaa", "ᶑuɡaː"], // dh → ᶑ (retroflex implosive), aa → aː
            ["qeree", "kʼereː"], // q → kʼ (ejective)
            ["xurii", "tʼuriː"], // x → tʼ (ejective)
            ["coqorsa", "t͡ʃʼokʼorsa"], // c → t͡ʃʼ (ejective affricate), q → kʼ
            ["nyaata", "ɲaːta"], // ny → ɲ
            ["shan", "ʃan"], // sh → ʃ (five)
            ["obboleessa", "obːoleːsːa"], // gemination bb→bː, ss→sː; ee→eː
            ["saddeet", "sadːeːt"], // dd → dː, ee → eː (eight)
        ];
        // asserted on the SEGMENTAL output: these goldens are about ejectives/gemination/length/glottal,
        // not about stress. Stress has its own block below, so a stress change can't silently rewrite them.
        for (const [w, exp] of cases) expect(phonemizeWordSegmental(w)).toBe(exp);
    });

    test("glottal stop + geminate digraph (where epitran is wrong, we are right)", () => {
        expect(phonemizeWordSegmental("buʼaa")).toBe("buʔaː"); // apostrophe → [ʔ] (epitran drops it)
        expect(phonemizeWordSegmental("qopphaaʼuu")).toBe("kʼopʼːaːʔuː"); // pph = geminate ph → [pʼː] (epitran gives pːh)
    });

    test("word-edge apostrophe/quote is punctuation, not a glottal", () => {
        // interior apostrophe = [ʔ]; a word-edge ' ʼ ’ (quotation) must NOT leak a glottal stop.
        expect(phonemize("dhugaa’", "om")).toBe("ᶑuɡˈaː");
        expect(phonemize("’dhugaa’", "om")).toBe("ᶑuɡˈaː");
        expect(phonemizeWordSegmental("buʼaa")).toBe("buʔaː"); // interior kept
    });

    test("text", () => {
        expect(phonemize("afaan oromoo", "om")).toBe("afˈaːn oromˈoː");
    });
});

// Stress is PHONETIC and PREDICTABLE in Oromo — "no lexical contrast by making use of stress, and it could be
// predictable from the environment" (Dejene Geshe, *Kamisee Oromo Phonology*, Addis Ababa University, 2010,
// §5.3.1; the same patterns are reported for the MECHA dialect by Waqo 1981 and Gragg 1976). These are the
// thesis's own worked examples, so the gold is an INDEPENDENT print source, not our own output.
describe("Oromo stress (Dejene 2010 §5.3.1)", () => {
    const syl = (ipa: string): number => {
        const pre = ipa.split("ˈ")[0] ?? "";
        let n = 0;
        for (let k = 0; k < pre.length; k++) {
            if (/[aeiou]/.test(pre[k]!) && !(k > 0 && pre[k] === pre[k - 1])) n++;
        }
        return n;
    };
    for (const [w, expected, rule] of [
        ["shan", 0, "1: monosyllable"],
        ["nama", 0, "2: disyllabic short-final → penult"],
        ["suuta", 0, "2: penult, whatever the preceding length"],
        ["sanbata", 1, "3: polysyllabic, no long vowel → penult"],
        ["bilbila", 1, "3: penult"],
        ["sangaa", 1, "4: long-final → ultimate"],
        ["dargaggoo", 2, "4: long-final → ultimate"],
        ["mootummaa", 2, "4: long-final → ultimate"],
        ["bishaan", 1, "5: consonant-final, long vowel elsewhere takes it"],
        ["kudhan", 1, "5: consonant-final, all short → ultimate"],
        ["kamis", 1, "5: consonant-final → ultimate"],
    ] as const) {
        test(`${w} — rule ${rule}`, () => {
            expect(syl(phonemizeWord(w)), phonemizeWord(w)).toBe(expected);
        });
    }

    // §5.3.1 rule 7 — the focus marker and short object pronouns are UNSTRESSED. They are frequent enough
    // that stressing them would put a spurious prominence on a clitic in nearly every sentence.
    test("rule 7: open monosyllabic function words are unstressed", () => {
        for (const w of ["tu", "nu", "na", "si"]) expect(phonemizeWord(w), w).not.toContain("ˈ");
        expect(phonemizeWord("shan")).toContain("ˈ"); // a CONTENT monosyllable is still stressed
    });

    test("exactly one primary stress per word", () => {
        for (const w of ["nama", "bishaan", "dargaggoo", "sanbata", "shan", "obboleessa"]) {
            expect(phonemizeWord(w).match(/ˈ/gu)?.length, w).toBe(1);
        }
    });
});

// ── TEXT NORMALIZATION (#562) ────────────────────────────────────────────────────────────────────────
// The pins are on the rule's BRANCHES, not on the corpus's instances (trap 13): the ordinal and the
// enclitic are COMPOSED from the cardinal, so the branch the corpus never writes (10ffaa, 8ffaa, a
// consonant-final stem before -tti) is pinned beside the branch it does. The evidence for every word is
// in docs/investigations/om_normalization_investigation.md, Run 4.
import { normalizeOromo, normalizeOromoNumerals } from "../src/languages/oromo/normalize.ts";
import { numberToWords } from "../src/languages/oromo/numbers.ts";

describe("Oromo text normalization", () => {
    test("ordinal -ffaa: composed from the cardinal, every stem shape", () => {
        // The corpus's OWN spelled-out ordinals, reproduced by the rule: tokkoffaa, lamaffaa, sadaffaa,
        // afuraffaa, shanaffaa, jahaffaa, torbaffaa.
        expect(normalizeOromoNumerals("1ffaa")).toBe("tokkoffaa"); // vowel-final stem
        expect(normalizeOromoNumerals("3ffaa")).toBe("sadaffaa"); // final ii → a
        expect(normalizeOromoNumerals("5ffaa")).toBe("shanaffaa"); // consonant-final → link a
        // …and the branches the corpus does NOT write as digits+ffaa (trap 8/13).
        expect(normalizeOromoNumerals("8ffaa")).toBe("saddeetaffaa");
        expect(normalizeOromoNumerals("10ffaa")).toBe("kudhanaffaa");
        expect(normalizeOromoNumerals("16ffaa")).toBe("kudha jahaffaa"); // suffix on the LAST word only
        expect(normalizeOromoNumerals("190ffaa")).toBe("dhibba sagaltamaffaa");
        expect(normalizeOromoNumerals("15ffaatti")).toBe("kudha shanaffaatti"); // ffaa + trailer
        expect(normalizeOromoNumerals("2ffaa’ti")).toBe("lamaffaati"); // the apostrophe is a separator
    });

    test("glued case enclitic attaches to the WORD, with its linking vowel (trap 14)", () => {
        expect(normalizeOromoNumerals("1994tti")).toBe("kuma dhibba sagal sagaltamii afuritti"); // C + i
        expect(normalizeOromoNumerals("2010’tti")).toBe("kuma lama kudhanitti");
        expect(normalizeOromoNumerals("1tti")).toBe("tokkotti"); // V → bare (corpus: tokkotti ×7)
        expect(normalizeOromoNumerals("3n")).toBe("sadiin"); // -n after a LONG vowel
        expect(normalizeOromoNumerals("2n")).toBe("lamaan"); // -n lengthens a short one (corpus ×9)
        expect(normalizeOromoNumerals("5n")).toBe("shaniin"); // -n after a consonant (corpus ×1)
        expect(normalizeOromoNumerals("2020f")).toBe("kuma lama digdamaaf");
        expect(normalizeOromoNumerals("10if")).toBe("kudhaniif"); // written link folded into the stem's
        expect(normalizeOromoNumerals("30tu")).toBe("soddomatu");
        expect(normalizeOromoNumerals("1.5tti")).toBe("tokko tuqaa shanitti"); // a DECIMAL operand
        // NOT a suffix: `fi` and `ni` are words, `moota` has no attested attachment, `s` is a plural on a
        // foreign designation. All keep the reading they had.
        expect(normalizeOromoNumerals("1fi2")).toBe("1fi2");
        expect(normalizeOromoNumerals("1850moota")).toBe("1850moota");
        expect(normalizeOromoNumerals("Il-76s")).toBe("Il-76s");
    });

    test("de-grouping, and the thousands crash it exposed", () => {
        expect(normalizeOromo("783,562 qabata")).toBe("783562 qabata");
        expect(numberToWords(783562)).toBe("kuma dhibba torba saddeettamii sadii dhibba shan jaatamii lama");
        expect(normalizeOromoNumerals("2,3")).toBe("2 tuqaa 3"); // a 1–2 digit block is NOT grouping
    });

    test("decimal point stays DIGITS so the symbol tier can still see the number", () => {
        expect(normalizeOromoNumerals("2.3")).toBe("2 tuqaa 3");
        expect(normalizeOromoNumerals("6.34")).toBe("6 tuqaa 3 4"); // fraction read digit by digit
        expect(phonemize("miliyoona 2.3", "om")).toBe("milijˈoːna lˈama tukʼˈaː sadˈiː");
        expect(phonemize("Biliyoona $2.3", "om")).toBe("bilijˈoːna doːlˈaːra lˈama tukʼˈaː sadˈiː");
    });

    test("clock: hour-and-minute, bare hour at :00, half-day words, and what is NOT a clock", () => {
        expect(normalizeOromo("11:20 irratti")).toBe("11 fi daqiiqaa 20 irratti");
        expect(normalizeOromo("sa’aatii 10:00 irratti")).toBe("sa’aatii 10 irratti"); // never *zeeroo*
        expect(normalizeOromo("8:46 a.m.")).toBe("8 fi daqiiqaa 46 ganama");
        expect(normalizeOromo("8:46 p.m.")).toBe("8 fi daqiiqaa 46 galgala");
        expect(normalizeOromo("har’a 12.00 GMT tti")).toBe("har’a 12 GMT tti"); // the dot form
        // `qabxii 2:2` is a degree classification, not a time — the minutes must be two digits.
        expect(normalizeOromo("qabxii 2:2 argachuun")).toBe("qabxii 2:2 argachuun");
    });

    test("range joins with hanga; a SCORE is left alone (direction is the discriminator)", () => {
        expect(normalizeOromo("(1644-1912)")).toBe("(1644 hanga 1912)");
        expect(normalizeOromo("bara 1995-96")).toBe("bara 1995 hanga 96"); // a year span
        expect(normalizeOromo("guyyaa 2-5 barbaada")).toBe("guyyaa 2 hanga 5 barbaada");
        expect(normalizeOromo("waliin 7-2 dha")).toBe("waliin 7-2 dha"); // descending → a score
        expect(normalizeOromo("26-00 dhaan")).toBe("26-00 dhaan");
        // An ORDINAL range — the mined artifact counts 0 of these, and the corpus has one
        // (`jaarraa 10ffaa - 11ffaa`); without its own rule the spaced hyphen read as a MINUS.
        expect(normalizeOromo("jaarraa 10ffaa - 11ffaa")).toBe("jaarraa 10ffaa hanga 11ffaa");
        expect(phonemize("jaarraa 10ffaa - 11ffaa", "om")).toBe("d\u0361\u0292a\u02d0r\u02d0\u02c8a\u02d0 ku\u1d91anaf\u02d0\u02c8a\u02d0 h\u02c8an\u0261a k\u02c8u\u1d91a tok\u02d0of\u02d0\u02c8a\u02d0");
        expect(normalizeOromo("5 - 3")).toBe("5 - 3"); // a spaced score is still not a subtraction
    });

    test("units lead their number, on either written side, plus the rate and sq mi", () => {
        expect(normalizeOromo("mm 5")).toBe("miiliimeetira 5");
        expect(normalizeOromo("(mm 36 mm 24n negatiiva)")).toBe("(miiliimeetira 36 miiliimeetira 24n negatiiva)");
        expect(normalizeOromo("35 mm")).toBe("miiliimeetira 35"); // the postposed order, corpus-absent
        expect(normalizeOromo("(165km/h)")).toBe("(sa’aatiitti kiiloomeetira 165)"); // locative denominator
        expect(normalizeOromo("300,948 sq mi")).toBe("iskuweer maayilii 300948");
        expect(normalizeOromo("km 2-3 tauun")).toBe("kiiloomeetira 2 hanga 3 tauun"); // after the range step
    });

    test("percent and currency: the noun leads, and the tier's words are the sourced ones", () => {
        expect(phonemize("88% galche", "om")).toBe("parsantˈiː sadːeːtːamˈiː sadːˈeːt ɡˈalt͡ʃe");
        expect(phonemize("$ 1000", "om")).toBe("doːlˈaːra kˈuma");
        expect(phonemize("US$11,000", "om")).toBe("doːlˈaːra ameːrikˈaː kˈuma kˈuᶑa tˈokːo");
        // the enclitic survives the tier and is still attached to the WORD, not the digits
        expect(phonemize("miiliyoona £27tiin", "om")).toBe("miːlijˈoːna paːwundˈiː diɡdamˈiː torbatˈiːn");
        // a decimal percent: the tier claims the sign first, the decimal is read after it
        expect(phonemize("3.5%", "om")).toBe("parsantˈiː sadˈiː tukʼˈaː ʃˈan");
    });

    test("degrees, fraction, era marker, abbreviations, and every sign class", () => {
        expect(normalizeOromo("35°W")).toBe("digirii 35 dhihaa");
        expect(normalizeOromo("20 °C")).toBe("digirii 20"); // the SCALE name is unsourced, so unread
        expect(normalizeOromo("inchii 1/5")).toBe("inchii 5 keessaa 1"); // denominator-first
        expect(normalizeOromo("D.K.D 5000")).toBe("dhaloota Kiristoos dura 5000");
        expect(normalizeOromo("(fkn. Neezerland")).toBe("(fakkeenyaaf Neezerland");
        expect(normalizeOromo("Dr. Damadiiyan")).toBe("Dr Damadiiyan"); // the dot, not the letters
        expect(normalizeOromo("B&amp;B")).toBe("B fi B");
        expect(normalizeOromo("x = y")).toBe("x wal qixa y");
        expect(normalizeOromo("5 < 6")).toBe("5 6 caalaa xiqqaa");
        expect(normalizeOromo("5 > 6")).toBe("5 6 caalaa guddaa");
        expect(normalizeOromo("6 × 6")).toBe("6 si’a 6");
        expect(normalizeOromo("-5")).toBe("hir’isuu 5");
        expect(normalizeOromo("+5")).toBe("ida’uu 5");
    });

    test("a sentence end is never claimed", () => {
        // ~40 of the corpus's 49 `X.` shapes are sentence-final periods. None may be eaten: the pause
        // has to survive both passes, next to an abbreviation rule and next to the decimal rule.
        expect(normalizeOromo("ga’e. Inni yeroo")).toBe("ga’e. Inni yeroo");
        expect(phonemize("dhagaan tokko. Kan inni", "om")).toContain(" . ");
        expect(normalizeOromoNumerals("fakkii 1.1.")).toBe("fakkii 1 tuqaa 1.");
        expect(phonemize("fakkii 1.1.", "om")).toBe("fakːˈiː tˈokːo tukʼˈaː tˈokːo .");
    });
});
