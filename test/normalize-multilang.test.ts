import { describe, expect, test } from "vitest";

import { makeSymbolNormalizer, slavicCountForm } from "../src/core/normalizeSymbols.ts";
import { numberToWords as cyNum } from "../src/languages/welsh/numbers.ts";
import { numberToWords as omNum } from "../src/languages/oromo/numbers.ts";
import { phonemize } from "../src/index.ts";

// #562 beyond English: the shared symbol layer (%, currency, units — per-language DATA over one engine,
// with real count agreement), the French roman-numeral rules, and the Welsh + Oromo number compositors.
describe("shared symbol normalizer (core)", () => {
    test("slavicCountForm implements the 1 / 2–4 / 5+ split with the 11–14 exception", () => {
        const f = slavicCountForm;
        expect([f(1), f(2), f(4), f(5), f(11), f(12), f(21), f(22), f(25), f(111)]).toEqual(
            [0, 1, 1, 2, 2, 2, 0, 1, 2, 2]);
    });

    test("percentPrefix emits the word before the number (Turkish order)", () => {
        const n = makeSymbolNormalizer({ percent: ["yüzde"], percentPrefix: true });
        expect(n("%40")).toBe("yüzde 40");
        expect(n("40%")).toBe("yüzde 40");
    });

    test("currency hops the magnitude and agrees in count", () => {
        const n = makeSymbolNormalizer({
            percent: ["percent"],
            currency: { $: ["dollar", "dollars"] },
            magnitudes: ["million"],
        });
        expect(n("$5 million")).toBe("5 million dollars");
        expect(n("$1")).toBe("1 dollar");
    });
});

describe("language-level symbol normalization", () => {
    test("Slavic agreement end-to-end (Czech, Russian)", () => {
        expect(phonemize("1 km", "cs")).toContain("kˈɪlomˌɛtr̩"); // sg
        expect(phonemize("2 km", "cs")).toContain("mˌɛtrɪ"); // paucal -y
        expect(phonemize("25 km", "cs")).toContain("mˌɛtruː"); // gen pl -ů
        expect(phonemize("40% и 2 км", "ru")).toBe("sˈorək prɐt͡sˈɛntəf i dva kʲɪɫɐmʲˈetrə");
    });

    test("percent across the wired languages", () => {
        expect(phonemize("40%", "fr")).toBe("kaʁɑ̃t puʁ sˈɑ̃");
        expect(phonemize("40%", "de")).toContain("pʁot͡sˈɛnt");
        expect(phonemize("%40", "tr")).toBe("jyzdˈe kˈɯɾk"); // prefix order
        expect(phonemize("40%", "ga")).toContain("fˠˈiːnʲ ɟˈeːd̪ˠ"); // faoin gcéad
    });
});

describe("French roman numerals", () => {
    test("century ordinals and regnal cardinals", () => {
        expect(phonemize("au xviie siècle", "fr")).toBe("o disɛtjɛm sjˈɛkl"); // dix-septième, per Lexique disɛtjɛm
        expect(phonemize("louis xiv", "fr")).toBe("lwi katˈɔʁz"); // louis quatorze — French regnal is CARDINAL
        expect(phonemize("un vieux livre", "fr")).toBe("œ̃ vjø lˈivʁ"); // no false positive
        // Unbounded now: the closed 2–20 table let anything past XX fall through and be letter-spelled
        // ("xxxe siècle" → [ksksksə]). Uppercase unlocks any value, as elsewhere in the fleet.
        expect(phonemize("xxxe siècle", "fr")).toBe("tʁɑ̃tjɛm sjˈɛkl"); // trentième
        expect(phonemize("XIe siècle", "fr")).toBe("ɔ̃zjɛm sjˈɛkl"); // onzième — XI is a global collision, but
        expect(phonemize("Ve siècle", "fr")).toBe("sɛ̃kjɛm sjˈɛkl"); // cinquième — the -e suffix licenses both
    });
});

// Welsh: modern decimal system. Every base word referee-attested; ddeg/gant are the regular soft
// mutations whose orthography the G2P reads deterministically.
describe("Welsh number compositor", () => {
    for (const [n, w] of [
        [25, "dau ddeg pump"], [11, "un deg un"], [56, "pum deg chwech"], // pump clips to pum
        [200, "dau gant"], [300, "tri chant"], [600, "chwe chant"], // soft after dau, aspirate after tri/chwe
        [2000, "dwy fil"], [3000, "tair mil"], // mil is feminine
        [1998, "mil naw cant naw deg wyth"],
    ] as const) {
        test(`${n} → ${w}`, () => expect(cyNum(n)).toBe(w));
    }
});

