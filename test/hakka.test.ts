import { describe, expect, test } from "vitest";

import { phonemizePfs, phonemizeWord } from "../src/languages/hakka/hakka.ts";
import { normalizeHakka } from "../src/languages/hakka/normalize.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Hakka Chinese / 客家话 (hak), Meixian 梅县 dialect — a distinct Sinitic branch. The
// signature is the retention of ALL THREE Middle Chinese stop codas -p̚ -t̚ -k̚ (十→səp̚, 月→ŋiat̚, 六→liʊk̚) that
// separates Hakka from Jin (merged -ʔ) and Mandarin (lost). Six citation tones as Chao contour letters (陰平 ˦˦,
// 陽平 ˩˩, 上 ˧˩, 去 ˥˧, 陰入 ˩, 陽入 ˥). Readings from Wiktionary/kaikki Meixian Sinological-IPA.
describe("Hakka Chinese (Meixian) canonical IPA", () => {
    test("single characters — tones as Chao letters", () => {
        expect(phonemizeWord("馬")).toBe("ma˦˦"); // 陰平 44
        expect(phonemizeWord("犬")).toBe("kʰian˧˩"); // 上 31
        expect(phonemizeWord("人")).toBe("ŋin˩˩"); // 陽平 11
    });

    test("the retained -p̚ -t̚ -k̚ stop codas (the Hakka signature)", () => {
        expect(phonemizeWord("十")).toBe("səp̚˥"); // -p̚, 陽入 5
        expect(phonemizeWord("月")).toBe("ŋiat̚˥"); // -t̚, 陽入 5
        expect(phonemizeWord("六")).toBe("liʊk̚˩"); // -k̚, 陰入 1
        expect(phonemizeWord("客")).toBe("hak̚˩"); // -k̚, 陰入 1 — the ethnonym 客家's first syllable
    });

    test("multi-char words carry baked tone sandhi (surface tone after ⁻)", () => {
        expect(phonemizeWord("中國")).toBe("t͡sʊŋ˧˥ kuɛt̚˩"); // 中 44→35 sandhi before a checked syllable
        expect(phonemizeWord("客家")).toBe("hak̚˩ ka˦˦"); // the Hakka endonym
    });

    test("simplified input resolves (via OpenCC aliases)", () => {
        expect(phonemizeWord("中国")).toBe(phonemizeWord("中國"));
        expect(phonemizeWord("太阳")).toBe("tʰaɪ˥˧ iɔŋ˩˩");
    });

    test("numbers compose through the Han numeral system", () => {
        // 25 → 二十五 → ŋi˥˧ səp̚˥ n̩˧˩
        expect(getPhonemizer("hak").text("25").trim()).toBe("ŋi˥˧ səp̚˥ n̩˧˩");
    });
});

