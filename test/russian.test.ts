import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { ROMAN_POLICY } from "../src/languages/russian/romanOrdinals.ts";
import { phonemizeWord } from "../src/languages/russian/russian.ts";

// Canonical-IPA goldens for Russian (ru) — standard Moscow Russian. Stress is lexical
// (stress.tsv, from kaikki); the rule g2p derives palatalization (Cʲ), iotation (я/е/ё/ю → jV), stress-based
// reduction (akanye/ikanye), final devoicing + regressive voicing assimilation, and the ɵ/æ/ʉ frontings.
// Stress mark is placed before the stressed VOWEL (repo convention); monosyllables carry none.
describe("russian canonical IPA", () => {
    test("vowel reduction (akanye/ikanye)", () => {
        expect(phonemizeWord("молоко")).toBe("məɫɐkˈo"); // мə-lɐ-ˈko (2nd-pretonic ə, 1st-pretonic ɐ)
        expect(phonemizeWord("голова")).toBe("ɡəɫɐvˈa");
        expect(phonemizeWord("город")).toBe("ɡˈorət"); // post-tonic ə, final д → t (devoiced)
        expect(phonemizeWord("собака")).toBe("sɐbˈakə");
        expect(phonemizeWord("хорошо")).toBe("xərɐʂˈo");
    });

    test("palatalization, iotation, frontings ɵ/æ", () => {
        expect(phonemizeWord("дядя")).toBe("dʲˈædʲə"); // æ between soft C, final я → ə
        expect(phonemizeWord("тётя")).toBe("tʲˈɵtʲə"); // ё after soft → ɵ
        expect(phonemizeWord("боксёр")).toBe("bɐksʲˈɵr");
        expect(phonemizeWord("язык")).toBe("jɪzˈɨk"); // initial я → jɪ (unstressed)
        expect(phonemizeWord("человек")).toBe("t͡ɕɪɫɐvʲˈek");
    });

    test("devoicing, sibilants, geminates, affrication", () => {
        expect(phonemizeWord("друг")).toBe("druk"); // final г → k
        expect(phonemizeWord("жизнь")).toBe("ʐɨznʲ"); // и after ж → ɨ
        expect(phonemizeWord("русский")).toBe("rˈusːkʲɪj"); // geminate сс → sː
        expect(phonemizeWord("детский")).toBe("dʲˈet͡skʲɪj"); // тс → t͡s
        expect(phonemizeWord("пятиться")).toBe("pʲˈætʲɪt͡sːə"); // -ться → t͡sː
        expect(phonemizeWord("джинсы")).toBe("d͡ʐˈɨnsɨ"); // дж → affricate d͡ʐ
    });

    test("stress dictionary + monosyllable (no mark)", () => {
        expect(phonemizeWord("что")).toBe("ʂto"); // irregular ч→ʂ is in the dict; monosyllable, no ˈ
        expect(phonemizeWord("кот")).toBe("kot");
        expect(phonemizeWord("большой")).toBe("bɐlʲʂˈoj");
    });

    test("Phase 2: genitive г→v + loanword hard е/и", () => {
        expect(phonemizeWord("красного")).toBe("krˈasnəvə"); // genitive -ого → v
        expect(phonemizeWord("большого")).toBe("bɐlʲʂˈovə");
        expect(phonemizeWord("много")).toBe("mnˈoɡə"); // adverb exception → keeps ɡ
        expect(phonemizeWord("тест")).toBe("tɛst"); // loanword hard т → tɛ (not tʲe)
        expect(phonemizeWord("отель")).toBe("ɐtˈɛlʲ");
        expect(phonemizeWord("форель")).toBe("fɐrˈɛlʲ");
        expect(phonemizeWord("тема")).toBe("tʲˈemə"); // native → stays soft
        expect(phonemizeWord("дорогого")).toBe("dərɐɡˈovə"); // genitive adjective (not the adverb дорого) → v
        expect(phonemizeWord("стенд")).toBe("stɛnt"); // loanword: с re-hardens before hard т (no stranded sʲ)
    });

    test("OOV stress: ё-restoration + adjective-lemma inference", () => {
        expect(phonemizeWord("еще")).toBe("jɪɕːˈɵ"); // ё written as е → ещё (ё stressed)
        expect(phonemizeWord("пришел")).toBe("prʲɪʂˈɵɫ"); // пришёл
        expect(phonemizeWord("которые")).toBe("kɐtˈorɨje"); // ← который (stem stress)
        expect(phonemizeWord("большое")).toBe("bɐlʲʂˈoje"); // ← большой (not comparative больший)
        expect(phonemizeWord("маленькая")).toBe("mˈalʲɪnʲkəjə"); // ← маленький (soft stem, -ая spelling)
    });

    // Transliterated foreign (mostly English) proper names. These are NOT stress-dict failures: the Cyrillic
    // transliteration already encodes the Russian-adapted reading (э forces hard mɛ, H→Г→ɡ), and the first-vowel
    // default matches English's predominant INITIAL stress (DAN-ny, MA-ry, EM-ily). This behaviour is intentional
    // and correct; only final-stressed borrowings (Мишель) would need per-name stress data.
    test("transliterated foreign names (adapted pronunciation, initial-stress default) — intentional", () => {
        expect(phonemizeWord("дэнни")).toBe("dˈɛnʲːɪ");
        expect(phonemizeWord("мэри")).toBe("mˈɛrʲɪ");
        expect(phonemizeWord("гарри")).toBe("ɡˈarʲːɪ"); // H → Г, read as ɡ
        expect(phonemizeWord("эмили")).toBe("ˈɛmʲɪlʲɪ");
        expect(phonemizeWord("джонни")).toBe("d͡ʐˈonʲːɪ"); // дж affricate
        expect(phonemizeWord("алекс")).toBe("ˈalʲɪks");
        expect(phonemizeWord("сара")).toBe("sˈarə");
    });

    test("numbers", () => {
        expect(phonemize("21", "ru")).toBe("dvˈat͡sətʲ ɐdʲˈin"); // двадцать один
        expect(phonemize("100", "ru")).toBe("sto"); // сто
        expect(phonemize("2024", "ru")).toBe(
            "dvʲe tˈɨsʲət͡ɕɪ dvˈat͡sətʲ t͡ɕɪtˈɨrʲe",
        ); // две тысячи…
    });

    // Independent adjudicated micro-gold (also the eval's secondary referee) — hand-transcribed Moscow Russian, not Wiktionary.
    test("adjudicated micro-gold (independent referee)", () => {
        const rows = readFileSync(
            new URL("../tools/referee-eval/referees/ru.gold-adjudicated.tsv", import.meta.url),
            "utf8",
        ).split("\n");
        let match = 0,
            total = 0;
        for (const line of rows) {
            if (line === "" || line.startsWith("#") || !line.includes("\t"))
                continue;
            const [word, gold] = line.split("\t");
            total++;
            if (phonemizeWord(word!) === gold!.trim()) match++;
        }
        expect(total).toBeGreaterThan(120);
        expect(match / total).toBeGreaterThanOrEqual(0.96); // ≥96% (allows variable post-tonic я + 1 lexicon gap)
    });

    test("text: reduction + punctuation", () => {
        expect(phonemize("Я люблю русский язык.", "ru")).toBe(
            "ja lʲʊblʲˈu rˈusːkʲɪj jɪzˈɨk .",
        );
    });
});

