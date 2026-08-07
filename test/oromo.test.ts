import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord, phonemizeWordSegmental } from "../src/languages/oromo/oromo.ts";

// Canonical-IPA goldens for Oromo / Afaan Oromoo (om) — shallow near-phonemic Qubee Latin orthography. Signature
// Cushitic features: EJECTIVES c→t͡ʃʼ, q→kʼ, x→tʼ, ph→pʼ; retroflex IMPLOSIVE dh→ᶑ; DOUBLED vowels = long (aa→aː),
// DOUBLED consonants = geminate (bb→bː); apostrophe → glottal stop [ʔ]. Cross-checked vs epitran orm-Latn (100%
// folded) + kaikki human IPA (96%).
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

// ── TEXT NORMALIZATION ────────────────────────────────────────────────────────────────────────
// The pins are on the rule's BRANCHES, not on the corpus's instances (trap 13 (pin the rule's BRANCHES)): the ordinal and the
// enclitic are COMPOSED from the cardinal, so the branch the corpus never writes (10ffaa, 8ffaa, a
// consonant-final stem before -tti) is pinned beside the branch it does. The evidence for every word is
// in, Run 4.
import { normalizeOromo, normalizeOromoNumerals } from "../src/languages/oromo/normalize.ts";
import { numberToWords } from "../src/languages/oromo/numbers.ts";