// Oromo: ones/teens-linker/2 tens/dhibba/kuma/miliyoona are corpus- or kaikki-attested; the -ii tens
// linker and 4 tens stems are reference forms, flagged in the module.
describe("Oromo number compositor", () => {
    for (const [n, w] of [
        [7, "torba"], [11, "kudha tokko"], [25, "digdamii shan"], [50, "shantama"],
        [200, "dhibba lama"], [645, "dhibba jaha afurtamii shan"], [5000, "kuma shan"],
    ] as const) {
        test(`${n} → ${w}`, () => expect(omNum(n)).toBe(w));
    }

    test("digits are read in Oromo, not English (the #560 stopgap is gone)", () => {
        expect(phonemize("dhibbentaa 25 ta'a", "om")).toBe("ᶑibːentˈaː diɡdamˈiː ʃˈan tˈaʔa");
    });
});

// Round 3 (#562): the FLEURS-priority languages. Data is orthographic — each engine reads its own script,
// so no IPA was authored; attestation per word is in each language file's comment.
describe("symbol normalization — FLEURS-priority round", () => {
    test("percent across the newly wired languages", () => {
        expect(phonemize("88%", "am")).toBe("səmanja sɨmɨnt bəməto"); // በመቶ after the number
        expect(phonemize("93%", "cmn")).toContain("paⁱ˨˩˦ fən˥˥ ʈ͡ʂʐ̩˥˥"); // 百分之 PREFIX
        expect(phonemize("90%", "ja")).toContain("päːse̞ꜜnto̞"); // its own token → carries its pitch accent
        expect(phonemize("93%", "kk")).toContain("pˈɑjəz");
        expect(phonemize("88%", "ko")).toContain("pʰɘsˈentʰɯ");
        expect(phonemize("88%", "th")).toContain("pˈɤː˧se˧n"); // เปอร์เซ็นต์, kaikki-attested
        expect(phonemize("93%", "ta")).toContain("t͡ɕˈɐd̪ɐʋˌiːd̪ɐm"); // சதவீதம்
        expect(phonemize("88%", "vi")).toContain("fˈə˨˩n t͡ɕˈa˧m"); // phần trăm
        expect(phonemize("93%", "xh")).toContain("iipʼɛsˈɛːntʼi");
        expect(phonemize("93%", "zu")).toContain("amapʰɛsˈɛːntʼi");
        expect(phonemize("88%", "cy")).toContain("ˈə kˈant"); // y cant (referee-attested cant)
    });

    test("Cyrillic Kazakh units and Vietnamese syllable-split units", () => {
        expect(phonemize("17 км", "kk")).toContain("kəjlomˈetr");
        expect(phonemize("22 km", "vi")).toContain("kˈi˧ lˈo˧ mˈɛ˧˥t̪"); // ki lô mét, per syllable
    });

    test("engine regressions from this round stay fixed", () => {
        // space-grouping only fuses exact 3-digit blocks: "30 9" must stay two numbers
        expect(phonemize("$30 9 km", "ko")).toContain("kʰˈiɭɭomitʰɘ");
        // the %-prefix fallback must not glue a currency remnant onto a preceding percent
        expect(phonemize("88% $2", "cy")).toContain("ˈuːᶤθ dˈeːɡ ˈuːᶤθ ˈə kˈant"); // 88 y cant, not 882
    });

    /**
     * The magnitude hop, both defects found by the it/ko/th/tr fan-out (#562).
     *
     * The Italian run flagged that the shared tier emits "5 milioni dollari" where Italian needs the
     * partitive. Probing the languages that already ship a currency+magnitude pair showed it was not
     * latent at all: es, pt, fr and ca were ALL reading "cinco millones dolares". And the POSTPOSED form
     * matched nothing whatsoever, so "5 millions $" dropped the sign outright -- silent content loss.
     */
    test("a magnitude takes its connective, in the languages that need one", () => {
        expect(phonemize("$5 millones", "es")).toContain("miʎˈones de dˈolaɾes");
        expect(phonemize("$5 milhões", "pt")).toContain("miʎˈõj̃ʃ de dˈɔlɐɾɨʃ");
        expect(phonemize("$5 millions", "fr")).toContain("miljɔ̃ də dɔlˈaʁ");
        expect(phonemize("$5 milions", "ca")).toContain("miɫiˈons də dˈɔɫəɾs");
        // …and NOT in the languages that take none.
        expect(phonemize("$5 Millionen", "de")).toContain("mɪli̯ˈoːnən dˈɔlaɐ̯");
        expect(phonemize("$5 miljoner", "sv")).toContain("mɪljˈuːnɛr dˈɔlːar");
        // A bare amount never gains a connective, because no magnitude was matched.
        expect(phonemize("5 $", "fr")).toContain("sɛ̃k dɔlˈaʁ");
    });

    test("a postposed currency sign survives a magnitude word", () => {
        // Was dropped entirely: the postposed pattern had no magnitude slot, so it matched nothing.
        expect(phonemize("5 millions $", "fr")).toContain("miljɔ̃ də dɔlˈaʁ");
        expect(phonemize("5 millones $", "es")).toContain("miʎˈones de dˈolaɾes");
        expect(phonemize("5 milhões $", "pt")).toContain("miʎˈõj̃ʃ de dˈɔlɐɾɨʃ");
    });

    /**
     * Three shared-tier defects reported by the nl/vi/pl/fa fan-out, all found by agents READING core
     * they were not permitted to edit. Each was live or wrong-by-construction, not merely awkward.
     */
    test("a magnitude governs the most-plural form, which for Slavic is the genitive plural", () => {
        // The tier passed the literal 2 as a COUNT, so the Slavic selector returned the paucal.
        // Polish shipped this (dolary for dolarów); Russian was spared only by declaring no magnitudes.
        expect(phonemize("$5 milionów", "pl")).toContain("miljˈɔnuf dɔlˈaruf");
        expect(phonemize("$5 миллионов", "ru")).toContain("mʲɪlʲːɪˈonəf dˈoɫːərəf");
        // Bare amounts still take ordinary count agreement.
        expect(phonemize("$2", "ru")).toContain("dˈoɫːərə");   // paucal
        expect(phonemize("$21", "ru")).toContain("dˈoɫːər");   // singular after 21
    });

    test("magnitudes and currency keys match longest-first", () => {
        // "миллион" is a prefix of "миллионов"; in declaration order it matched first and stranded the
        // suffix onto the currency word — *пять миллион долларовОВ*.
        expect(phonemize("$5 миллионов", "ru")).not.toContain("dˈoɫːərəvəf");
    });

    test("a multi-character currency code is expressible", () => {
        // Keys were a character class, so a letter code could not be declared at all and Polish had to
        // omit its own currency.
        expect(phonemize("20 zł", "pl")).toContain("zwˈɔtɨx");
        expect(phonemize("100 PLN", "pl")).toContain("zwˈɔtɨx");
    });

    test("the Arabic percent sign reaches the shared tier", () => {
        // U+066A was invisible to the tier, so ar/ur/fa each pre-folded it independently.
        expect(phonemize("80٪", "fa")).toContain("daɾsˈed");
        expect(phonemize("50٪", "ar")).toContain("fˈiː almˈiʔa");
    });

    /** Markup renders to the text it stands for; the tag is never spoken (core/markup.ts). */
    test("HTML tags and entities are rendered, not read", () => {
        expect(phonemize("20 km<sup>2</sup>", "vi")).not.toMatch(/sup/u); // was spoken as "sup … sup"
        expect(phonemize("<i>teks</i> ini", "id")).toBe(phonemize("teks ini", "id"));
        expect(phonemize("&#65;&#x42;C", "en")).toBe(phonemize("ABC", "en")); // numeric references
        // Ordinary prose must survive: a comparison is not a tag, and an escaped tag stays literal text.
        expect(phonemize("5 < 6 and a < b", "en")).toContain("sˈɪks");
        expect(phonemize("&lt;i&gt; is a tag", "en")).toContain("tʰˈæɡ");
    });

    /** Personal initials — claimed by contiguity, which is what makes a lone one safe to leave. */
    test("initials are spelled, and the abbreviation dot is not a pause", () => {
        expect(phonemize("George W. Bush", "es")).toContain("dˈoβle ˈuβe"); // was the raw letter "w ."
        expect(phonemize("George W. Bush", "de")).toContain("veː");         // was "f ."
        expect(phonemize("J. R. R. Tolkien", "en")).not.toContain(" . ");
        expect(phonemize("J. S. Bach", "de")).toContain("jɔt ɛs");          // was "J Seite Bach"
        // …but a real abbreviation still expands, and a sentence-final capital stays a sentence end.
        expect(phonemize("Band 3, S. 42", "de")).toContain("zˈaɪ̯tə");
        expect(phonemize("Die Note ist A. Der Rest folgt", "de")).toContain(" . ");
    });

    /** Rate and exponent units, lifted into the shared tier (#562). */
    test("rate units compose, and exponents take the language's position", () => {
        expect(phonemize("120 km/h", "ca")).toContain("pəɾ ˈɔɾə");   // the /h used to be dropped
        expect(phonemize("120 km/h", "sv")).toContain("peːr tˈɪ̀mːɛ"); // the h leaked as a letter
        expect(phonemize("120 km/h", "ru")).toContain("f t͡ɕas");     // was [ˈʊkm] + the ENGLISH letter H
        expect(phonemize("50 km²", "es")).toContain("kwaðɾˈaðos");    // after
        expect(phonemize("50 km²", "ru")).toContain("kvɐdrˈatnɨx kʲɪɫɐmʲˈetrəf"); // before, SPACED
        expect(phonemize("50 km²", "sv")).toContain("kvadrˈɑ̀ːtkiːlɔmˌeːtɛr");     // compound, one word
    });

    /**
     * A TOKEN letter class written as a RAW UNICODE BLOCK RANGE swallows that script's own punctuation,
     * because the alternation tries the letter branch first. Reported by the Greek run for U+0387 ANO
     * TELEIA; auditing every engine with a raw range found two where the mark was DECLARED in
     * clausePunctuation and so provably unreachable — and in both it is the primary sentence terminator.
     */
    test("a script's own sentence marks reach the clause path", () => {
        expect(phonemize("မြန်မာ။ မြန်မာ", "my")).toContain(" . "); // U+104B, ends every Burmese sentence
        expect(phonemize("မြန်မာ၊ မြန်မာ", "my")).toContain(" , "); // U+104A, the phrase mark
        expect(phonemize("ភាសា។ ភាសា", "km")).toContain(" . ");   // U+17D4 khan
        expect(phonemize("ភាសា៕ ភាសា", "km")).toContain(" . ");   // U+17D5 bariyoosan
    });

    test("the full-width percent sign reaches the shared tier", () => {
        expect(phonemize("80％", "ja")).toBe(phonemize("80%", "ja")); // U+FF05, ordinary CJK typography
    });

    /**
     * A DECIMAL governs the GENITIVE SINGULAR in Slavic. Whether that is already expressible depends on
     * the language: Russian and Czech put the genitive singular in the 2–4 slot, so they were right by
     * coincidence, while Ukrainian and Polish put the NOMINATIVE PLURAL there and had no slot for it.
     * `CountForms` is a plain string[] and `pick` clamps, so the fix is a fourth entry in those two
     * languages' tables — local data, not a schema change. Measured: 57 decimal+counted-noun instances
     * across nine Slavic corpora, so this was wrong on every one of them in the affected languages.
     */
    test("a Slavic decimal takes the genitive singular", () => {
        expect(phonemize("2,4%", "uk")).toContain("ʋʲidsɔtka");   // was відсотки, nom. pl.
        expect(phonemize("2,4%", "pl")).toContain("prɔt͡sˈɛnta"); // was procent, gen. pl.
        // …and the languages that were already right must not move.
        expect(phonemize("2,4%", "ru")).toContain("prɐt͡sˈɛntə");
        // Integer agreement is untouched in all of them.
        expect(phonemize("2%", "uk")).toContain("ʋʲidsɔtkɪ");
        expect(phonemize("5%", "uk")).toContain("ʋʲidsɔtʲkʲiu̯");
        // A MAGNITUDE still takes the genitive plural. Adding a fourth form broke this once, because
        // `withMagnitude` took the last entry and "last" stopped meaning "most plural".
        expect(phonemize("$5 milionów", "pl")).toContain("dɔlˈaruf");
        expect(phonemize("$5 миллионов", "ru")).toContain("dˈoɫːərəf");
    });

    /**
     * The Indic composer's 21-99 fallback and its bare magnitudes, both reported by the Telugu run after
     * it fixed the same two defects in its own private composer and then measured its relatives.
     */
    test("Dravidian reads tens-then-unit, and a bare hundred has no 'one'", () => {
        expect(phonemize("21", "kn")).toBe("ˈipːat̪ːu ˈõn̪d̪u"); // was "one twenty"
        expect(phonemize("21", "ml")).toBe("ˈiɾubat̪ɨ ˈonːɨ");
        expect(phonemize("100", "kn")).toBe("nˈuːɾu");   // was "one hundred"
        expect(phonemize("1000", "ml")).toBe("ˈaːjiɾam");
        // Both flags are OPT-IN: the Hindi-belt languages genuinely say "ek sau" and must not move.
        expect(phonemize("100", "hi")).toContain("ˈeːk");
        expect(phonemize("21", "hi")).toBe("ɪkːˈiːs"); // its own compound map still wins
    });
});
