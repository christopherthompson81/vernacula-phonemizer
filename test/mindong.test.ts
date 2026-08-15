import { describe, expect, test } from "vitest";

import { createMinDong, phonemizeWord } from "../src/languages/mindong/mindong.ts";
import { getPhonemizer } from "../src/registry.ts";

// Min Dong / Eastern Min (cdo) — Fuzhou dialect, Sinitic, tonal (~9M). A Bàng-uâ-cê (BUC / Foochow Romanized) → IPA
// converter (the only major Sinitic branch otherwise absent). BUC missionary convention: plain ⟨p t k⟩ = [pʰ tʰ kʰ],
// ⟨b d g⟩ = [p t k], ⟨c⟩=[t͡s], ⟨ch⟩=[t͡sʰ], ⟨ng⟩=[ŋ]. Validated against BUC↔IPA pairs from the kaikki Chinese dump
// (Wiktionary Module:cdo-pron output) — ⚠ REFERENCE-IMPLEMENTATION PARITY, not independent agreement (the referee
// is rule-generated, not human). Segmental + citation tone, with the 韻變 (rime alternation) MODELLED (tight/loose
// by tone register); tone sandhi, initial assimilation, and the Han front-end deferred.
describe("Min Dong (Fuzhou) canonical IPA — Bàng-uâ-cê → IPA converter", () => {
    const cdo = createMinDong();

    test("the missionary convention: plain ⟨k g c ch⟩ → [kʰ k t͡s t͡sʰ]", () => {
        expect(phonemizeWord("kēng")).toBe("kʰɛiŋ˧˧"); // ⟨k⟩→kʰ, rime eng→ɛiŋ, macron→上聲 33 (犬 "dog")
        expect(phonemizeWord("cūi")).toBe("t͡sui˧˧"); // ⟨c⟩→t͡s (水 "water")
        expect(phonemizeWord("chiáh")).toBe("t͡sʰiɑʔ˨˦"); // ⟨ch⟩→t͡sʰ, checked acute → 陰入 24 (赤 "red")
        expect(phonemizeWord("mā")).toBe("ma˧˧"); // ⟨m⟩→m (馬 "horse")
    });

    test("tones: the five diacritics → the 7 Fuzhou categories (checked bump on ʔ-final)", () => {
        expect(phonemizeWord("nguŏk")).toBe("ŋuoʔ˥"); // breve + checked coda → 陽入 5 (月 "moon")
        expect(phonemizeWord("siŏh")).toBe("suoʔ˥"); // ⟨-h⟩ checked, breve → 陽入 5
    });

    /**
     * ⚠ `silentCharsIn` REPORTS ⟨◌̆⟩ U+0306 AS INERT (×295, `Dṳ̆ng → tyŋ˥˥`) AND THE READING IS CORRECT.
     * The breve is Bàng-uâ-cê's 陰平 mark, and `syllableParts` reads it — but an UNMARKED syllable also
     * falls back to tone 1, so deleting the mark cannot change the reading and the differential calls it
     * silent. Redundancy with a default is not the same thing as being ignored, and the difference is only
     * decidable from outside the engine: these three readings come from the cdo referee
     * (`tools/referee-eval/referees/cdo.buc-ipa.tsv`, Wiktionary Module:cdo-pron), which agrees on all of
     * them. ⚠ THE POINT OF PINNING THEM HERE is that the day the unmarked fallback stops being tone 1 —
     * which it may well should, the corpus having 1 420 unmarked syllables against 15 891 marked ones — the
     * breve must keep reading 陰平 on its own account rather than by coincidence.
     */
    test("⚠ the breve is redundant with the unmarked-tone fallback, and reads 陰平 on its own account", () => {
        expect(phonemizeWord("dṳ̆ng")).toBe("tyŋ˥˥"); // referee: dṳ̆ng  tyŋ⁵⁵
        expect(phonemizeWord("gṳ̆")).toBe("ky˥˥"); //     referee: gṳ̆   ky⁵⁵
        expect(phonemizeWord("sṳ̆k")).toBe("syʔ˥"); //    referee: sṳ̆k  syʔ⁵  (陽入, the checked counterpart)
    });

    test("韻變 rime alternation: the SAME rime is TIGHT under 陰平/陽平/上聲, LOOSE under 陰去/陽去/陰入", () => {
        expect(phonemizeWord("găng")).toBe("kaŋ˥˥"); // 間 ⟨ang⟩ TIGHT [aŋ] (breve = 陰平 55)
        expect(phonemizeWord("gáng")).toBe("kɑŋ˨˩˧"); // 間 ⟨ang⟩ LOOSE [ɑŋ] (acute = 陰去 213)
        expect(phonemizeWord("să̤")).toBe("sɛ˥˥"); // ⟨a̤⟩ TIGHT [ɛ] (breve)
        expect(phonemizeWord("dá̤")).toBe("tɑ˨˩˧"); // ⟨a̤⟩ LOOSE [ɑ] (acute)
        expect(phonemizeWord("iông")).toBe("yɔŋ˨˦˨"); // ⟨iong⟩ y-medial (zero onset) + LOOSE (circumflex = 陽去)
    });

    test("syllabic nasal + the vowel-quality rimes ⟨ṳ e̤ o̤⟩ → [y øy o]", () => {
        expect(phonemizeWord("ng")).toBe("ŋ̍˥˥"); // bare ⟨ng⟩ → syllabic velar nasal (唔)
        expect(phonemizeWord("nè̤ng")).toBe("nøyŋ˥˧"); // ⟨e̤ng⟩→øyŋ, grave → 陽平 53 (人 "person")
    });

    test("multi-syllable BUC text (hyphen-joined), citation tone per syllable", () => {
        expect(createMinDong().text("Hók-ciŭ nè̤ng").trim()).toBe("houʔ˨˦ t͡sieu˥˥ nøyŋ˥˧"); // 福州人 "Fuzhou person"
    });

    test("the text() path handles precomposed NFC ⟨ṳ⟩ (U+1E73) — the [y]/[øy] series", () => {
        // Regression: the tokenizer must NFD-normalize, else the single-codepoint NFC ṳ truncates the syllable.
        expect(createMinDong().text("gṳ̆").trim()).toBe("ky˥˥"); // 車 "cart" — ⟨g⟩→k, ⟨ṳ⟩→y
        expect(createMinDong().text("dṳ̆ng").trim()).toBe("tyŋ˥˥"); // ⟨ṳng⟩→yŋ, not truncated to "t ŋ̍"
    });
});

