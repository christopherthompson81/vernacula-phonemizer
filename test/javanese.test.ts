import { describe, expect, test } from "vitest";
import { normalizeJavanese } from "../src/languages/javanese/normalize.ts";

import { phonemize } from "../src/index.ts";
import {
    phonemizeWord,
    phonemizeWordRules,
} from "../src/languages/javanese/javanese.ts";

// Canonical-IPA goldens for Javanese / Basa Jawa (jv) — Austronesian, Latin script, rule-based g2p refereed
// by kaikki jav (human). The signature processes: the ⟨a⟩→[ɔ] rule (open final + penult harmony),
// the DENTAL vs RETROFLEX contrast (t̪ d̪ vs ʈ ɖ),
// closed-syllable laxing (i→ɪ u→ʊ) + final ⟨k⟩→ʔ, pepet/taling ⟨e⟩.
describe("javanese canonical IPA", () => {
    test("the a→ɔ rule (open final + penult harmony; closed final blocks it)", () => {
        const cases: [string, string][] = [
            ["apa", "ˈɔpɔ"], // both open a → ɔ
            ["mata", "mˈɔt̪ɔ"],
            ["Jawa", "d͡ʒˈɔwɔ"],
            ["basa", "bˈɔsɔ"],
            ["lima", "lˈimɔ"], // penult i not a → only final harmonises
            ["sanga", "sˈɔŋɔ"], // harmony across the ⟨ng⟩ digraph
            ["mangan", "mˈaŋan"], // closed final syllable blocks the rule
            ["dalan", "d̪ˈalan"],
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("dental vs retroflex, laxing, final ⟨k⟩→ʔ", () => {
        const cases: [string, string][] = [
            ["kutha", "kˈuʈɔ"], // ⟨th⟩→ʈ retroflex (not aspirate); final a→ɔ
            ["dhawuh", "ɖˈawʊh"], // ⟨dh⟩→ɖ retroflex; u→ʊ laxing
            ["pitik", "pˈit̪ɪʔ"], // dental t̪; i→ɪ; final k→ʔ
            ["cilik", "t͡ʃˈilɪʔ"], // ⟨c⟩→t͡ʃ
            ["wong", "wˈɔŋ"], // o→ɔ closed laxing, ⟨ng⟩→ŋ
            ["dhuwur", "ɖˈuwʊr"],
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("pepet vs taling ⟨e⟩ (diacritics disambiguate)", () => {
        expect(phonemizeWord("sega")).toBe("sˈəɡɔ"); // bare ⟨e⟩ → pepet ə
        expect(phonemizeWord("élok")).toBe("ˈelɔʔ"); // é → /e/
        expect(phonemizeWord("kringèt")).toBe("krˈiŋɛt̪"); // è → /ɛ/

        // Homorganic nasal assimilation: /n/ → [ɲ] before a palatal affricate (rule, both scripts).
        expect(phonemizeWord("kanca")).toBe("kˈaɲt͡ʃɔ");
        expect(phonemizeWord("banci")).toBe("bˈaɲt͡ʃi");

        // CROSS-SCRIPT ⟨e⟩ lexicon: for undiacritized Latin the ⟨e⟩ pepet/taling is unrecoverable, so the SHIPPED
        // path pins the Aksara-resolved taling vowel (pangeran→paŋeran); phonemizeWordRules keeps the pepet default.
        expect(phonemizeWord("pangeran")).toBe("paŋˈeran"); // taling — from the Aksara cross-script
        expect(phonemizeWordRules("pangeran")).toBe("paŋˈəran"); // Latin rule default (pepet)
        expect(phonemizeWord("bebek")).toBe("bˈebeʔ");
        // Number words bypass the content lexicon (the taling homograph seket ≠ the number 50 [səkət̪]):
        expect(phonemize("50", "jv")).toBe("sˈəkət̪");
    });

    test("numbers (ngoko; irregular -likur / suppletive seket·sewidak)", () => {
        expect(phonemize("20", "jv")).toBe("rˈɔŋ pˈulʊh");
        expect(phonemize("25", "jv")).toBe("səlˈawe"); // selawé (suppletive)
        expect(phonemize("50", "jv")).toBe("sˈəkət̪"); // seket
        expect(phonemize("60", "jv")).toBe("səwˈid̪aʔ"); // sewidak
        expect(phonemize("100", "jv")).toBe("sˈat̪ʊs"); // satus
        expect(phonemize("1234", "jv")).toBe(
            "sˈəwu rˈɔŋ ˈat̪ʊs t̪ˈəlʊŋ pˈulʊh pˈapat̪",
        );
    });

    test("running text: a→ɔ + pepet on connected words", () => {
        expect(phonemize("Aku mangan sega.", "jv")).toContain(
            "ˈaku mˈaŋan sˈəɡɔ",
        );
    });

    // Aksara Jawa (Hanacaraka) front-end — the native abugida, scanned into the SAME phonology as Latin. It is
    // MORE phonemic than the Latin: pepet vs taling and dental vs retroflex are written distinctly.
    test("Aksara Jawa script: abugida → same phonology", () => {
        const cases: [string, string][] = [
            ["ꦗꦮ", "d͡ʒˈɔwɔ"], // jawa — a→ɔ from the inherent vowels
            ["ꦱꦺꦭ", "sˈelɔ"], // sela — taling ꦺ = /e/ (not the pepet default)
            ["ꦥꦸꦭꦺꦴ", "pˈulo"], // pulo — taling + tarung = /o/
            ["ꦮꦺꦴꦁ", "wˈɔŋ"], // wong — o→ɔ closed laxing, cecak coda ŋ
            ["ꦱꦽꦔꦺꦔꦺ", "srəŋˈeŋe"], // srengenge — keret = medial -rə-
            ["ꦏꦸꦛ", "kˈuʈɔ"], // kutha — retroflex ꦛ = ʈ
            ["ꦒꦗꦃ", "ɡˈad͡ʒah"], // gajah — wignyan ꦃ = final /h/
            ["ꦲꦧꦁ", "ˈabaŋ"], // abang — ꦲ "ha" is the silent vowel carrier
            ["ꦥꦶꦠꦶꦏ꧀", "pˈit̪ɪʔ"], // pitik — same output as the Latin "pitik" (shared phonology)
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("Aksara Jawa digits route through the ngoko compositor", () => {
        expect(phonemize("꧑꧒꧓", "jv")).toBe("sˈat̪ʊs t̪əlulˈikʊr"); // 123 = satus telulikur
    });
});

describe("jv text normalization", () => {
    // Evidence, refusals and dead ends: docs/investigations/jv/jv_normalization_investigation.md.
    // ⚠ THE DOT IS CONTESTED BY THREE RULES in this language — thousands separator, decimal point (in the
    // imported English format) and clock — which is what the step order in normalize.ts exists to resolve.
    test("⚠ a grouping separator DESTROYS THE VALUE, in both conventions the corpus uses", () => {
        // `1.500` read *sˈid͡ʒi . lˈimaŋ ˈat̪ʊs* — "one, five hundred". The native dot groups (×47) and the
        // imported comma groups (×20); exactly-3-digit groups is what tells either from a decimal.
        expect(normalizeJavanese("1.500")).toBe("1500");
        expect(normalizeJavanese("200.000")).toBe("200000");
        expect(normalizeJavanese("32,548")).toBe("32548");
        // ⚠ BOTH AT ONCE — `± 1.485,36 km²` is grouped AND decimal. The dot arm's lookahead has to allow a
        // following comma or the group refuses to match and both separators stay clause pauses.
        expect(normalizeJavanese("1.485,36")).toBe("1485 koma tiga enam".replace("tiga enam", "3 6"));
    });

    test("the decimal is read digit by digit after koma, as Indonesian does", () => {
        expect(normalizeJavanese("1,4")).toBe("1 koma 4");
        expect(normalizeJavanese("43,34")).toBe("43 koma 3 4");
        expect(normalizeJavanese("16.46")).toBe("16 koma 4 6"); // the imported dot-decimal
        // ⚠ A VERSION/SECTION TRIPLE IS NOT A DECIMAL — `nomer 1.2.3` read *siji koma loro . telu*. The
        // guard refuses only when another dot-plus-digit follows, so a sentence-final decimal still reads.
        expect(normalizeJavanese("nomer 1.2.3")).toBe("nomer 1.2.3");
        expect(normalizeJavanese("Ana 3.5.")).toBe("Ana 3 koma 5.");
    });

    test("⚠ a clock's dot is claimed only where the corpus proves it is a clock", () => {
        // Whole hours only — `menit` scores ZERO in the corpus and `jam siji liwat` zero on jv.wikipedia,
        // so a clock with real minutes is left alone rather than read with a guessed word.
        expect(normalizeJavanese("jam 09.00")).toBe("jam 9");
        expect(normalizeJavanese("saka 00.00-03.00 ésuk")).toBe("saka 0 nganti 3 ésuk");
        expect(normalizeJavanese("jam 08.45")).toBe("jam 08.45");
        // ⚠ THE COLON IS DECLINED ENTIRELY: every one in the corpus is a 3-field timestamp, a sports time
        // or a Qur'an verse reference — the shapes a clock rule must NOT claim.
        expect(normalizeJavanese("jam 00:02:32 WIB")).toBe("jam 00:02:32 WIB");
        expect(normalizeJavanese("QS 3:83")).toBe("QS 3:83");
    });

    test("ranges take nganti — including the two whose endpoints are not bare digits", () => {
        expect(normalizeJavanese("taun 750 nganti 925")).toContain("nganti");
        expect(normalizeJavanese("10-15")).toBe("10 nganti 15");
        expect(normalizeJavanese("73–94 persèn")).toBe("73 nganti 94 persèn");
        // the sign is consumed and PUT BACK, so the tier still reads both halves
        expect(phonemize("72%-83%", "jv")).toContain(phonemizeWord("nganti"));
        // a coordinate: the left endpoint ends in a minute mark, not a digit
        expect(normalizeJavanese("110°30'-110°45'")).toContain("nganti");
    });

    test("⚠ the dash shapes that are NOT ranges stay untouched", () => {
        // This wiki is full of bibliographic debris and none of it is a range to read aloud.
        expect(normalizeJavanese("157-167 doi:10.1016/0301-0104")).not.toContain("nganti");
        // Botanical extreme — the parenthetical is not a range. ⚠ THE UNIT WAS LEAKING HERE and the old
        // golden pinned the leak: the `)` between the numeral and `cm` puts the symbol out of reach of the
        // digit-adjacent unit rule, so `cm` reached the IPA as raw ASCII in a Latin-script language, where no
        // leak gate can see it. It is a centimetre in every corpus instance of this shape, and the bare-token
        // path now reads it; the dash behaviour this test is about is unchanged.
        expect(normalizeJavanese("10-15(-17) cm")).toBe("10 nganti 15(-17) sèntimèter");
    });

    // ⚠ TRAP 58 — a rule that is right in isolation gave up at a full stop. The trailing guard carried a
    // bare `.`, so the rule declined at exactly a sentence end and `2004-2005.` came back untouched: two
    // cardinals with nothing between them. The dot must reject a CONTINUATION of the number, not a clause
    // mark.
    test("⚠ a clause-final range still takes its joiner (trap 58)", () => {
        expect(normalizeJavanese("abad 15-16.")).toBe("abad 15 nganti 16.");
        expect(normalizeJavanese("15-17.")).toBe("15 nganti 17.");
        expect(normalizeJavanese("ing 2004-2005.")).toBe("ing 2004 nganti 2005.");
        // …and the one job the dot still has HERE is kept — the identifier. (A dotted decimal never reaches
        // this rule: steps 3 and 4 read `5-13.7` as `5-13 koma 7` before the range runs.)
        expect(normalizeJavanese("157-167 doi:10.1016/0301-0104")).not.toContain("nganti");
        // ⚠ THE COMMA STAYS IN THE GUARD, but it is worth recording that in THIS layer neither separator is
        // reachable as a DECIMAL: steps 3 and 4 own both marks and run first, so `3-4,5(-12,5) cm` already
        // reads as a span here and did before this change too. Pinned so the ordering stays visible.
        expect(normalizeJavanese("3-4,5(-12,5) cm")).toBe("3 nganti 4 koma 5(-12 koma 5) sèntimèter");
    });

    test("units, exponents and the rate word, all corpus- or wiki-sourced", () => {
        expect(phonemize("132.000 km²", "jv")).toContain(phonemizeWord("persegi"));
        expect(phonemize("1 m³/s", "jv")).toContain(phonemizeWord("kubik"));
        expect(phonemize("5 km/jam", "jv")).toContain(phonemizeWord("per"));
        expect(phonemize("3,95 g/cm³", "jv")).toContain(phonemizeWord("gram"));
        expect(phonemize("475 jiwa/km²", "jv")).toContain(phonemizeWord("per"));
    });

    // ⚠ THE FOUR SI KEYS THAT WERE MISSING WHILE THE CORPUS WROTE ALL OF THEM. `10 mm` and `10 l` reached
    // the IPA as raw letters; `10 ha` was worse than a leak — the g2p read ⟨ha⟩ as a Javanese WORD, `hˈɔ`,
    // so no leak class could see it.
    test("mm, l/L and ha — declared because the corpus writes the abbreviation", () => {
        // jv.wikipedia's Milimèter article: "Milimèter utawi millimèter punika salah satunggalipun unit SI".
        expect(phonemize("18 mm", "jv")).toContain(phonemizeWord("milimèter"));
        // ⚠ THE CORPUS'S OWN ⟨mm⟩ IS A RATE — `2000 mm/taun`, a regency's rainfall — and declaring only the
        // numerator read it "millimetre YEAR": the denominator went undeclared, the optional rate group did
        // not match, and the tokenizer then dropped the slash silently. `taun` is a rate denominator now.
        expect(phonemize("2000 mm/taun", "jv")).toContain(phonemizeWord("per"));
        // The Liter article states the symbol convention itself: "Simbol liter yaiku huruf l cilik, utawa
        // hurup kapitale, L" — which is the attestation for BOTH KEYS, not only for the word.
        expect(phonemize("10 l", "jv")).toContain(phonemizeWord("liter"));
        expect(phonemize("10 L", "jv")).toContain(phonemizeWord("liter"));
        // The corpus writes the hectare five times and always CAPITALISED (`198.000 Ha`, `5 Ha`); ⟨ha⟩ is
        // multi-character, so the tier's folded index resolves the case. The km² article glosses the pair
        // in one line: "100 ha (hèktar)".
        expect(phonemize("198.000 Ha", "jv")).toContain(phonemizeWord("hèktar"));
        expect(phonemize("10 ha", "jv")).toContain(phonemizeWord("hèktar"));
        // ⚠ ⟨mg⟩ WAS THE FIFTH, found by the `RAW-LATIN` scan rather than by the sign classes: it is two
        // ASCII letters in a Latin script, so `14 mg kalsium` read *pat̪bəlas mɡ* and nothing could see it.
        // The corpus writes it six times in one nutrition table; `miligram` is ×40 / 13 articles on
        // jv.wikipedia in this exact slot and is DEFINED there — "1 miligram = 0.001 gram".
        expect(phonemize("14 mg", "jv")).toContain(phonemizeWord("miligram"));
        expect(phonemize("1,1 mg besi", "jv")).toContain(phonemizeWord("miligram"));
        // ⚠ AND THE ELEMENT SYMBOL IS NOT AT RISK: the bare-unit path is exact-case, so `Magnesium (Mg)`
        // keeps its capital ⟨Mg⟩ and is not read as a milligram.
        expect(phonemize("Magnesium (Mg)", "jv")).not.toContain(phonemizeWord("miligram"));
    });

    test("temperature is POSTPOSED, and °C runs before the bare degree", () => {
        // Left to the bare rule, `20°C` read *rˈɔŋ pˈulʊh t͡ʃ* — the scale letter as a bare consonant.
        expect(normalizeJavanese("20°C")).toBe("20 drajat celsius");
        // ⚠ THE TRAILING SPACE IS LOAD-BEARING: without it `6°LU` fused into `6 drajatLU`.
        // ⚠ …and the compass letters then reach the INITIALISM pass (step 8) and are spelled, which is
        // what a coordinate wants: `6°LU` is read "nem drajat èl u", not "nem drajat lu".
        expect(normalizeJavanese("6°LU")).toBe("6 drajat èl u");
    });

    test("currency, the approximation marker, and the ampersand", () => {
        // A bare `$` key cannot match inside `AS$`/`US$` — the sign is preceded by a letter.
        expect(phonemize("AS$143 milyar", "jv")).toContain(phonemizeWord("dolar"));
        expect(phonemize("US$100 milyar", "jv")).toContain(phonemizeWord("dolar"));
        expect(phonemize("Rp. 5.000", "jv")).toContain(phonemizeWord("rupiah"));
        // ⚠ ± IS "ABOUT" HERE, NOT A TOLERANCE — every corpus instance is a rounded population or area.
        expect(normalizeJavanese("± 1.485,36")).toBe("kurang luwih 1485 koma 3 6");
        expect(normalizeJavanese("+/- 327.866")).toBe("kurang luwih 327866");
        expect(phonemize("A&B", "jv")).toContain(phonemizeWord("lan"));
    });

    test("⚠ the fractions are SUPPLETIVE literals — the corpus glosses two of them itself", () => {
        // `1/3 (sapratelon)` and `saprapat saka gunggung` are the corpus's own glosses. A pattern rule
        // would immediately claim the DOIs and the year pairs, so only these three literals are claimed.
        expect(normalizeJavanese("1/2")).toBe("setengah");
        expect(normalizeJavanese("1/3")).toBe("sapratelon");
        expect(normalizeJavanese("1/4")).toBe("saprapat");
        expect(normalizeJavanese("taun 1985/1986")).toBe("taun 1985/1986"); // a year pair, not a fraction
        // ½ arrives already folded to `1/2` by the registry — which is why it read *sˈid͡ʒi lˈoro* before.
        expect(phonemize("½ kilogram", "jv")).toBe(
            `${phonemizeWord("setengah")} ${phonemizeWord("kilogram")}`,
        );
    });

    test("⚠ an unreadable initialism is SPELLED; a readable one keeps its word reading", () => {
        // `PBB` read [pbb] — a vowel-less cluster, no possible Javanese utterance. The OOV test in
        // core/initialisms.ts is what decides: it spells only what cannot be a word.
        expect(phonemize("PBB", "jv")).toBe(["pé", "bé", "bé"].map(phonemizeWord).join(" "));
        expect(phonemize("PDB", "jv")).toBe(["pé", "dé", "bé"].map(phonemizeWord).join(" "));
        expect(phonemize("UGM", "jv")).toBe(["u", "gé", "èm"].map(phonemizeWord).join(" "));
        // …and an acronym Javanese says as a WORD keeps that reading — the blast radius is small by design.
        expect(phonemize("UNESCO", "jv")).toBe(phonemizeWord("UNESCO"));
        expect(phonemize("WIB", "jv")).toBe(phonemizeWord("WIB"));
    });

    test("⚠ THE PHONOLOGY IS JAVANESE even though the letter-name inventory is inferred", () => {
        // The names are emitted as ORTHOGRAPHY and read by this language's own g2p, so its signatures
        // apply: the a→ɔ open-final rule and the dental series. Copying Indonesian's IPA table would have
        // imported Indonesian phonology along with the inventory.
        expect(phonemizeWord("a")).toBe("ˈɔ");
        expect(phonemizeWord("ka")).toBe("kˈɔ");
        expect(phonemizeWord("té")).toBe("t̪ˈe");
        expect(phonemizeWord("dé")).toBe("d̪ˈe");
    });

    test("a case-keyed acronym is letters; personal initials lose their spurious pauses", () => {
        // `AS` (Amérika Sarékat) is a readable word by phonotactics, so only the lexical list gets it right.
        expect(phonemize("AS", "jv")).toBe(["a", "ès"].map(phonemizeWord).join(" "));
        // `R. J. Speedy and C. A. Angell` read *r . d͡ʒ . … t͡ʃ . ˈɔ .* — bare consonants and four
        // spurious phrase breaks, in a corpus full of citations.
        expect(phonemize("R. T. Sumantri", "jv")).not.toMatch(/[.,]/u);
        expect(phonemize("R. T. Sumantri", "jv")).toContain(phonemizeWord("èr"));
    });

    test("⚠ Roman numerals are NOT spelled — core/roman.ts has already claimed them", () => {
        // It runs in the registry WRAPPING text(), so by the time the initialism pass sees the string they
        // are digits. Without that ordering, `Louis XIV` would read EX-EYE-VEE.
        expect(phonemize("Perang Donya II", "jv")).toContain(phonemizeWord("loro"));
        expect(phonemize("Louis XIV", "jv")).toContain(phonemizeWord("patbelas"));
    });

    test("⚠ a YEAR needs no rule — Javanese reads it as a CARDINAL, unlike Chinese", () => {
        // `year: 77647` is the artifact's largest cell and it was already correct.
        expect(phonemize("taun 2009", "jv")).toBe(
            `${phonemizeWord("taun")} ${phonemize("2009", "jv")}`,
        );
        expect(normalizeJavanese("taun 2009")).toBe("taun 2009");
    });
});