// ── NORMALIZATION ─────────────────────────────────────────────────────────────────────────────────────
// The sixth Sinitic layer and the first built ON `core/sinitic.ts`. Tests pin the rule's BRANCHES rather
// than the corpus's instances (playbook trap 13), and in particular the branches the corpus does NOT
// exercise. `docs/investigations/hak_normalization_investigation.md` carries the counts.
describe("Hakka normalization", () => {
    test("thousands de-grouping — the grouping comma was a clause pause AND destroyed the value", () => {
        // Before: `1,000人` read *it̚˩ , laŋ˩˩ ŋin˩˩* — "one … zero people".
        expect(normalizeHakka("1,000人")).toBe("1000人");
        expect(normalizeHakka("17,840,000")).toBe("17840000");
        // ⚠ a 4-digit Chinese 万-grouping is NOT a thousands separator: exactly-3-digit groups is what
        // leaves it alone rather than mangling the value. (The decimal rule then declines it too — its own
        // lookbehind refuses a number with a comma in it — so the shape passes through untouched.)
        expect(normalizeHakka("1,8638.36")).toBe("1,8638.36");
    });

    test("the Pha̍k-fa-sṳ year morpheme → 年 — the largest shape in the language (×5,349)", () => {
        expect(normalizeHakka("2005-ngièn")).toBe("二零零五年");
        // trap 15: the same bound morpheme is also written with a SPACE (×169).
        expect(normalizeHakka("2017 ngièn")).toBe("二零一七年");
        // 1–3 digits fold too, and correctly keep the CARDINAL — a duration and a short year are the
        // same surface (`30-ngièn nui` is "within 30 years"; `711-ngièn` is the year 711).
        expect(normalizeHakka("30-ngièn nui")).toBe("30年 nui");
        expect(normalizeHakka("711-ngièn")).toBe("711年");
        // ⚠ THE CURRENCY MUST NOT BE CLAIMED: `mî-ngièn` is 美元, and it follows four digits (×52).
        expect(normalizeHakka("6210 mî-ngièn")).toBe("6210 mî-ngièn");
    });

    test("years — all three arms, in both orthographies, through the shared rule", () => {
        expect(normalizeHakka("2009年")).toBe("二零零九年");
        expect(normalizeHakka("1996-2007年")).toBe("一九九六至二零零七年");
        // the PFS range: the fold runs first, so one shared call covers both spellings
        expect(normalizeHakka("1861-1865 ngièn")).toBe("一八六一至一八六五年");
        expect(normalizeHakka("1877-ngièn - 1919-ngièn")).toBe("一八七七年至一九一九年");
        // 3 digits keep the cardinal — the fleet's standing refusal
        expect(normalizeHakka("711年")).toBe("711年");
    });

    test("the range connective is 至, not the 到 every sibling layer ships", () => {
        // Han portion: 至 ×19 against 到 ×4; PFS `chṳ` ×19 against `to` ×19 — a tie broken by the Han.
        expect(normalizeHakka("90-120 fûn-chûng")).toBe("90至120 fûn-chûng");
        expect(normalizeHakka("200—300 kûng-lî")).toBe("200至300 kûng-lî");
        expect(normalizeHakka("335～345天")).toBe("335至345天");
    });

    test("the range guard refuses the codes that share its shape", () => {
        // cjy's guard (refuse a range near a Latin run) would refuse EVERY range in a 93.5%-Latin corpus;
        // wuu's (require a unit on the right) is the one that transfers.
        for (const code of ["ISO 639-1", "ISO 3166-1", "A340-500", "777-200ER", "GE90-115B", "C6554-07E"])
            expect(normalizeHakka(code)).toBe(code);
        // and the broadcast clock, for free — nothing that follows it is a unit
        expect(normalizeHakka("21:00 - 21:54, JST")).toBe("21:00 - 21:54, JST");
    });

    test("temperature — 攝氏 PREPOSED, and the decimal survives", () => {
        // sourced: hak.wikipedia writes `(ngiap-shì 2040 thu)` — the scale name BEFORE the number.
        expect(normalizeHakka("20°C")).toBe("攝氏20度");
        // ⚠ THE BRANCH THE FLEET GOT WRONG: a preposing layer used to insert the scale word INSIDE the
        // number, so `13.3 °C` read `13.` + 攝氏三度. Fixed in core/sinitic.ts; pinned here and in yue.
        expect(normalizeHakka("13.3 °C")).toBe("攝氏13點三度");
        expect(normalizeHakka("34.2 °C")).toBe("攝氏34點二度");
        // Fahrenheit is an INFERENCE (zero corpus instances) — trap 8, pin it anyway.
        expect(normalizeHakka("451°F")).toBe("華氏451度");
    });

    test("a negative temperature takes the corpus's own word, 零下", () => {
        // `làng-hâ 25℃` in the corpus; 零下 reads laŋ¹¹ ha⁴⁴, which is `làng-hâ` exactly.
        expect(normalizeHakka("-4.5°C")).toBe("攝氏零下4點五度");
        // ⚠ NOT claimed without a degree sign — the other 28 leading hyphens before digits are year-range
        // separators and chemistry oxidation states.
        expect(normalizeHakka("-2, 0, +4, +6")).toBe("-2, 0, +4, +6");
    });

    test("coordinates — the minute and second marks are read, not dropped", () => {
        expect(normalizeHakka("27°58′38″")).toBe("27度58分38秒");
        expect(normalizeHakka("112°50'-114°45'")).toBe("112度50分至114度45分");
        // the bare degree, which is the best-attested of the three (`Pet-vúi 42 thu` ×15)
        expect(normalizeHakka("42°")).toBe("42度");
    });

    test("percent, per-mille, fraction, units and the exponent", () => {
        expect(normalizeHakka("50%")).toBe("百分之 50");
        expect(normalizeHakka("3.5%")).toBe("百分之 3點五");
        // ⚠ 千分之 is a PREFIX, so it must claim the WHOLE range — both corpus instances are ranges.
        expect(normalizeHakka("30-34‰")).toBe("千分之30至34");
        expect(normalizeHakka("1/5")).toBe("5分之1");
        expect(normalizeHakka("8,494 km²")).toBe("8494 平方公里");
        expect(normalizeHakka("60 kg")).toBe("60 公斤");
    });

    test("the fraction rule's two refusals — a year pair, and a code fused to a letter", () => {
        expect(normalizeHakka("2020/2021")).toBe("2020/2021"); // an academic year, in five corpora now
        // ⚠ FOUND BY THIS LANGUAGE, FIXED IN core/sinitic.ts: hak.wikipedia's rolling-stock articles write
        // train-set numbers this way, and the digit-only lookbehind read `A/C/B351/352` as "351 over 352".
        expect(normalizeHakka("A/C/B351/352")).toBe("A/C/B351/352");
        expect(normalizeHakka("SP1900/1950")).toBe("SP1900/1950");
    });

    test("the conjunction is 摎 — Hakka's own, not 和 and not wuu's 搭", () => {
        // 摎 reads lau⁴⁴; the corpus writes `lâu` ×3,232. The dict reading and the romanization agree.
        expect(normalizeHakka("Solvay & Cie")).toBe("Solvay 摎 Cie");
    });

    test("decimals — the fractional part is read DIGIT BY DIGIT", () => {
        expect(normalizeHakka("12.5")).toBe("12點五");
        expect(normalizeHakka("6.34")).toBe("6點三四"); // never 六點三十四
        // the dotted-designation guard the jv layer earned, and the 3-digit cap that keeps a DOI out
        expect(normalizeHakka("1.2.3")).toBe("1.2.3");
        expect(normalizeHakka("10.1016")).toBe("10.1016");
    });

    test("every word this layer emits speaks — the shared Han engine SKIPS an uncovered character", () => {
        // An unsourced word is not mispronounced, it VANISHES. This is the layer's hard gate.
        for (const w of ["摎", "零下", "百分之", "分之", "點", "至", "公里", "公斤", "平方", "攝氏", "華氏", "度", "美元", "年", "分", "秒", "千"])
            expect(phonemizeWord(w), w).not.toBe("");
        // ⟨度⟩ is the derived dict entry — absent from the Meixian source, read off 印度/深度 and confirmed
        // by the corpus's `thu`. Without it the degree rule would emit silence (which is why cjy declined).
        expect(phonemizeWord("度")).toBe("tʰu˥˧");
    });

    test("end to end, through the engine", () => {
        expect(getPhonemizer("hak").text("攝氏20度").trim()).toBe("ŋiap̚˩ sz̩˥˧ ŋi˥˧ səp̚˥ tʰu˥˧");
        expect(getPhonemizer("hak").text("20°C").trim()).toBe("ŋiap̚˩ sz̩˥˧ ŋi˥˧ səp̚˥ tʰu˥˧");
        // the year, which was reading as a cardinal with the morpheme in English
        expect(getPhonemizer("hak").text("2005-ngièn").trim()).toBe("ŋi˥˧ laŋ˩˩ laŋ˩˩ n̩˧˩ ŋian˩˩");
    });
});