// Cardinal numbers — Min Dong is Sinitic (myriad grouping 萬 10⁴ / 億 10⁸, internal zero spoken 零 lìng), but unlike
// cantonese/minnan the numerals CANNOT route through a Han reading dict (cdo has none that is not this engine's own
// referee), so the compositor emits BÀNG-UÂ-CÊ and the converter above reads it. Fuzhou specifics: a magnitude
// multiplier of 1 is 蜀 siŏh (not 一 ék), of 2 is 兩 lâng before 百/千/萬/億 but 二 nê before 十.
// ⚠ 百 IS THE VERNACULAR ⟨báh⟩ pɑʔ˨˦, NOT the literary ⟨báik⟩ paiʔ˨˦ — so 八 (8, báik) and 百 (100, báh) are NOT
// homophones, and the two spell out differently in the assertions below. Wikivoyage's phrasebook gives *báik and is
// overruled by Wiktionary's own vernacular/literary gloss and by cdo.wikipedia's number articles (100 = siŏh-báh
// with the recorded audio, 200 = lâng-báh, 300 = săng-báh); see mindong.ts for the full counts.
describe("Min Dong (cdo) cardinal numbers — Bàng-uâ-cê composition", () => {
    const cdo = createMinDong();
    for (const [n, ipa] of [
        [0, "liŋ˥˧"], // 零 lìng
        [7, "t͡sʰɛiʔ˨˦"], // 七 chék
        [10, "sɛiʔ˨˦"], // 十 sék
        [11, "sɛiʔ˨˦ ɛiʔ˨˦"], // 十一 sék-ék — the bare unit digit is ék
        [20, "nɛi˨˦˨ sɛiʔ˨˦"], // 二十 nê-sék — 二 nê before 十
        [21, "nɛi˨˦˨ sɛiʔ˨˦ ɛiʔ˨˦"], // 廿一/二十一
        [100, "suoʔ˥ pɑʔ˨˦"], // 蜀百 siŏh-báh — multiplier 1 is 蜀, not 一; 百 is the vernacular báh
        [1000, "suoʔ˥ t͡sʰieŋ˥˥"], // 蜀千 siŏh-chiĕng
        [12345, "suoʔ˥ uɑŋ˨˦˨ lɑŋ˨˦˨ t͡sʰieŋ˥˥ saŋ˥˥ pɑʔ˨˦ sɛi˨˩˧ sɛiʔ˨˦ ŋou˨˦˨"], // 蜀萬兩千… — 兩 lâng before 千
        [1000000, "suoʔ˥ pɑʔ˨˦ uɑŋ˨˦˨"], // 蜀百萬 siŏh-báh-uâng — myriad grouping, no "million" word; cdo.wikipedia
        // writes exactly this compound ⟨báh-uâng⟩ ×36 ("siŏh-báh-uâng Ā-mī-nì-ā-nè̤ng", one million Armenians).
    ] as const) {
        test(`${n} → ${ipa}`, () => {
            expect(cdo.text(String(n)).trim()).toBe(ipa);
        });
    }
});

