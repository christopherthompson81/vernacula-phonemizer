import { describe, expect, test } from "vitest";

import { makeSymbolNormalizer, slavicCountForm } from "../src/core/normalizeSymbols.ts";
import { numberToWords as cyNum } from "../src/languages/welsh/numbers.ts";
import { numberToWords as omNum } from "../src/languages/oromo/numbers.ts";
import { phonemize } from "../src/index.ts";

// beyond English: the shared symbol layer (%, currency, units — per-language DATA over one engine,
// with real count agreement), the French roman-numeral rules, and the Welsh + Oromo number compositors.
describe("shared symbol normalizer (core)", () => {
    // ⚠ UNITS ARE CASE-SENSITIVE, AND AN UPPERCASE KEY USED TO THROW (#763). The unit regex is built
    // case-INSENSITIVELY and the match was resolved as `units[u.toLowerCase()]!` — so a key like ⟨V⟩ was
    // unreachable, and the non-null assertion turned that miss into a TypeError from inside pick(), three
    // frames from the config that was wrong. `220 V` crashed the phonemizer outright.
    // Resolution is now EXACT first, folded only for multi-character symbols: case is contrastive exactly
    // where the symbol is one letter (s/S second/siemens, t/T tonne/tesla, a/A are/ampere), and a bare ⟨M⟩
    // is molar or millions or Roman 1000 — never metres.
    test("a unit is resolved case-sensitively, and an unresolvable one is left alone", () => {
        const n = makeSymbolNormalizer({
            percent: ["persent"],
            units: { V: ["volt"], km: ["kilometer"], m: ["meter"], s: ["sekonde"], l: ["liter"], L: ["liter"],
                     MB: ["megagreep"], Mb: ["megabis"] },
            rateDenominators: { h: "uur" },
            unitPer: "per",
        });
        expect(n("220 V")).toBe("220 volt"); // an UPPERCASE key resolves — this used to throw
        // ⚠ SPELLED-OUT FORMS, NOT THE SYMBOL ITSELF. Asserting MB → "5 MB" would pass identically when
        // resolution FAILED and the callback returned the match untouched — a test that cannot fail.
        expect(n("5 MB")).toBe("5 megagreep");
        expect(n("5 Mb")).toBe("5 megabis"); // …and stays distinct from MB
        expect(n("5 KM")).toBe("5 kilometer"); // multi-letter: shouty text still folds
        expect(n("100 km/h")).toBe("100 kilometer per uur");
        // ⚠ A RATE DENOMINATOR FOLDS EVEN AT ONE LETTER — they nearly all are one letter, so refusing left
        // `100 KM/H` resolving NEITHER half and dropping the head unit too. The slash position is what
        // makes it safe: nobody writes kilometres per henry.
        expect(n("100 KM/H")).toBe("100 kilometer per uur");
        // ⚠ ⟨L⟩ and ⟨l⟩ are BOTH the litre — the one-letter rule is about cases that are DIFFERENT units.
        expect(n("2 L")).toBe("2 liter");
        expect(n("2 l")).toBe("2 liter");
        // ⚠ NOT FOLDED, because for a one-letter symbol the other case is a DIFFERENT unit or none:
        expect(n("220 v")).toBe("220 v"); // ⟨v⟩ is not volt
        expect(n("5 M")).toBe("5 M"); // molar / millions / Roman 1000 — never metres
        expect(n("5 S")).toBe("5 S"); // siemens, not seconds
    });

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

    /**
     * A LANGUAGE WITH NO SOURCEABLE PERCENT WORD MUST STILL BE ABLE TO USE THE TIER.
     *
     * `percent` was the one REQUIRED field on `SymbolData` and its arm was unconditional, so Tashelhit —
     * whose units, postposed exponent and invariant `unitPer` all fit the tier — had to hand-write a local
     * table for want of one cell it correctly refuses to invent (13 candidate spellings at ×0; the wiki
     * never spells a numeral out, so the sign's reading is absent from text by construction).
     *
     * ⚠ THE TYPE CANNOT DEFEND THIS, which is why these are tests. `loadManifest<T>` casts, so a missing
     * key type-checks cleanly and reaches the output as the literal six-letter word "undefined" — the
     * hazard this module's own header states. The two halves below are the contract: ABSENT is inert,
     * MALFORMED throws.
     */
    test("percent may be OMITTED — the sign is left visible, not read as an empty or undefined word", () => {
        const n = makeSymbolNormalizer({ units: { km: ["kilumitr"] } });
        // The sign survives verbatim, with no word inserted and no stray space — the DROP/RAWMARK gates
        // can then see it, which is the honest side to fail on.
        expect(n("17,9%")).toBe("17,9%");
        expect(n("40 %")).toBe("40 %");
        expect(n("%40")).toBe("%40"); // the prefix form too
        expect(n("99,854 ٪")).toBe("99,854 ٪"); // and the Arabic-script sign
        // ⚠ THE ASSERTIONS THAT ACTUALLY BITE: neither the literal word nor a stripped sign.
        for (const s of ["17,9%", "%40", "40 %"]) {
            expect(makeSymbolNormalizer({})(s)).not.toMatch(/undefined/u);
            expect(makeSymbolNormalizer({})(s)).toContain("%");
        }
        // …and every OTHER arm still works in the same normalizer, which is the point of converting.
        expect(n("8665 km")).toBe("8665 kilumitr");
    });

    test("a DECLARED percent that arrived empty or undefined THROWS, naming the field", () => {
        // The manifest-shaped hazard, verbatim: `percent: [MANIFEST.symbols.percent]` where the .jsonc has
        // lost the key. Before the check this produced "40 undefined" — a word the phoneme sink cannot
        // distinguish from a real one.
        const missing = { symbols: {} } as unknown as { symbols: { percent: string } };
        expect(() => makeSymbolNormalizer({ percent: [missing.symbols.percent] })).toThrow(/percent/u);
        expect(() => makeSymbolNormalizer({ percent: [] })).toThrow(/percent/u);
        expect(() => makeSymbolNormalizer({ percent: [""] })).toThrow(/percent/u);
        // The same check covers the other CountForms fields, which have the identical failure mode.
        expect(() => makeSymbolNormalizer({ currency: { $: [""] } })).toThrow(/currency\[\$\]/u);
        expect(() => makeSymbolNormalizer({ units: { km: [] } })).toThrow(/units\[km\]/u);
        expect(() => makeSymbolNormalizer({ exponentWords: { squared: [""] } })).toThrow(/exponentWords\.squared/u);
        // ⚠ AND OMISSION IS NOT MALFORMATION — an empty declaration is a bug, no declaration is a decision.
        expect(() => makeSymbolNormalizer({})).not.toThrow();
    });

    // A MAGNITUDE MAY SIT BETWEEN THE NUMBER AND A UNIT too, not just a currency sign. Without it the
    // number is not adjacent to the unit, the match fails, and the unit reaches the IPA as RAW LETTERS —
    // `2,2 Millioune km²` read `km` plus a stranded "2". Seven corpus utterances across af/az/nl/el/lb/mk/ta,
    // all the same FLEURS sentence; six languages shipped the defect.
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
        // A magnitude the language did not declare is not a magnitude: the word between is NOT swallowed and
        // the count does not reach across it — "zillion" survives and the noun stays in its citation form,
        // uncounted. ⚠ The symbol itself is still read: an undeclared word between a number and a unit is a
        // reason not to COUNT the unit, never a reason to leave raw ASCII in the phoneme stream, and the
        // bare-token path (which cannot see the numeral at all) reads it as the standalone symbol it is.
        expect(n("2 zillion km")).toBe("2 zillion kilometre");
    });

    // A SPACE BEFORE THE MAGNITUDE IS NOT UNIVERSAL. Chinese and Japanese are written without spaces, so
    // `1350亿m³` is the ordinary form; with the separator as `\s+` the number was not adjacent to the
    // magnitude and `m³` reached the IPA as the English letter name (*ˈɛm*) — the same failure the spaced
    // case had. The magnitude is re-emitted verbatim, so it keeps its space when it has one and none when it
    // does not. Measured over all 66 FLEURS corpora: no corpus reading changes, so this is robustness.
    // Found by the zh.wikipedia fill. The boundary guards assume spaces between words, so in Chinese and
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
    // one-letter unit key matched the version suffix.
    //
    // ⚠ THE GUARD IS ANCHORED ON THE DESIGNATION, NOT ON ITS SHAPE, and this test pins the difference because
    // the shape version cost more than it bought. Measured by emitting all 161 mined artifacts (45,306
    // readings) with the shape guard and without it: 33 readings differ — 9 are the IEEE designation
    // (ar bn cmn de el es id ja pt) and 24 are genuine measurements it was suppressing, among them ary's
    // eleven airport terminal areas (`28.000m²` read *ˈɛm skwˈɛɹd*, an English letter name inside Moroccan
    // Arabic) and pt's `4.892m`, the height of the Vinson Massif, pinned below.
    test("a dotted designation is not a unit, and a glued decimal still is", () => {
        const n = makeSymbolNormalizer({ percent: ["pct"], units: { g: ["gram"], km: ["km-word"], m: ["metre"] } });
        expect(n("802.11g")).toBe("802.11g"); // was "802.11 gram"
        expect(n("802.11n")).toBe("802.11n");
        expect(n("802,11g")).toBe("802,11g"); // the designation is not localised; the text around it is
        // The narrowness is the point — all of these still read:
        expect(n("12.5 g")).toBe("12.5 gram"); // not glued
        expect(n("12.5km")).toBe("12.5 km-word"); // two-letter key
        expect(n("1,000 km")).toBe("1,000 km-word");
        expect(n("3,5 m")).toBe("3,5 metre");
        // ⚠ THE 24 LINES THE SHAPE GUARD WAS COSTING. A decimal glued to a one-letter unit is a measurement
        // everywhere the corpus can be read, and the designation list is what separates the two.
        expect(n("4.892m")).toBe("4.892 metre");
        expect(n("28.000m")).toBe("28.000 metre");
        // ⚠ AND NOT THE MAGNITUDE CASE, which never depended on this guard: the currency rule runs first and
        // consumes the number, so `m` has no number left to attach to. Probed on en with the shape guard
        // fully removed and unchanged either way — `$1.5m` is a question for the currency path, not this one.
        //
        // ⚠ THAT QUESTION IS NOW ANSWERED, AND THIS LINE USED TO ASSERT THE BUG (playbook trap 5). It read
        // `"1.5 dollarm"` — the currency noun FUSED to the magnitude letter, which the tokenizer then reads as
        // one word. Measured across eleven languages, ten produced a plausible-looking nonsense word that no
        // leak class can see (et *dˈolːɑritm*, de *dˈɔlaɐ̯m*, es *dˈolaɾesm*, …). The tier now emits a
        // boundary when the noun would abut a letter, so the currency still reads and the unread magnitude
        // letter stays VISIBLE to the RAW-LATIN gate instead of hiding inside a word.
        const c = makeSymbolNormalizer({ percent: ["pct"], currency: { $: ["dollar"] }, units: { m: ["metre"] } });
        expect(c("$1.5m")).toBe("1.5 dollar m");
        expect(c("$1.5"), "and nothing is added when nothing follows").toBe("1.5 dollar");
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

    test("digits are read in Oromo, not English", () => {
        expect(phonemize("dhibbentaa 25 ta'a", "om")).toBe("ᶑibːentˈaː diɡdamˈiː ʃˈan tˈaʔa");
    });
});