// Roman-numeral ORDINAL policy (src/languages/russian/romanOrdinals.ts). Russian reads a century as an ORDINAL
// — XIX век → девятнадцатый век — in the MASCULINE NOMINATIVE, agreeing with the masculine век. The table is
// nominative only, so oblique century phrases ("в XIX веке") get the right lexeme with the wrong ending; that
// is documented in the policy file and is still a strict improvement on the cardinal.
describe("Russian roman-numeral ordinals", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal?.(n);

    test("ordinal words: irregular below 20, own stems for the tens, cardinal tens in compounds", () => {
        expect(ord(1)).toBe("первый");
        expect(ord(4)).toBe("четвёртый");
        expect(ord(19)).toBe("девятнадцатый");
        expect(ord(21)).toBe("двадцать первый"); // only the LAST element inflects (unlike Polish)
        expect(ord(40)).toBe("сороковой"); // own stem, not derivable from сорок
        expect(ord(50)).toBe("пятидесятый");
        expect(ord(63)).toBe("шестьдесят третий"); // past 50 — the anniversary / congress range
        expect(ord(100)).toBe("сотый");
        expect(ord(101)).toBeUndefined(); // out of range → the caller falls back to the cardinal
    });

    test("context matches the inflected century forms, not just the nominative", () => {
        for (const w of ["век", "века", "веке", "веком", "веков", "веках", "столетие", "столетии", "съезд", "годовщина"])
            expect(ROMAN_POLICY.ordinalAfter?.test(w)).toBe(true);
        expect(ROMAN_POLICY.ordinalAfter?.test("веко")).toBe(false); // eyelid, not a century
    });

    test("the ordinal reading phonemizes in context", () => {
        expect(phonemize("девятнадцатый век", "ru").trim()).toBe("dʲɪvʲɪtnˈat͡sətɨj vʲek");
        expect(phonemize("пятидесятый съезд", "ru").trim()).toBe("pʲɪtʲɪdʲɪsʲˈatɨj sjest");
    });

    test("a bare roman numeral still reads as a CARDINAL", () => {
        expect(phonemize("xix", "ru").trim()).toBe("dʲɪvʲɪtnˈat͡sətʲ"); // девятнадцать, not девятнадцатый
    });
});