// ── Text normalization (src/languages/mindong/normalize.ts) ──────────────────────────────────────────────
// ⚠ THESE GO THROUGH `getPhonemizer("cdo")`, NOT `createMinDong()`, and that is not incidental: ℃/℉ are
// folded to °C/°F at the REGISTRY's single dispatch point (playbook trap 36), so a test that constructs the
// engine directly would assert that `19.6℃` still drops its unit — the very defect this layer closes.
// ⚠ AND THE ASSERTIONS PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (trap 13): each block carries at
// least one case the corpus does NOT contain, because a table-and-fallback rule is correct exactly where it
// was looked at.
describe("Min Dong (cdo) text normalization — BUC out, never Han", () => {
    const cdo = getPhonemizer("cdo");
    const say = (s: string): string => cdo.text(s).trim();

    test("the grouping comma is not a clause pause — the value is destroyed without this", () => {
        // `1,000` read *ɛiʔ˨˦ , liŋ˥˧* — "one … zero", with a pause in the middle. ×62 in the corpus.
        expect(say("1,000")).toBe(say("1000"));
        expect(say("30,221,532")).toBe(say("30221532"));
        // ⚠ THE UNEXERCISED BRANCH: a 1–2 digit tail is a DECIMAL and must survive de-grouping intact.
        expect(say("12.5")).toBe("sɛiʔ˨˦ nɛi˨˦˨ tieŋ˧˧ ŋou˨˦˨"); // 12 diēng 5
    });

    test("the decimal point is ⟨diēng⟩ and the fraction is read DIGIT BY DIGIT", () => {
        // Not *saŋ˥˥ . sɛiʔ˨˦ sɛi˨˩˧* ("three, fourteen"), which is what it read before.
        expect(say("3.14")).toBe("saŋ˥˥ tieŋ˧˧ ɛiʔ˨˦ sɛi˨˩˧"); // săng diēng ék sé
        // ⚠ A ZERO IN THE FRACTIONAL PART is the branch the corpus's own decimals never reach — it must be
        // the digit word ⟨lìng⟩ and not silence.
        expect(say("6.0")).toBe("løyʔ˥ tieŋ˧˧ liŋ˥˧");
        // ⚠ A DOTTED DESIGNATION IS NOT A DECIMAL (the jv guard, carried by core/sinitic.ts).
        expect(say("1.2.3")).not.toContain("tieŋ˧˧");
    });

    test("the percent word PRECEDES its number, as in every Sinitic variety", () => {
        // `%` was dropped outright ×64. ⟨báh-hŭng-cĭ⟩ 百分之 — see normalize.ts for the three-part sourcing.
        expect(say("45%")).toBe("pɑʔ˨˦ huŋ˥˥ t͡si˥˥ sɛi˨˩˧ sɛiʔ˨˦ ŋou˨˦˨");
        // ⚠ A PERCENT RANGE IS CLAIMED WHOLE, and says the word ONCE, in front — the shape gan counted and
        // declined at one instance and cdo writes five times.
        expect(say("3%-4%")).toBe("pɑʔ˨˦ huŋ˥˥ t͡si˥˥ saŋ˥˥ kɑu˨˩˧ sɛi˨˩˧"); // báh-hŭng-cĭ 3 gáu 4
        expect(say("94–98%")).toBe("pɑʔ˨˦ huŋ˥˥ t͡si˥˥ kau˧˧ sɛiʔ˨˦ sɛi˨˩˧ kɑu˨˩˧ kau˧˧ sɛiʔ˨˦ paiʔ˨˦");
    });

    test("the unit abbreviations no longer LEAK RAW LATIN into the IPA", () => {
        // ⚠ THE DEFECT NO GATE IN THE TREE COULD SEE: `2,133 km²` read *… **km˥˥***, a Latin run with a tone
        // letter stuck on it, because `baseToIpa` returns its input when it cannot parse a rime.
        // ⚠ TESTED BY THE READING, NOT BY "no ASCII letters" — IPA is written in Latin letters too, so a
        // blanket letter class cannot separate a leaked `km` from a legitimate [k]. The abbreviation itself
        // is what must be absent, and the whole reading is what must be present.
        expect(say("1400 mm")).toBe("suoʔ˥ t͡sʰieŋ˥˥ sɛi˨˩˧ pɑʔ˨˦ ho˥˧ mi˧˧"); // …hò̤-mī
        expect(say("40cm")).toBe("sɛi˨˩˧ sɛiʔ˨˦ li˧˧ mi˧˧"); // …lī-mī, glued to its number
        expect(say("31 kg")).toBe("saŋ˥˥ sɛiʔ˨˦ ɛiʔ˨˦ kuŋ˥˥ kiŋ˥˥"); // …gŭng-gĭng
        expect(say("600 m²")).toBe("løyʔ˥ pɑʔ˨˦ piŋ˥˧ huoŋ˥˥ mi˧˧"); // bìng-huŏng mī — the bare `m` key
        expect(say("84 km²")).toBe("paiʔ˨˦ sɛiʔ˨˦ sɛi˨˩˧ piŋ˥˧ huoŋ˥˥ kuŋ˥˥ li˧˧"); // 84 bìng-huŏng gŭng-lī
        for (const [s, abbr] of [["2,133 km²", "km"], ["1400 mm", "mm"], ["40cm", "cm"], ["31 kg", "kg"]] as const)
            expect(say(s)).not.toContain(abbr);
        // ⚠ THE ONE-LETTER KEY'S GUARD, which is why `unspacedScript` must stay unset: BUC's own metre word
        // begins with the same letter, so `9.15 mī` must NOT match the bare `m` unit key.
        expect(say("9.15 mī")).toBe("kau˧˧ tieŋ˧˧ ɛiʔ˨˦ ŋou˨˦˨ mi˧˧"); // …mī, not …bìng-huŏng anything
    });

    test("the degree, the temperature, and the scale letter that used to survive as an English letter", () => {
        expect(say("20 °C")).toBe("nɛi˨˦˨ sɛiʔ˨˦ tou˨˦˨"); // was *… c˥˥*
        expect(say("19.6℃")).toBe("sɛiʔ˨˦ kau˧˧ tieŋ˧˧ løyʔ˥ tou˨˦˨"); // the ℃ fold + the decimal part
        // ⚠ THE UNEXERCISED BRANCH: `°F` is ×0 in this corpus and gets the same bare-degree reading, because
        // cdo has no scale name in any source and the alternative is a stranded ⟨F⟩.
        expect(say("100 °F")).toBe(say("100 °C"));
        // A COORDINATE, claimed whole before the bare-degree rule can eat its `°` — ⟨dô⟩ 度 ⟨hŭng⟩ 分 ⟨miēu⟩ 秒.
        expect(say("22° 11′ 47″")).toBe("nɛi˨˦˨ sɛiʔ˨˦ nɛi˨˦˨ tou˨˦˨ sɛiʔ˨˦ ɛiʔ˨˦ huŋ˥˥ sɛi˨˩˧ sɛiʔ˨˦ t͡sʰɛiʔ˨˦ mieu˧˧");
    });

    test("the range connective is ⟨gáu⟩ — and the guards that keep identifiers out of it", () => {
        expect(say("100 - 700 km")).toBe("suoʔ˥ pɑʔ˨˦ kɑu˨˩˧ t͡sʰɛiʔ˨˦ pɑʔ˨˦ kuŋ˥˥ li˧˧");
        expect(say("23~27")).toContain("kɑu˨˩˧");
        // ⚠ THE THREE THINGS THAT MUST NOT BECOME RANGES, one per guard, none of them a corpus accident:
        expect(say("ISBN 3-88053-113-7")).not.toContain("kɑu˨˩˧"); // chained dashes
        expect(say("«Mā-tái Hók-ĭng» 22:37-40")).not.toContain("kɑu˨˩˧"); // a Bible verse — the `:` lookbehind
        expect(say("ISO 639-3")).not.toContain("kɑu˨˩˧"); // an ALL-CAPS designation
    });

    // TRAP 58 — the right-hand guard used to reject a following `.` or `,`, so the rule declined every span
    // that ENDS A CLAUSE and the reading fell back to two juxtaposed cardinals. All three of the artifact's
    // clause-final spans sit in one paragraph, and TWO of them end on a COMMA — which cdo can drop because
    // its comma is a GROUPING mark only (step 1 has already spent it) and never a decimal.
    test("a range that ENDS A CLAUSE keeps ⟨gáu⟩ — and the mark still reads as the pause", () => {
        expect(say("2,000-3,000.")).toBe("lɑŋ˨˦˨ t͡sʰieŋ˥˥ kɑu˨˩˧ saŋ˥˥ t͡sʰieŋ˥˥ ."); // the dot
        expect(say("200-300,")).toBe("lɑŋ˨˦˨ pɑʔ˨˦ kɑu˨˩˧ saŋ˥˥ pɑʔ˨˦ ,"); // the comma
        expect(say("100 - 700 km.")).toContain("kɑu˨˩˧");
        // ⚠ AND THE THREE GUARDS ABOVE STILL HOLD AT A SENTENCE END, which is the whole risk of the change:
        expect(say("ISO 639-3.")).not.toContain("kɑu˨˩˧"); // still an ALL-CAPS designation
        expect(say("«Sĕng-mêng Gé» 5:6-21.")).not.toContain("kɑu˨˩˧"); // still a Bible verse
        expect(say("ISBN 3-88053-113-7.")).not.toContain("kɑu˨˩˧"); // still a chain
    });

    test("the fraction is denominator-first, and a year pair is not a fraction", () => {
        expect(say("1/4")).toBe("sɛi˨˩˧ huŋ˥˥ t͡si˥˥ ɛiʔ˨˦"); // sé hŭng-cĭ ék — "of four parts, one"
        expect(say("2020/2021")).not.toContain("huŋ˥˥ t͡si˥˥"); // an academic year (the shared guard)
    });

    test("⚠ THE YEAR IS DELIBERATELY UNTOUCHED — the largest refusal in the layer", () => {
        // Digit-by-digit is a fact about HAN orthography and nothing sources it for a Latin-script Fuzhou
        // reader; the corpus also writes `chiĕu-guó 2200 nièng` and `7,000 nièng sèng`, which are DURATIONS
        // and want exactly the cardinal below. See normalize.ts for the counts and how to re-open it.
        expect(say("1749 nièng")).toBe(`${say("1749")} nieŋ˥˧`);
        expect(say("1749")).toBe("suoʔ˥ t͡sʰieŋ˥˥ t͡sʰɛiʔ˨˦ pɑʔ˨˦ sɛi˨˩˧ sɛiʔ˨˦ kau˧˧"); // the CARDINAL
    });

    test("⚠ A SUPERSCRIPT IN A cdo ARTICLE IS A ROMANIZATION TONE NUMBER, NOT A POWER", () => {
        // cdo.wikipedia glosses pronunciations inline in jyutping, POJ+Chao digits and its own IPA. Reading
        // a bare superscript as an exponent would turn this engine's own source notation into arithmetic —
        // the seventh Sinitic corpus to force this refusal. A squared UNIT still reads (above), which is
        // what keeps the exemption honest.
        expect(say("hoeng¹ gong²")).not.toContain("piŋ˥˧ huoŋ˥˥"); // no "squared"
        expect(say("/y⁵³ y³⁵ touŋ³³/")).not.toContain("piŋ˥˧ huoŋ˥˥");
    });
});
