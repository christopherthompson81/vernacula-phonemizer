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

    // A MAGNITUDE MAY SIT BETWEEN THE NUMBER AND A UNIT too, not just a currency sign. Without it the
    // number is not adjacent to the unit, the match fails, and the unit reaches the IPA as RAW LETTERS —
    // `2,2 Millioune km²` read `km` plus a stranded "2". Seven corpus utterances across af/az/nl/el/lb/mk/ta,
    // all the same FLEURS sentence; six languages shipped the defect (#604).
    test("a unit hops the magnitude too, and the magnitude governs the count", () => {
        const n = makeSymbolNormalizer({
            percent: ["percent"],
            units: { km: ["kilometre", "kilometres"] },
            magnitudes: ["million"],
            exponentWords: { squared: ["square"], position: "before" },
        });
        expect(n("2.2 million km2")).toBe("2.2 million square kilometres");
        expect(n("5 million km")).toBe("5 million kilometres");
        // A magnitude counts as MANY, so the plural is selected even when the numeral itself is 1.
        expect(n("1 million km")).toBe("1 million kilometres");
        expect(n("1 km")).toBe("1 kilometre"); // …and a bare 1 still takes the singular
        expect(n("5 km")).toBe("5 kilometres");
        // A magnitude the language did not declare is not a magnitude: leave the text alone rather than
        // silently swallow the word between.
        expect(n("2 zillion km")).toBe("2 zillion km");
    });

    // A SPACE BEFORE THE MAGNITUDE IS NOT UNIVERSAL. Chinese and Japanese are written without spaces, so
    // `1350亿m³` is the ordinary form; with the separator as `\s+` the number was not adjacent to the
    // magnitude and `m³` reached the IPA as the English letter name (*ˈɛm*) — the same failure the spaced
    // case had. The magnitude is re-emitted verbatim, so it keeps its space when it has one and none when it
    // does not. Measured over all 66 FLEURS corpora: no corpus reading changes, so this is robustness.
    // #586, found by the zh.wikipedia fill. The boundary guards assume spaces between words, so in Chinese and
    // Japanese — where a unit or sign is normally flanked by Han/kana — they rejected the ORDINARY case and
    // only punctuation-adjacent instances worked.
    test("unspacedScript: a Han neighbour is a boundary, not token-continuation", () => {
        const n = makeSymbolNormalizer({
            percent: ["百分之"], percentPrefix: true,
            currency: { $: ["美元"] },
            units: { km: ["公里"], "℃": ["摄氏度"] },
            exponentWords: { squared: ["平方"], position: "compound" },
            unspacedScript: true,
        });
        expect(n("38℃很热")).toBe("38 摄氏度很热"); // was: the ℃ dropped
        expect(n("為$500，")).toBe("為500 美元，"); // was: the $ dropped
        expect(n("50 km²的面积")).toBe("50 平方公里的面积"); // was: the exponent dropped
        // …and the guard still does its job against a LATIN neighbour, which can continue the key.
        expect(n("50 kmx")).toBe("50 kmx");
    });

    // A DOTTED DESIGNATION IS NOT A QUANTITY. `802.11g` read as "802.11 grams" in ten languages, because the
    // one-letter unit key matched the version suffix. Measured over all 66 corpora: 444 dotted-version
    // instances against 4 decimals glued to a one-letter unit (and those are period thousands separators).
    test("a dotted version is not a unit (#586)", () => {
        const n = makeSymbolNormalizer({ percent: ["pct"], units: { g: ["gram"], km: ["km-word"], m: ["metre"] } });
        expect(n("802.11g")).toBe("802.11g"); // was "802.11 gram"
        expect(n("802.11n")).toBe("802.11n");
        // The narrowness is the point — all of these still read:
        expect(n("12.5 g")).toBe("12.5 gram"); // not glued
        expect(n("12.5km")).toBe("12.5 km-word"); // two-letter key
        expect(n("1,000 km")).toBe("1,000 km-word");
        expect(n("3,5 m")).toBe("3,5 metre");
        // The measured cost: a decimal GLUED to a one-letter unit is no longer read. 4 corpus instances.
        expect(n("4.892m")).toBe("4.892m");
    });

    test("an unspaced magnitude still hops, and keeps its own spacing", () => {
        const n = makeSymbolNormalizer({
            percent: ["百分之"],
            percentPrefix: true,
            units: { m: ["米"], km: ["公里"] },
            magnitudes: ["万", "亿"],
            exponentWords: { squared: ["平方"], cubed: ["立方"], position: "compound" },
        });
        // The space before the measure word is the tier's uniform `quantity word` shape, not a defect: the
        // magnitude keeps whatever spacing it was written with, and the Han run splits on the space with both
        // halves reading correctly (立方米 → li˥˩ fɑŋ˥˥ mi˨˩˦, verified through the cmn phonemizer).
        expect(n("1350亿m³")).toBe("1350亿 立方米");
        expect(n("5万km²")).toBe("5万 平方公里");
        expect(n("1350 亿 m³")).toBe("1350 亿 立方米"); // the spaced form still works
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
        // kn and ml have since moved OFF this composer entirely (#562): both fuse 21-99 into one word
        // and have suppletive hundreds, neither of which `indicNumberWords` can express, so both now
        // compose through the SHARED Dravidian composer in core/numbers.ts. The assertions are kept
        // because the READING they pin — tens-then-unit, and a bare magnitude with no "one" — is still
        // the thing under test; the ml one was asserting the two-word defect and is corrected here.
        expect(phonemize("21", "kn")).toBe("ˈipːat̪ːõn̪d̪u"); // was "one twenty", then two words
        expect(phonemize("21", "ml")).toBe("ˈiɾubat̪ːijonːɨ"); // was ˈiɾubat̪ɨ ˈonːɨ, two words
        expect(phonemize("100", "kn")).toBe("nˈuːɾu");   // was "one hundred"
        expect(phonemize("1000", "ml")).toBe("ˈaːjiɾam");
        // …and lakh/crore too. The flag applied to hundred and thousand ONLY when first added, so a
        // language declaring it still read "one lakh" while correctly saying a bare hundred. Reported
        // independently by the Punjabi and Kannada runs, both from reading the code.
        expect(phonemize("100000", "ml")).toBe("lˈakʂam");
        expect(phonemize("10000000", "ml")).toBe("kˈoːɖi");
        // Both flags are OPT-IN: the Hindi-belt languages genuinely say "ek sau" and must not move.
        expect(phonemize("100", "hi")).toContain("ˈeːk");
        expect(phonemize("21", "hi")).toBe("ɪkːˈiːs"); // its own compound map still wins
    });

    /**
     * A numeral written in the language's OWN digits must read the same as its ASCII spelling. Auditing 21
     * scripts found six engines returning an EMPTY STRING — total, silent content loss — because the number
     * token is `\d+`, which JavaScript defines as ASCII-only, so the numeral matched no token at all and
     * assembleClauses dropped what the tokenizer declined.
     */
    test("native digits read the same as ASCII", () => {
        for (const [lang, native] of [
            ["pa", "੫੦"], ["ta", "௫௦"], ["te", "౫౦"], ["ml", "൫൦"], ["si", "෫෦"], ["lo", "໕໐"],
        ] as [string, string][]) {
            expect(phonemize(native, lang), lang).not.toBe("");
            expect(phonemize(native, lang), lang).toBe(phonemize("50", lang));
        }
        // …and the fifteen that already worked must not move.
        for (const [lang, native] of [
            ["hi", "५०"], ["bn", "৫০"], ["kn", "೫೦"], ["th", "๕๐"], ["my", "၅၀"], ["ar", "٥٠"],
        ] as [string, string][]) {
            expect(phonemize(native, lang), lang).toBe(phonemize("50", lang));
        }
    });

    /** `currencyPrefix`, the counterpart to `percentPrefix`, reported missing by the Swahili run. */
    test("a prefix-currency language emits the noun before the number", () => {
        expect(phonemize("$30", "sw")).toBe("ɗˈɔlɑ θɛlɑθˈini");   // dola thelathini
        expect(phonemize("KSh 500", "sw")).toBe("ʃilˈiᵑɡi mˈiɑ tˈɑnɔ");
        // …and the postfix languages must not move.
        expect(phonemize("$5", "fr")).toContain("sɛ̃k dɔlˈaʁ");
    });

    /**
     * A currency noun the TEXT already spells out must not be said twice. Reported by the Nepali run,
     * whose corpus writes `$1000 डलर`. The magnitude connective may sit between, so "…millones de
     * dólares" counts as already said.
     */
    test("a written-out currency noun is not doubled", () => {
        expect(phonemize("$1000 डलर", "ne")).toBe(phonemize("$1000", "ne"));
        expect(phonemize("$45 dólares", "es")).toBe(phonemize("$45", "es"));
        expect(phonemize("$5 millones de dólares", "es")).toBe(phonemize("$5 millones", "es"));
        expect(phonemize("$5 millions de dollars", "fr")).toBe(phonemize("$5 millions", "fr"));
    });

    /**
     * A LETTER-CODE currency prefix is not a core limitation, though one run reported it as one: `$`
     * alone cannot match after a letter (the tier's lookbehind), and declaring the compound key is the
     * intended fix. Recorded because two runs disagreed about it.
     */
    test("a compound currency key matches a letter-code prefix", () => {
        expect(phonemize("US$30", "gu")).not.toContain("30");
    });

    /** The percent word is suppressed on whichever side the language puts it (#562). */
    test("a written-out percent word is not doubled", () => {
        expect(phonemize("93% ശതമാനം", "ml")).toBe(phonemize("93%", "ml"));   // suffix, Malayalam
        expect(phonemize("yüzde 40%", "tr")).toBe(phonemize("40%", "tr"));     // prefix, Turkish
    });
});