// Round 3: the FLEURS-priority languages. Data is orthographic — each engine reads its own script,
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
     * The magnitude hop, both defects found by the it/ko/th/tr fan-out.
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

    /** Rate and exponent units, lifted into the shared tier. */
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
    test("the exponent measure word can suffix, differ per power, and follow unitPrefix", () => {
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
        // kn and ml have since moved OFF this composer entirely: both fuse 21-99 into one word
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

    /** The percent word is suppressed on whichever side the language puts it. */
    test("a written-out percent word is not doubled", () => {
        expect(phonemize("93% ശതമാനം", "ml")).toBe(phonemize("93%", "ml"));   // suffix, Malayalam
        expect(phonemize("yüzde 40%", "tr")).toBe(phonemize("40%", "tr"));     // prefix, Turkish
    });
});

/**
 * five languages that had been through the symbol pass read `%` correctly and dropped CURRENCY signs
 * SILENTLY: the sign contributed nothing and `$5` was byte-identical to `5`, so nothing downstream marked the
 * loss. The cause was the gate, not an oversight: each language got the symbol coverage its own corpus
 * exercised, and all five corpora contain ZERO `$` against 18–54 `%`.
 *
 * Every word below is attested IN ITS OWN CORPUS, spelled out next to a numeral even though the sign never
 * appears there. Two of the sourcing traps fired and are recorded at the declarations: Serbian `фунти` ×12 is
 * the WEIGHT pound ("200 фунти (90 кг)"), and `евр` returns 27 hits of Европа to one of евра.
 */