// ── PHA̍K-FA-SṲ, the romanization hak.wikipedia is actually written in ─────────────────────────────────
// 93.5% of that wiki's characters are Latin, and every one of them used to route to ENGLISH. `pfs.ts` reads
// them against `pfs.tsv` (derived from kaikki — see pfs.PROVENANCE.md). Tests pin the rule's BRANCHES:
// word key, syllable key, composition, and the refusal that hands a run back to the foreign reader.
describe("Hakka Pha̍k-fa-sṳ front end", () => {
    test("⚠ THE ROMANIZED AND HAN SPELLINGS OF A WORD PRODUCE IDENTICAL IPA — sandhi included", () => {
        // This is the strongest check the front end has, because the two paths are separate artifacts and
        // separate code: dict.tsv/hanRun against pfs.tsv/readPfs. 客家人 is 44→35 sandhi on the middle
        // syllable, and the PFS word key carries it — which is the entire reason word keys exist.
        expect(phonemizePfs("Hak-kâ-ngìn")).toBe(phonemizeWord("客家人"));
        expect(phonemizePfs("Hak-kâ-ngìn")).toBe("hak̚˩ ka˧˥ ŋin˩˩");
        expect(phonemizePfs("chûng-koet")).toBe(phonemizeWord("中國"));
    });

    test("syllable keys, and the six tones the diacritics encode", () => {
        expect(phonemizePfs("ngìn")).toBe("ŋin˩˩"); // à  陽平 11
        expect(phonemizePfs("mâ")).toBe("ma˦˦"); //   â  陰平 44
        // ⚠ NOT 犬's kʰian˧˩, and that is the table being honest rather than wrong: several Han characters
        // share the Sixian spelling `khién` and split in Meixian, so the majority vote picks kʰɛn. The
        // TONE — ˧˩, 上聲, from the acute — is what this line pins.
        expect(phonemizePfs("khién")).toBe("kʰɛn˧˩");
        expect(phonemizePfs("thai")).toBe("tʰaɪ˥˧"); // bare, open → 去 53
        expect(phonemizePfs("yit")).toBe("it̚˩"); //   bare + stop coda → 陰入 1
        expect(phonemizePfs("ngi̍t")).toBe("ŋit̚˥"); // a̍ + stop coda → 陽入 5
    });

    test("⚠ THE TABLE IS LOOKED UP IN NFD — the file is NFC and a mismatch fails toward composition", () => {
        // `ngìn` is the 4th commonest syllable in the language. With the keys left NFC and the lookup NFD it
        // missed the table and COMPOSED instead — silently, because composition still produces output. Only
        // a syllable with no diacritic at all (`tshai`) matched, which is what made it look like it worked.
        for (const s of ["ngìn", "chûng", "kâ", "chhṳ̂n", "ngièn"]) expect(phonemizePfs(s), s).not.toBe("");
        expect(phonemizePfs("ngìn".normalize("NFD"))).toBe(phonemizePfs("ngìn".normalize("NFC")));
    });

    test("⚠ COMPOSED TONES ARE SUPERSCRIPT — the same renderer serves both paths", () => {
        // `pfsTones` was authored with ASCII digits, so every COMPOSED syllable leaked a bare `44` into the
        // phoneme stream while every table-sourced one was correct. No Chao letters, no tone.
        for (const s of ["ngim", "chhṳ̂n", "ông"]) expect(phonemizePfs(s), s).toMatch(/[˩˨˧˦˥]/u);
        for (const s of ["ngim", "chhṳ̂n", "ông"]) expect(phonemizePfs(s), s).not.toMatch(/[0-9]/u);
    });

    test("⚠ THE ZERO ONSET IS A REAL ONSET — it is not a row in the manifest table", () => {
        // Treating the missing row as "unreadable" condemned every vowel-initial syllable with no
        // onset-sharing sibling; `tûng-ông` (東王) ×127 went to the English reader because of it.
        expect(phonemizePfs("ông")).not.toBe("");
        expect(phonemizePfs("tûng-ông")).not.toBe("");
    });

    test("a run that is not Hakka is handed back to the foreign reader", () => {
        for (const w of ["Nobel", "Québec", "Castilla", "Zaragoza", "iPhone", "Ireland"])
            expect(phonemizePfs(w), w).toBe("");
        // ⚠ AND THE UNIT `km` IS THE REASON THE ≤2-LETTER REFUSAL EXISTS: it parses as PFS (k + syllabic m̩).
        // The class is `me a tu g u na en km` — 46 types the orthography cannot tell from English.
        expect(phonemizePfs("km")).toBe("");
        // …but a 2-letter word that IS attested still reads: the refusal only covers what the table lacks.
        expect(phonemizePfs("he")).not.toBe("");
        expect(phonemizePfs("ke")).not.toBe("");
    });

    test("⚠ A HYPHENATED RUN RESOLVES PER SYLLABLE — a foreign name keeps its Hakka suffix", () => {
        // `Soria-sén`, `Québec-sén`, `Zaragoza-sén`, `Huesca-sén` (省, "province") are 519 corpus tokens, and
        // all-or-nothing sent the ⟨sén⟩ to the English reader with the name. The discriminator survives
        // intact: an unhyphenated foreign word is ONE syllable and still fails as a whole.
        expect(phonemizePfs("Soria-sén")).toBe(phonemizePfs("sén"));
        expect(getPhonemizer("hak").text("Soria-sén").trim()).toContain(phonemizePfs("sén"));
        expect(getPhonemizer("hak").text("Soria-sén").trim()).not.toBe(phonemizePfs("sén"));
    });

    test("⟨ts⟩/⟨tsh⟩ fold to ⟨ch⟩/⟨chh⟩; ⟨j⟩ does not", () => {
        // The wiki spells the affricates both ways (5,230 syllable tokens the other way); folding gains 1.2
        // points of coverage. ⚠ THE SAME TEST ON ⟨j⟩ GAINED 0.1, and the instances say why — `jawa`, `john`,
        // `james`, `azerbaijan`. Folding it would have claimed foreign names. The small number was the signal.
        expect(phonemizePfs("tshai")).toBe(phonemizePfs("chhai"));
        expect(phonemizePfs("tsú")).toBe(phonemizePfs("chú"));
        expect(phonemizePfs("john")).toBe("");
        expect(phonemizePfs("jawa")).toBe("");
    });

    test("end to end — a romanized sentence reads as Hakka, and Han in the same sentence agrees", () => {
        const out = getPhonemizer("hak").text("客家人 lâu Hak-kâ-ngìn he siông-thùng ke.").trim();
        // the Han and the PFS spelling of the SAME word, in one sentence, byte-identical
        expect(out.startsWith("hak̚˩ ka˧˥ ŋin˩˩ lau˦˦ hak̚˩ ka˧˥ ŋin˩˩")).toBe(true);
        // and no English phonology survives anywhere in it
        expect(out).not.toMatch(/[ˈˌ]/u);
    });

    test("the normalizer still runs in front of the PFS reader", () => {
        // The layer rewrites `2005-ngièn` to 二零零五年 BEFORE tokenization, so the digits never reach here.
        expect(getPhonemizer("hak").text("2005-ngièn").trim()).toBe("ŋi˥˧ laŋ˩˩ laŋ˩˩ n̩˧˩ ŋian˩˩");
        expect(getPhonemizer("hak").text("20°C").trim()).toBe("ŋiap̚˩ sz̩˥˧ ŋi˥˧ səp̚˥ tʰu˥˧");
    });
});