describe("Oromo text normalization", () => {
    test("ordinal -ffaa: composed from the cardinal, every stem shape", () => {
        // The corpus's OWN spelled-out ordinals, reproduced by the rule: tokkoffaa, lamaffaa, sadaffaa,
        // afuraffaa, shanaffaa, jahaffaa, torbaffaa.
        expect(normalizeOromoNumerals("1ffaa")).toBe("tokkoffaa"); // vowel-final stem
        expect(normalizeOromoNumerals("3ffaa")).toBe("sadaffaa"); // final ii → a
        expect(normalizeOromoNumerals("5ffaa")).toBe("shanaffaa"); // consonant-final → link a
        // …and the branches the corpus does NOT write as digits+ffaa (trap 8 (zero corpus instances is not evidence of…)/13).
        expect(normalizeOromoNumerals("8ffaa")).toBe("saddeetaffaa");
        expect(normalizeOromoNumerals("10ffaa")).toBe("kudhanaffaa");
        expect(normalizeOromoNumerals("16ffaa")).toBe("kudha jahaffaa"); // suffix on the LAST word only
        expect(normalizeOromoNumerals("190ffaa")).toBe("dhibba sagaltamaffaa");
        expect(normalizeOromoNumerals("15ffaatti")).toBe("kudha shanaffaatti"); // ffaa + trailer
        expect(normalizeOromoNumerals("2ffaa’ti")).toBe("lamaffaati"); // the apostrophe is a separator
    });

    test("glued case enclitic attaches to the WORD, with its linking vowel (trap 14 (agreement cannot be applied to digits))", () => {
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

    // The corpus DETACHES the same enclitic in 24 unique utterances — more sentences than it glues it in —
    // and the detached reading is the same impossibility: a word-initial geminate [tːi], or a bare [f]/[n].
    test("the enclitic written with a SPACE attaches just the same", () => {
        expect(normalizeOromoNumerals("bara 1945 tti")).toBe("bara kuma dhibba sagal afurtamii shanitti");
        expect(normalizeOromoNumerals("bara 2016 ti")).toBe("bara kuma lama kudha jahati");
        expect(normalizeOromoNumerals("sa’aatii 24 f")).toBe("sa’aatii digdamii afuriif");
        expect(normalizeOromoNumerals("qabxii 2207 n")).toBe("qabxii kuma lama dhibba lama torbaan");
        expect(normalizeOromoNumerals("22500 tiin")).toBe("kuma digdamii lama dhibba shanitiin");
        expect(normalizeOromoNumerals("miliyyoona 2.8 tti")).toBe("miliyyoona lama tuqaa saddeetitti");
        // The SPACED alternation is narrower than the glued one, and `tu` is why: it is an Oromo WORD, the
        // focus marker, and only the absence of a space tells the two apart.
        expect(normalizeOromoNumerals("Caribe tu jiraata")).toBe("Caribe tu jiraata");
        expect(normalizeOromoNumerals("namoota 15 tu")).toBe("namoota 15 tu");
        expect(normalizeOromoNumerals("15tu")).toBe("kudha shanitu"); // …glued, it still attaches
        // `fi` survives by construction: the trailing-letter guard rejects `f` followed by `i`.
        // (an UNSUFFIXED number stays digits — the tokenizer speaks it downstream.)
        expect(normalizeOromoNumerals("qabxii 2220 fi 2207 n")).toBe("qabxii 2220 fi kuma lama dhibba lama torbaan");
        // A clause break really does end the numeral phrase, so the space must not cross one.
        expect(normalizeOromoNumerals("bara 1945, tti")).toBe("bara 1945, tti");
        // A VERSION LETTER IS NOT AN ENCLITIC. `802.11n` reaches pass 2 already split, and with the letter
        // set off by a space it was indistinguishable from `2,207 n` — the corpus diff caught the Wi-Fi
        // standard being read as *tokkoon*. The hyphen step 8 emits is what keeps the two apart.
        expect(normalizeOromo("saffisawwan 802.11n kan")).toBe("saffisawwan 802 tuqaa 1 1-n kan");
        expect(normalizeOromoNumerals("saffisawwan 802 tuqaa 1 1-n kan")).toBe("saffisawwan 802 tuqaa 1 1-n kan");
    });

    // Step 5 consumes the meridiem and emits a half-day WORD, so a following enclitic no longer has digits
    // in front of it — the corpus's `sa’a 1:15 a.m tti` left a bare [tːi] until the rule looked here too.
    test("an enclitic after the half-day word the clock emits", () => {
        expect(normalizeOromo("sa’a 1:15 a.m tti")).toBe("sa’a 1 fi daqiiqaa 15 ganama tti");
        expect(normalizeOromoNumerals("sa’a 1 fi daqiiqaa 15 ganama tti"))
            .toBe("sa’a 1 fi daqiiqaa 15 ganamatti");
        expect(normalizeOromoNumerals("galgala tti")).toBe("galgalatti");
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

    test("initialisms spell out with the Qubee letter names", () => {
        // OOV: Oromo permits essentially no complex onset, so the phonotactic rule spells these with no
        // data entry at all.
        expect(phonemize("DNA isaa", "om")).toBe("dˈaː na ˈaː isˈaː");
        expect(phonemize("GPS fayyadama", "om")).toBe("ɡˈaː pˈaː sˈaː fajːadˈama");
        // LEXICAL: vowel-initial and readable, so only a manifest entry can know they are spelled.
        expect(phonemize("US fi UK", "om")).toBe("ˈuː sˈaː fˈi ˈuː kˈaː");
        // …and the ones that ARE words stay words.
        for (const w of ["UNESCO", "ACTA", "ROV"]) expect(phonemize(`${w} jedhe`, "om")).toContain("d͡ʒˈeᶑe");
        expect(phonemize("UNESCO jedhe", "om")).toBe("unˈest͡ʃʼo d͡ʒˈeᶑe");
        // THE ENCLITIC RIDES THE LAST LETTER NAME, which is what the corpus writes: `GPS'f` is the dative.
        expect(phonemize("GPS'f kenne", "om")).toBe("ɡˈaː pˈaː sˈaːʔf kˈenːe");
    });

    // ORDERING, pinned end-to-end because it is invisible in normalize.ts alone. `core/roman.ts` runs in
    // registry.ts, wrapping text(), so Romans are digits before the initialism pass — and the vowel letter
    // name `ii` this table emits is therefore never seen by it. A standalone `ii` DOES read as *lama* (two)
    // through the registry, so if the order were reversed every `MRI` would end in "two".
    test("a Roman numeral survives, and the emitted `ii` is not read as one", () => {
        expect(phonemize("seenaa II jedhu", "om")).toBe("seːnˈaː lˈama d͡ʒˈeᶑu"); // Roman → 2
        expect(phonemize("MRI scanner", "om")).toBe("mˈaː rˈaː ˈiː st͡ʃʼanːˈer"); // emitted ii = the vowel
        // The era marker must still expand rather than be spelled DAA-KAA-DAA.
        expect(phonemize("D.K.D 5000 tti", "om")).toBe("ᶑalˈoːta kiristˈoːs dˈura kˈuma ʃanˈitːi");
    });

    // the corpus's `iskuweer kiloometiiri 783,562` is a SQUARE KILOMETRE, and this language's units
    // are local precisely because the shared tier could only postpose them. The exponent rule sits beside
    // the `sq mi` one and keeps the same noun-first, number-last order.
    // The `\s?²`-but-not-`\s?2` asymmetry is copied from the tier: `km 6,387` and `km 2-3` are real forms
    // in this corpus, so a SPACED ASCII 2 must stay the next number.
    test("the squared/cubed measure word", () => {
        expect(phonemize("783.562 km²", "om")).toContain("iskuwˈeːr kiːloːmˈeːtira ᶑˈibːa");
        expect(phonemize("km 2-3", "om")).toBe("kiːloːmˈeːtira lˈama hˈanɡa sadˈiː");
    });

    // an earlier pass recorded `kuubik` as ×0 and left `m³` alone; the corpus does have the word,
    // spelled `kubiik` and in this language's own noun-first order: "iibame boba'aa kubiik metirii 120-160
    // of irraa qaba ture". Same shape as the `iskuweer` rule beside it.
    test("the cubed measure word, noun-first", () => {
        expect(phonemize("120 m³", "om")).toContain("kubˈiːk mˈeːtira");
        expect(phonemize("km 2-3", "om")).toBe("kiːloːmˈeːtira lˈama hˈanɡa sadˈiː"); // guard still holds
    });

    test("the multiplication sign runs BEFORE the unit block — unitPrefix moves the noun", () => {
        // ⚠ Oromo's unit rules honour `unitPrefix` and MOVE the noun ahead of its number, so `6 × 6 cm` became
        // `6 × seentiimeetira 6` — the sign's `(\d+)…(\d+)` no longer had a digit after it and *si’a* was
        // DROPPED. `6x6 cm` failed the mirror way: the `x` broke the unit rule's adjacency, so the sign read but
        // `cm` LEAKED. Running the sign first fixes both — the same ordering the shared tier needs for
        // `multiply`, for the same reason, found the same way: by probing a `unitPrefix` language.
        expect(phonemize("6 × 6 cm", "om")).toContain("sˈiʔa");
        expect(phonemize("6x6 cm", "om")).toBe(phonemize("6 × 6 cm", "om"));
        expect(phonemize("6x6 cm", "om")).not.toMatch(/t͡ʃʼm|\bcm\b/u);   // the unit no longer leaks
        expect(phonemize("5 × 5", "om")).toContain("sˈiʔa");
        // The unit forms the reorder exists for must be untouched — noun-first is Oromo's own convention.
        expect(phonemize("5 mm", "om")).toContain("miːliːmˈeːtira");
        expect(phonemize("km 6,387", "om")).toContain("kiːloːmˈeːtira");
        expect(phonemize("165km/h", "om")).toContain("saʔaːtˈiːtːi");
        expect(phonemize("3,850 km²", "om")).toContain("iskuwˈeːr");
    });

    test("accented Latin stays ONE word and goes to the foreign reader", () => {
        // `[A-Za-zʼ’']+` ended the token at a diacritic, so the letter carrying it became an unclaimed gap read
        // as an English LETTER NAME and the rest of the word started over: `São Paulo` → *s ˈə ˈo paˈulo*.
        // Invisible to every gate — no digit or raw mark survives and nothing VANISHES.
        expect(phonemize("Cañitas", "om")).toBe(phonemize("Cañitas", "en"));
        expect(phonemize("São", "om")).toBe(phonemize("São", "en"));
        // ⚠ The registry comment claimed "no foreign needed — om is Latin-script". Being Latin-script is exactly
        // what made a reader NECESSARY: the word group claims Latin text, so an accented name was claimed and
        // then mangled by a g2p with no rule for the letter.
        expect(phonemize("Cañitas", "om")).not.toMatch(/ˈɛn/u);
        // Native Oromo is untouched, and so are the rules that key on the Latin class.
        expect(phonemize("makiina nagaa", "om")).toBe("makˈiːna naɡˈaː");
        expect(phonemize("Kunis kan godhamu danda’u", "om")).toContain("dandˈaʔu");
        expect(phonemize("6 × 6 cm", "om")).toContain("sˈiʔa");
        expect(phonemize("165km/h", "om")).toContain("saʔaːtˈiːtːi");
    });
});