describe("currency signs were dropped silently in five languages", () => {
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
 * an UNDECLARED measure word used to abandon the whole unit match, so `5 km²` lost the unit as well as
 * the power and the abbreviation reached the phoneme sink verbatim. Measured across the 66 languages with an
 * artifact: 21 read a raw `km` in the IPA while `5 km` read correctly in every one of them. No gate said a word,
 * because deleting the `²` changes the unit token and the drop test cannot isolate it (see review.ts's header).
 */
describe("an undeclared exponent word must not cost the unit too", () => {
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
 * nine treated languages declared NO unit words, so `5 km` leaked the abbreviation into the IPA
 * (*bˈes ˈʊkm*, *hˈaː˥˩ ˈʊkm*, *tˈɑnɔ kˈm̩*). The words were sourced by inverting the search: name the concept
 * to Wikidata (`tools/normalization/concept.ts`), then verify the candidate in the language's OWN corpus.
 * Fleet effect: raw `km` in the IPA 21 → 4, and the four remaining are three languages with no symbol tier at
 * all (bg, ckb, fa) plus untreated mi.
 */
describe("unit words for the languages that had none", () => {
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
 * the three languages with no symbol tier. Their local layers already handled units in the NATIVE
 * script (bg) or not at all (ckb, fa), and each needed a different answer. The measurement that decided it was
 * "how often does this abbreviation follow a NUMERAL", not "how often does it occur".
 */
describe("unit abbreviations in the tier-less languages", () => {
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
 * ℃ (U+2103) is one code point meaning exactly what `°C` means, and 52 of the 65 languages with an
 * artifact read `°C` correctly while dropping `℃` — losing the whole unit, not just the sign. So it is folded
 * for every language at the registry's single dispatch point, beside the native-digit fold.
 *
 * NOT NFKC: counted over the corpora, blanket compatibility folding would turn `²` into `2` in 46 of them
 * (erasing every exponent reading), `…` into three clause breaks in 18, and recompose nukta letters in five
 * Indic scripts. And № is deliberately excluded — NFKC gives "No", where Bulgarian (21 instances) says номер.
 */
describe("℃ is folded fleet-wide, and the guards it exposed", () => {
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
    test("double-encoded UTF-8 is repaired before anything reads a character", () => {
        // C2 XX: the code point EQUALS the trailing byte, so the `Â` is simply dropped.
        expect(phonemize("19.500 km\u00c2\u00b2 dan", "id")).toContain("kilomətˈər pərsəɡˈi");
        expect(phonemize("19.500 km\u00c2\u00b2 dan", "id")).toBe(phonemize("19.500 km² dan", "id"));
        // C3 XX: the code point is the trailing byte plus 0x40 — `Ã±` → `ñ`, `Ã¶` → `ö`.
        expect(phonemize("Las Ca\u00c3\u00b1itas", "id")).toBe(phonemize("Las Cañitas", "id"));
        expect(phonemize("Kl\u00c3\u00b6cker", "id")).toBe(phonemize("Klöcker", "id"));
        // THE THREE-BYTE CASE goes through CP1252, not Latin-1: `â€"` is `â + € + "`, because CP1252 maps
        // byte 0x80 to the euro sign and 0x93 to a curly quote. An earlier pass measured this signature as
        // ZERO by searching for the Latin-1 form, which does not occur — the CP1252 form occurs 16 times, all
        // in id_id, and the stray `€` was being counted as a DROPPED CURRENCY.
        expect(phonemize("1000\u00e2\u20ac\u201c1300", "id")).toBe(phonemize("1000\u20131300", "id"));
        expect(phonemize("barbule \u00e2\u20ac\u201d peneliti", "id")).toBe(phonemize("barbule \u2014 peneliti", "id"));
        // …and it is INERT on text that merely contains those letters without a continuation byte.
        expect(phonemize("l\u2019\u00e2me", "fr")).toBe(phonemize("l\u2019\u00e2me", "fr")); // a real â
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
    test("a networking standard is not a quantity", () => {
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
    test("the ampersand is a tier cell, spaced on both sides", () => {
        const n = makeSymbolNormalizer({ percent: ["percent"], ampersand: "and" });
        expect(n("B&B")).toBe("B and B");            // three tokens, never one
        expect(n("bed&breakfast")).toBe("bed and breakfast");
        expect(n("Arts &amp; Sciences")).toBe("Arts and Sciences"); // the entity folds first
        expect(n("A & B")).toBe("A and B");
        // A language that declares none is untouched — the enclitic case (ml joins nouns with -ഉം).
        expect(makeSymbolNormalizer({ percent: ["percent"] })("B&B")).toBe("B&B");
    });

    /**
     * A MAGNITUDE MAY BRING ITS CONNECTIVE, and the text already contains it: `2,2 milions DE km²` puts TWO
     * words between the number and the unit, so the adjacency this tier matches on was broken and the whole
     * quantity failed — the area read as a length. Kept out of the CURRENCY path, where the connective is
     * generated by `join()` rather than present, or a text that already has one would get a second.
     */
    test("a unit hops the magnitude AND its connective", () => {
        expect(phonemize("2,2 milions de km²", "ca")).toContain("kiɫˈɔmətɾəs kwəðɾˈats");
        expect(phonemize("2,2 millones de km²", "es")).toContain("kilˈometɾos kwaðɾˈaðos");
        expect(phonemize("2,2 millions de km²", "fr")).toContain("kilɔmɛtʁ kaʁˈe");
        // The currency hop still emits exactly one connective.
        expect(phonemize("$5 milions", "ca")).toBe("sˈiŋ miɫiˈons də dˈɔɫəɾs");
        expect(phonemize("$5 millones", "es")).toContain("miʎˈones de dˈolaɾes");
    });

    /** French typography spaces the degree sign; the tier reads `°C` through a unit KEY, which needs the two
     *  characters adjacent, so `32 ° C` dropped the unit entirely. Closed up in fr's own layer. */
    test("the spaced degree sign still reads", () => {
        expect(phonemize("une chaleur de 32 ° C", "fr")).toContain("dəɡʁe sɛlsjˈys");
        expect(phonemize("32 ° F", "fr")).toContain("faʁɛnˈajt");
        expect(phonemize("n° 11", "fr")).toContain("nymeʁo");        // not a degree
        expect(phonemize("un angle de 90 °", "fr")).not.toContain("sɛlsjˈys");
    });
});

describe("⚠ the currency mark guard follows unspacedScript (abugida word endings)", () => {
    // The tier rejects a currency sign adjacent to a combining mark, so a sign cannot be read out of the middle
    // of a word. `\p{M}` was appended UNCONDITIONALLY, which is right for Latin — a word-final combining mark is
    // unusual there — and wrong for an abugida, where a dependent vowel is how a word normally ENDS.
    //
    // The symptom was a silent split decision inside one language: Khmer `១លាន$` ("one million dollars") read
    // the sign because លាន ends in a consonant, while `១កោដិ$` ("one koti dollars") dropped it because កោដិ ends
    // in U+17B7. Both spellings are in the corpus; only one worked. Relaxing it is safe because a currency sign
    // is NOT A LETTER and so, unlike a unit abbreviation, cannot be the prefix of a longer word.
    test("a magnitude ending in a combining mark still composes with a postposed sign", () => {
        expect(phonemize("១កោដិ$", "km")).toContain("ɗollaː");   // ends U+17B7 — was dropped
        expect(phonemize("១ពាន់$", "km")).toContain("ɗollaː");   // ends U+17CB — was dropped
        expect(phonemize("១លាន$", "km")).toContain("ɗollaː");    // ends in a consonant — always worked
    });

    test("and the guard still holds for a spaced script, where a mark IS word-internal", () => {
        // The relaxation is conditional on `unspacedScript`, so nothing changes for the languages the guard was
        // written for. Measured before the change: across the five unspacedScript languages' corpora, ZERO
        // currency signs sit adjacent to a combining mark in cmn, yue, ja or th — the fix is inert for all four.
        expect(phonemize("$5", "en")).toContain("dˈɑːlɚz");
    });
});

/**
 * THE BARE UNIT TOKEN — `10 km` read in 50 engines and `km` alone did not, reaching the phoneme sink as the
 * raw ASCII abbreviation. Same class as `syllableToIpa` (hmn) and `baseToIpa` (cdo): a path that returns its
 * own input. It survived every gate because DIGIT hunts digits and RAWMARK hunts punctuation, while a Latin
 * run in a Latin-script language looks exactly like a word.
 *
 * The fix reads the word the language ALREADY declares — nothing is invented — and the question it stands or
 * falls on is which KEYS may take a path with no numeral to lean on. Answered by scanning the mined corpora
 * for standalone occurrences of every declared multi-character key: the hits split on whether the key has a
 * VOWEL. Vowel-free (`km` ×68, `kg`, `cm`, `mm`) were units in every instance; keys with a vowel were mostly
 * ordinary words — `ha` ×24 (Somali particle, Spanish auxiliary), `mi` ×29 (Yoruba possessive, and `sq mi`),
 * and tl's spelled-out `katao`/`kilometro`/`naninirahan`.
 */
describe("a unit symbol standing alone", () => {
    const n = makeSymbolNormalizer({
        percent: ["percent"],
        units: { km: ["kilometre", "kilometres"], m: ["metre", "metres"], mm: ["millimetre", "millimetres"],
                 ha: ["hectare", "hectares"], mi: ["mile", "miles"] },
        rateDenominators: { h: "hour" },
        unitPer: "per",
    });

    test("the bare token reads, in its citation form, and the counted path is untouched", () => {
        expect(n("km")).toBe("kilometre");
        expect(n("Distance: km")).toBe("Distance: kilometre");
        // The SINGULAR: a bare symbol is a citation, not a count. The counted readings keep their agreement.
        expect(n("10 km")).toBe("10 kilometres");
        expect(n("1 km")).toBe("1 kilometre");
        expect(n("100 km/h")).toBe("100 kilometres per hour");
    });

    test("⚠ A SINGLE-LETTER KEY STILL DOES NOT FIRE — trap 46, which has bitten four times", () => {
        // `m` collides with a Madurese locative, with `US$ 1m`, with Kirundi `50 m'ubumwe`, and in Hmong RPA
        // the final letter IS the tone. One letter is also where unit case is contrastive (s/S, t/T, a/A).
        expect(n("m")).toBe("m");
        expect(n("a m b")).toBe("a m b");
        expect(n("5 m")).toBe("5 metres"); // …while the counted reading is unaffected
        expect(phonemize("50 m’ubumwe", "rn")).toBe("miɾoŋo itanu m ubumwe");
        expect(phonemize("US$ 1m", "ak")).toBe("dɔla baako m");
    });

    test("⚠ AND A KEY WITH A VOWEL DOES NOT FIRE, because it is usually a word", () => {
        expect(n("ha")).toBe("ha");
        expect(n("mi")).toBe("mi");
        expect(n("5 ha")).toBe("5 hectares"); // the numeral is the evidence, and it is still enough
        // The instances behind that rule, in the languages that declare these very keys.
        expect(phonemize("se ha registrado", "es")).toBe("se ˈa rexistɾˈaðo");
        expect(phonemize("mi casa", "es")).toBe("mi kˈasa");
        expect(phonemize("mi", "yo")).toBe("mi˧"); // the Yoruba possessive, ×11 standalone in its corpus
    });

    test("⚠ EXACT CASE, no folding — the upper-case standalone forms measured are NOT units", () => {
        // `MM` is the Mercalli scale (kmr), `MI` is Michigan in a bibliography (nya), `Cm` a variable in a
        // rendered formula (cmn), `Mi` a Yoruba word at the head of a title. The one genuine upper-case unit
        // fleet-wide was `$5 pa Kg` (sn) ×2 — folding would buy two readings and cost four.
        expect(n("KM")).toBe("KM");
        expect(n("Km")).toBe("Km");
        expect(n("MM")).toBe("MM");
        expect(n("10 KM")).toBe("10 kilometres"); // …the numeral still licenses the fold, as it always did
    });

    test("it fires only on a STANDALONE token — never inside a word, a rate, an exponent or a name", () => {
        expect(n("kmx")).toBe("kmx");
        expect(n("xkm")).toBe("xkm");
        expect(phonemize("makmur", "id")).toBe("mˈaʔmur"); // a real word with `km` inside it
        // Half a rate is what this module refuses everywhere else, so a `/` on either side declines.
        expect(phonemize("km/h", "de")).toBe("km h");
        // `245&nbsp;km 2` (yo) is a squared kilometre with the entity in the way; a stray "2" is worse.
        expect(n("km 2")).toBe("km 2");
        expect(n("km²")).toBe("km²");
        // `km.t` is the transliterated Ancient Egyptian name of Egypt (arz) — not a kilometre.
        expect(phonemize("km.t", "de")).toBe("km . t");
        expect(phonemize("km.", "de")).toBe("kilomˈeːtɐ ."); // …but a sentence-final unit still reads
    });

    test("the reading arrives in all 50, across families and across both implementations", () => {
        // The shared tier serves 44; ak, bm, ht, ln, om and ro keep local unit tables and call the same
        // exported pass, so both routes are pinned here.
        const bare: Record<string, string> = {
            de: "kilomˈeːtɐ", pl: "kilˈɔmɛtr", tr: "ciɫometɾˈe", rw: "kilometeɾo", cy: "kilˈɔmɛdr",
            id: "kilomətˈər", sr: "kilometar", mad: "kilɔmɛtəɾ",
            ht: "kilomɛt", ro: "kilomeˈtri",
        };
        for (const [l, ipa] of Object.entries(bare)) {
            expect(phonemize("km", l)).toBe(ipa);
            expect(phonemize("m", l)).toBe("m"); // …and the one-letter guard holds in every one of them
        }
    });
});