// the ninth language, and the first Cyrillic one to reach the shared initialism pass, which
// exposed an ASCII-only boundary inside core/initialisms.ts itself.
describe("russian normalization", () => {
    test("ordinal notation: the suffix is the CASE ending, not an appendable marker", () => {
        // 5-е is пятое (neuter nom), 5-го пятого (gen), 1970-х семидесятых (gen pl). Each previously spoke
        // the bare letter as a word — 5-е came out [pʲætʲ je], "five ye". The rule reads the ending off the
        // text and inflects the ordinal to match.
        expect(phonemize("1-й день", "ru")).toBe("pʲˈervɨj dʲenʲ"); // первый
        expect(phonemize("5-е место", "ru")).toBe("pʲˈatəje mʲˈestə"); // пятое
        expect(phonemize("3-м", "ru")).toBe("trʲˈetʲjɪm"); // третьем — the one soft stem
        expect(phonemize("7-му флоту", "ru")).toBe("sʲɪdʲmˈomʊ fɫˈotʊ"); // седьмому
        // Past the former's 1-100 range: only the LAST element inflects, the head stays cardinal.
        expect(phonemize("1970-х годов", "ru")).toBe("ɐdnˈa tˈɨsʲət͡ɕə dʲɪvʲɪt͡sːˈot sʲɪmʲɪdʲɪsʲˈatɨx ɡɐdˈof");
    });

    test("Cyrillic initialisms — the core pass was silently doing nothing", () => {
        // core/initialisms.ts matched on \b, which is defined on ASCII word characters and finds no
        // boundary against Cyrillic, so the whole pass was a no-op for Russian.
        expect(phonemize("США", "ru")).toBe("ɛs ʂa a"); // was the cluster [sʂa]; ×47 in the corpus
        expect(phonemize("ДНК", "ru")).toBe("dɛ ɛn ka"); // was [dnk]
        expect(phonemize("ТВ", "ru")).toBe("tɛ vɛ"); // was [tf]
        // ...while a lexicalized acronym stays a word, decided by the OOV rule with no list entry needed.
        expect(phonemize("СМИ", "ru")).toBe("smʲi");
        expect(phonemize("ООН", "ru")).toBe("ɐˈon");
    });

    test("abbreviations, with г. case-sensitive to its preposition", () => {
        // These also used \b and so matched nothing: г. read as a bare [k], н. э. and т. е. left their
        // interior dots as phrase breaks.
        expect(phonemize("в 2007 г.", "ru")).toBe("f dvʲe tˈɨsʲət͡ɕɪ sʲemʲ ɡˈodʊ"); // в governs году
        expect(phonemize("с 1970-х гг.", "ru")).toBe("s ɐdnˈa tˈɨsʲət͡ɕə dʲɪvʲɪt͡sːˈot sʲɪmʲɪdʲɪsʲˈatɨx ɡɐdˈof .");
        // The trailing dot is TWO things and was being consumed unconditionally, so a sentence ending in
        // an era marker lost its boundary entirely — "в 200 г. н. э. Затем…" ran into the next sentence.
        // Discriminated by CASE now: it survives at a sentence end or before a capital, and is consumed
        // where the sentence continues. Four corpus utterances recovered a lost terminator.
        expect(phonemize("до н. э.", "ru")).toBe("do nˈaʂɨj ˈɛrɨ ."); // sentence end ⇒ the dot stays
        expect(phonemize("в 200 г. н. э. Затем", "ru")).toContain("ˈɛrɨ . "); // new sentence ⇒ stays
        expect(phonemize("н. э. и далее", "ru")).not.toContain(" . "); // continues ⇒ consumed
        expect(phonemize("н. э., затем", "ru")).not.toContain(" . "); // the comma carries the break
        expect(phonemize("т. е.", "ru")).toBe("to jesʲtʲ .");
        expect(phonemize("№ 1", "ru")).toBe("nˈomʲɪr ɐdʲˈin"); // the sign was dropped outright
    });

    test("clock, with count agreement and a guard against sports times", () => {
        expect(phonemize("11:00", "ru")).toBe("ɐdʲˈinːət͡sətʲ t͡ɕɪsˈof"); // часов, and no spurious "ноль"
        expect(phonemize("22:08", "ru")).toBe("dvˈat͡sətʲ dva t͡ɕˈasə vˈosʲɪmʲ mʲɪnˈut"); // часа — paucal
        // "2:11,60 минуты" is 2 min 11.60 s, not two o'clock. The corpus contains one.
        expect(phonemize("На 2:11,60 минуты", "ru")).not.toContain("t͡ɕˈasə");
    });

    test("grouping, units, fractions and signs", () => {
        expect(phonemize("5 000 лет", "ru")).toBe("pʲætʲ tˈɨsʲət͡ɕ lʲet"); // was "пять ноль"
        expect(phonemize("120 км/ч", "ru")).toBe("sto dvˈat͡sətʲ kʲɪɫɐmʲˈetrəf f t͡ɕas"); // /ч was a letter
        expect(phonemize("20 °C", "ru")).toBe("dvˈat͡sətʲ ɡrˈadʊsəf t͡sˈɛlʲsʲɪjə");
        expect(phonemize("1/5", "ru")).toBe("ɐdnˈa pʲˈatəjə"); // feminine, agreeing with the elided часть
        expect(phonemize("+3 градуса", "ru")).toBe("plʲus trʲi ɡrˈadʊsə");
        // Roman numerals arrive already converted, with the ordinal a century wants.
        expect(phonemize("XV век", "ru")).toBe("pʲɪtnˈat͡sətɨj vʲek");
    });

    // the BARE METRE, both spellings. `кубический` was declared but unreachable without a head noun,
    // so `120 m³` read as the letter name while `120 km³` read correctly. The agreement comes out of
    // slavicCountForm: 92 takes the paucal (метра), 200 and 30 the genitive plural (метров).
    // The apostrophe hazard that kept Ukrainian's `м` out is guarded by the tier itself.
    test("the bare metre, both spellings, and the cube it feeds", () => {
        expect(phonemize("120 m³", "ru")).toContain("kʊbʲˈit͡ɕɪskʲɪx mʲˈetrəf");
        expect(phonemize("120 м³", "ru")).toContain("kʊbʲˈit͡ɕɪskʲɪx mʲˈetrəf");
        expect(phonemize("92 м", "ru")).toContain("mʲˈetrə");   // paucal
        expect(phonemize("200 м", "ru")).toContain("mʲˈetrəf"); // genitive plural
    });
});
