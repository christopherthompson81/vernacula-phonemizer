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
        expect(phonemize("50 km²", "tr")).toContain("ciɫometɾekaɾˈe");            // suffix, one word
    });

    /**
     * THE FOURTH POSITION, and the two things the exponent branch was missing that the plain branch had.
     *
     * `suffix` is `compound` mirrored. Turkish's own corpus writes `783.562 kilometrekare` and
     * `120-160 metreküp` — the measure word welded onto the END — and none of the other three values can
     * spell that: `after` gives *kilometre kare*, `compound` gives *karekilometre*, `before` the same
     * spaced. It is the same omission `before`/`compound` were before they were split apart, arriving on
     * the other side.
     */
    test("the exponent measure word can suffix, differ per power, and follow unitPrefix (#586)", () => {
        const suffix = makeSymbolNormalizer({
            percent: ["yüzde"],
            units: { km: ["kilometre"], m: ["metre"] },
            exponentWords: { squared: ["kare"], cubed: ["küp"], position: "suffix" },
        });
        expect(suffix("783.562 km²")).toBe("783.562 kilometrekare");
        expect(suffix("120 m³")).toBe("120 metreküp");

        // PER-POWER POSITION. Amharic borrowed its two readings from different directions and its corpus
        // writes them on opposite sides — `783,562 ስኩዌር ኪ.ሜ.` but `120-160 ሜትር ኪዩብ`. One value per language
        // had to be wrong about one of them.
        const mixed = makeSymbolNormalizer({
            percent: ["ፐርሰንት"],
            units: { km: ["ኪሎ ሜትር"], m: ["ሜትር"] },
            exponentWords: { squared: ["ስኩዌር"], cubed: ["ኪዩብ"], position: { squared: "before", cubed: "after" } },
        });
        expect(mixed("5 km²")).toBe("5 ስኩዌር ኪሎ ሜትር");
        expect(mixed("5 m³")).toBe("5 ሜትር ኪዩብ");

        // `unitPrefix` GOVERNS THE EXPONENT READING TOO, and the exponent branch was the only one of the
        // three that ignored it — so a head-first language read `5 km²` in the fleet's word order instead
        // of its own. Oromo writes the noun phrase, then the number: `iskuweer kiloometiiri 783,562`.
        const prefixed = makeSymbolNormalizer({
            percent: ["parsantii"],
            units: { km: ["kiiloomeetira"] },
            unitPrefix: true,
            exponentWords: { squared: ["iskuweer"], position: "before" },
        });
        expect(prefixed("783 km²")).toBe("iskuweer kiiloomeetira 783");
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

/**
 * #584 — five languages that had been through the #562 pass read `%` correctly and dropped CURRENCY signs
 * SILENTLY: the sign contributed nothing and `$5` was byte-identical to `5`, so nothing downstream marked the
 * loss. The cause was the gate, not an oversight: each language got the symbol coverage its own corpus
 * exercised, and all five corpora contain ZERO `$` against 18–54 `%`.
 *
 * Every word below is attested IN ITS OWN CORPUS, spelled out next to a numeral even though the sign never
 * appears there. Two of the sourcing traps fired and are recorded at the declarations: Serbian `фунти` ×12 is
 * the WEIGHT pound ("200 фунти (90 кг)"), and `евр` returns 27 hits of Европа to one of евра.
 */
describe("currency signs were dropped silently in five languages (#584)", () => {
    test("each of the five now says its own currency word", () => {
        expect(phonemize("$5", "fa")).toBe("pˈand͡ʒ dolˈaːɾ");        // دلار ×18
        expect(phonemize("$5", "hu")).toBe("ˈøt ˈdolːaːr");            // dollár ×6
        expect(phonemize("$5", "sr")).toBe("pet dolara");              // долара ×17
        expect(phonemize("$5", "th")).toBe("hˈaː˥˩ dˈɔ˧nlaː˥˩");      // ดอลลาร์ ×28
        expect(phonemize("$5", "yue")).toBe("ŋ̩˩˧ mei˩˧ jyːn˨˩");     // 美元 ×8
    });

    test("the sign is no longer a no-op, and the percent it never broke still reads", () => {
        for (const l of ["fa", "hu", "sr", "th", "yue"]) {
            expect(phonemize("$5", l)).not.toBe(phonemize("5", l));
            expect(phonemize("50%", l)).not.toBe(phonemize("50", l));
        }
    });

    test("Serbian selects its count form, as its unit table does", () => {
        expect(phonemize("$1", "sr")).toBe("jedan dolar");    // nominative singular
        expect(phonemize("$3", "sr")).toBe("tri dolara");     // paucal
        expect(phonemize("$5", "sr")).toBe("pet dolara");     // genitive plural
    });

    test("Thai and Cantonese need `unspacedScript`, or the ordinary case drops", () => {
        // A sign in an unspaced script is normally flanked by native letters, which the tier's
        // letter-boundary guard rejected — the punctuation-adjacent form worked and the ordinary one did not.
        expect(phonemize("$5ของ", "th")).toContain("dˈɔ˧nlaː˥˩");
        expect(phonemize("$500的", "yue")).toContain("mei˩˧ jyːn˨˩");
    });
});

/**
 * #586 — an UNDECLARED measure word used to abandon the whole unit match, so `5 km²` lost the unit as well as
 * the power and the abbreviation reached the phoneme sink verbatim. Measured across the 66 languages with an
 * artifact: 21 read a raw `km` in the IPA while `5 km` read correctly in every one of them. No gate said a word,
 * because deleting the `²` changes the unit token and the drop test cannot isolate it (see review.ts's header).
 */
describe("an undeclared exponent word must not cost the unit too (#586)", () => {
    test("the unit still reads, and the exponent is handed back to be seen", () => {
        const n = makeSymbolNormalizer({ percent: ["pct"], units: { km: ["kilometre"] } });
        expect(n("5 km²")).toBe("5 kilometre²"); // was "5 km²", wholly untouched
        expect(n("5 km")).toBe("5 kilometre");   // unchanged
    });

    test("…and a declared word still wins, in each position", () => {
        const mk = (position: "before" | "after" | "compound") => makeSymbolNormalizer({
            percent: ["pct"], units: { km: ["kilometre"] },
            exponentWords: { squared: ["square"], position },
        });
        expect(mk("before")("5 km²")).toBe("5 square kilometre");
        expect(mk("after")("5 km²")).toBe("5 kilometre square");
        expect(mk("compound")("5 km²")).toBe("5 squarekilometre");
    });

    // The two languages whose measure word this run sourced from their own corpora.
    test("de fuses it on the front, cy puts it after with a space", () => {
        expect(phonemize("5 km²", "de")).toBe("fʏnf kvadʁˈaːtkilomeːtɐ");   // Quadratkilometer ×2 in corpus
        // `cilomedr`, the corpus's spelling — and its own squared phrase is `cilomedr sgwâr` ×10, so the
        // head noun and the measure word come from one attested collocation (was `cilometr`, an audible
        // [t] for [d], since Welsh /t/ and /d/ are distinct phonemes).
        expect(phonemize("5 km²", "cy")).toBe("pˈɨmp kilˈɔmɛdr sɡwˈaːr");    // "cilomedr sgwâr" ×10
        expect(phonemize("5 m³", "cy")).toBe("pˈɨmp mˈɛtr kˈɪᵘbiɡ");        // ciwbig ×3
        // …and the magnitude still hops in front of it.
        expect(phonemize("2,2 Millionen km²", "de")).toContain("kvadʁˈaːtkilomeːtɐ");
    });
});

/**
 * #586 — nine treated languages declared NO unit words, so `5 km` leaked the abbreviation into the IPA
 * (*bˈes ˈʊkm*, *hˈaː˥˩ ˈʊkm*, *tˈɑnɔ kˈm̩*). The words were sourced by inverting the search: name the concept
 * to Wikidata (`tools/normalization/concept.ts`), then verify the candidate in the language's OWN corpus.
 * Fleet effect: raw `km` in the IPA 21 → 4, and the four remaining are three languages with no symbol tier at
 * all (bg, ckb, fa) plus untreated mi.
 */
describe("unit words for the languages that had none (#586)", () => {
    test("each reads its own unit instead of leaking the abbreviation", () => {
        expect(phonemize("5 km", "kk")).toBe("bˈes kəjlomˈetr");            // Latin key was missing, not the word
        expect(phonemize("5 km", "pa")).toBe("pˈə̃ɲd͡ʒ kɪloːmˈiːʈəɾ");      // ਕਿਲੋਮੀਟਰ ×31
        expect(phonemize("5 km", "th")).toBe("hˈaː˥˩ kˈi˨˩loː˧mˌeː˦˥t");    // กิโลเมตร ×25
        expect(phonemize("5 km", "yue")).toBe("ŋ̩˩˧ kʊŋ˥ lei˩˧");           // 公里 ×50, the HK form
        expect(phonemize("5 m", "am")).toBe("amɨst metɨɾ");                  // ሜትር ×15
    });

    test("Swahili puts the measure noun FIRST, including in a rate", () => {
        // 82 unit-before to 0 unit-after across sw_ke's attested unit words, which is why `unitPrefix` exists.
        expect(phonemize("5 km", "sw")).toBe("kilɔmˈitɑ tˈɑnɔ");
        // And the rate hinges on the same head noun, which the first version of `unitPrefix` forgot — the
        // corpus's `160 Km/h` (capital K) then read the unit and stranded the `/h` as a bare *h*.
        expect(phonemize("160 Km/h", "sw")).toBe("kilɔmˈitɑ mˈiɑ mˈɔʄɑ nˈɑ sitˈini kʷˈɑ sˈɑː");
        expect(phonemize("10 m/s", "sw")).toBe("mˈitɑ kˈumi kʷˈɑ sɛkˈuⁿdɛ");
        // …and a language that emits the unit after is untouched by the flag.
        expect(phonemize("120 km/h", "de")).toBe("ˈaɪ̯nhʊndɐtt͡svant͡sɪç kilomˈeːtɐ pʁoː ʃtˈʊndə");
    });

    test("yue declares no `m`, deliberately", () => {
        // 米 substring-matches ×36 in an unspaced script and the first example is 米勒 — "Miller". A
        // one-character unit cannot be separated from a name containing it, so declaring it would read every
        // such name as a measurement.
        expect(phonemize("米勒", "yue")).not.toContain("mˈiː");
    });
});

/**
 * #586 — the three languages with no symbol tier. Their local layers already handled units in the NATIVE
 * script (bg) or not at all (ckb, fa), and each needed a different answer. The measurement that decided it was
 * "how often does this abbreviation follow a NUMERAL", not "how often does it occur".
 */
describe("unit abbreviations in the tier-less languages (#586)", () => {
    test("bg: the Latin aliases its corpus also writes", () => {
        // bg_bg writes Cyrillic км ×50 — which already read — AND Latin mm ×12 / cm ×2, which did not:
        // "Стандартният 35 mm филм (негатив 36 на 24 mm)".
        expect(phonemize("35 mm", "bg")).toBe("trijsɛt i pɛt milimɛtra");
        expect(phonemize("69 cm", "bg")).toBe("ʃɛjsɛt i dɛvɛt santimɛtra");
        expect(phonemize("50 km", "bg")).toBe("pɛdɛsɛt kiɫɔmɛtra");
        expect(phonemize("50 км", "bg")).toBe("pɛdɛsɛt kiɫɔmɛtra"); // Cyrillic unchanged
        // The exponent had to move with the unit: once `km` substituted alone, `50 km2` read
        // "километра ДВЕ" — the unit right and the power spoken as a bare numeral.
        expect(phonemize("50 km2", "bg")).toBe("pɛdɛsɛt kvadratni kiɫɔmɛtra");
        expect(phonemize("50 км2", "bg")).toBe("pɛdɛsɛt kvadratni kiɫɔmɛtra");
    });

    test("ckb: its own native abbreviations, guarded by a preceding numeral", () => {
        // ckb_iq writes کم ×30 and سم ×2, every one after a numeral.
        expect(phonemize("12.8 کم", "ckb")).toBe("dwaːnza xaːɫ haʃt kiːloːmatɾ");
        expect(phonemize("6 سم", "ckb")).toBe("ʃaʃ saːntiːmatɾ");
        // The exponent needs no rule: the corpus already writes it as the WORD دووجا after the unit.
        expect(phonemize("19500 کم دووجا", "ckb")).toContain("kiːloːmatɾ duːd͡ʒaː");
    });

    test("fa: the SAME graphemes are ordinary words, so nothing is declared", () => {
        // The guard above is load-bearing, not a nicety. In fa_ir `کم` occurs 63 times and NEVER after a
        // numeral — it is the adjective "little/few" — and `سم` ×5 is "poison". An unguarded table copied
        // from ckb would read 68 ordinary Persian words as measurements.
        expect(phonemize("اصطکاک کم است", "fa")).toBe("ʔasatkˈaːk kˈam ʔˈast");
        expect(phonemize("غلظت بالای سم", "fa")).toBe("ɣˈalzt baːlˈaːj sˈam");
    });
});

/**
 * #586 — ℃ (U+2103) is one code point meaning exactly what `°C` means, and 52 of the 65 languages with an
 * artifact read `°C` correctly while dropping `℃` — losing the whole unit, not just the sign. So it is folded
 * for every language at the registry's single dispatch point, beside the native-digit fold.
 *
 * NOT NFKC: counted over the corpora, blanket compatibility folding would turn `²` into `2` in 46 of them
 * (erasing every exponent reading), `…` into three clause breaks in 18, and recompose nukta letters in five
 * Indic scripts. And № is deliberately excluded — NFKC gives "No", where Bulgarian (21 instances) says номер.
 */
describe("℃ is folded fleet-wide, and the guards it exposed (#586)", () => {
    test("the fold reaches languages that never wrote a ℃ arm", () => {
        for (const l of ["de", "fr", "es", "ru", "tr", "sw"]) {
            expect(phonemize("20℃", l)).toBe(phonemize("20 °C", l));
            expect(phonemize("20℃", l)).not.toBe(phonemize("20", l)); // and it is no longer a no-op
        }
    });

    test("…and the 13 that DID write one are unaffected, because folding is idempotent", () => {
        for (const l of ["bg", "cmn", "hi", "is", "my"]) {
            expect(phonemize("20℃", l)).toBe(phonemize("20 °C", l));
        }
    });

    // The fold surfaced a pre-existing guard defect in three unspaced-script languages: `(?![\p{L}])` after
    // the scale letter rejects a following kana / Hangul particle / Han character, which in those scripts is
    // the ORDINARY case. It reproduces with `20 °Cを` too, so the fold did not cause it.
    test("the scale letter's guard must reject a LATIN letter, not any letter", () => {
        expect(phonemize("20℃を", "ja")).toBe("nid͡ʑɯᵝːdo̞o̞");            // was "20度 シー を"
        expect(phonemize("20℃에", "ko")).toBe("sˈɘp̚s͈i isˈip̚t͈oe");      // was "20도씨에", losing 섭씨
        expect(phonemize("32℃에 달하는", "ko")).toContain("sˈɘp̚s͈i");      // ko_kr's own sentence, ×3
    });

    test("yue had no degree rule at all; its corpus supplies both words AND the order", () => {
        // 攝氏 ×2 "氣溫經常超過攝氏 30 度" · 華氏 ×2 "在華氏 90 度的高溫中" — the scale name precedes the
        // number and 度 follows, so the reading wraps around the numeral and the shared tier cannot express it.
        expect(phonemize("20℃", "yue")).toBe("siːp̚˧ siː˨ jiː˨ sɐp̚˨ tou˨");   // 攝氏二十度
        expect(phonemize("90 °F", "yue")).toBe("waː˨˩ siː˨ kɐu˧˥ sɐp̚˨ tou˨"); // 華氏九十度
        expect(phonemize("45°", "yue")).toBe("sei˧ sɐp̚˨ ŋ̩˩˧ tou˨");           // 四十五度
        // …and it agrees with the corpus's own spelled-out form, which is the check that matters.
        expect(phonemize("20℃", "yue")).toBe(phonemize("攝氏 20 度", "yue"));
    });

    /**
     * DOUBLE-ENCODED UTF-8, repaired at the registry's single dispatch point. id_id carries it upstream —
     * FLEURS itself, not our mining — and the injected `Â`/`Ã` are LETTERS, so every downstream guard
     * misfired: the tier's trailing guard refused the unit match and `km` reached the IPA raw.
     * Measured safe across all 67 corpora: the signature (`Â`/`Ã` + a UTF-8 continuation byte) occurs 31
     * times, every one in id_id and zero elsewhere. Closed RAWMARK 2→0 and DROP 25→16 in that language.
     */
    test("double-encoded UTF-8 is repaired before anything reads a character (#586)", () => {
        // C2 XX: the code point EQUALS the trailing byte, so the `Â` is simply dropped.
        expect(phonemize("19.500 km\u00c2\u00b2 dan", "id")).toContain("kilomətˈər pərsəɡˈi");
        expect(phonemize("19.500 km\u00c2\u00b2 dan", "id")).toBe(phonemize("19.500 km² dan", "id"));
        // C3 XX: the code point is the trailing byte plus 0x40 — `Ã±` → `ñ`, `Ã¶` → `ö`.
        expect(phonemize("Las Ca\u00c3\u00b1itas", "id")).toBe(phonemize("Las Cañitas", "id"));
        expect(phonemize("Kl\u00c3\u00b6cker", "id")).toBe(phonemize("Klöcker", "id"));
        // …and it is INERT on text that merely contains those letters without a continuation byte.
        expect(phonemize("Âge", "fr")).toBe(phonemize("Âge", "fr"));
        expect(phonemize("5 km²", "de")).toBe("fʏnf kvadʁˈaːtkilomeːtɐ");
    });

    /**
     * `802.11g` READ AS "ELEVEN GRAMS" — in English, on a string present in 46 of the 67 corpora.
     *
     * This is the defect the shared tier's `NOT_VERSION` exists to stop (its note records `802.11g` reading as
     * "802.11 grams" in ten languages) — and en/ro never got it, because neither uses the tier. Their own unit
     * rules had no version guard: en's number group accepts a fraction, and ro's are bare `\b`-bounded word
     * replacements with no number context at all.
     *
     * THE STANDARD IS NAMED, not left to the general heuristic: 802.11's amendment suffixes are now TWO
     * letters (ac, ax, ah, be, bn), and `802.11ah` — Wi-Fi HaLow — collides with `Ah`, ampere-hours.
     */
    test("a networking standard is not a quantity (#586)", () => {
        expect(phonemize("802.11g", "en")).not.toContain("ɡɹˈæmz");
        expect(phonemize("802.11g", "ro")).not.toContain("ɡrame");
        expect(phonemize("802.11ah", "en")).not.toContain("ˈaᶷɚ"); // ampere-HOURS
        expect(phonemize("802.11ac", "ro")).not.toContain("ˈgrame");
        // …and a genuine quantity is untouched, spaced or comma-grouped.
        expect(phonemize("5 g", "en")).toContain("ɡɹˈæmz");
        expect(phonemize("100.5 m", "en")).toContain("mˈiːt̬ɚz");
        expect(phonemize("19,500 km", "en")).toContain("kəlˈɑːmʌt̬ɚz");
        expect(phonemize("5 g", "ro")).toContain("ɡrame");
        expect(phonemize("5 mm", "ro")).toContain("milimeˈtri");
    });

    /**
     * `&` HAD NO TIER CELL AT ALL, so 16 languages dropped it — always in the same two corpus sentences,
     * `B&B` and `Arts & Sciences`. Every one has a high-frequency conjunction to spend (und ×1135, dan ×1053,
     * og ×1135, и ×1129, және ×561), so this was a missing cell rather than a sourcing problem.
     * SPACED on both sides: `B&B` is two initialisms and pl writes `bed&breakfast` glued, so substituting
     * without spaces would fuse them into one token — the merge defect review.ts's own probe once had.
     */
    test("the ampersand is a tier cell, spaced on both sides (#586)", () => {
        const n = makeSymbolNormalizer({ percent: ["percent"], ampersand: "and" });
        expect(n("B&B")).toBe("B and B");            // three tokens, never one
        expect(n("bed&breakfast")).toBe("bed and breakfast");
        expect(n("Arts &amp; Sciences")).toBe("Arts and Sciences"); // the entity folds first
        expect(n("A & B")).toBe("A and B");
        // A language that declares none is untouched — the enclitic case (ml joins nouns with -ഉം).
        expect(makeSymbolNormalizer({ percent: ["percent"] })("B&B")).toBe("B&B");
    });
});
