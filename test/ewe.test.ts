import { describe, expect, test } from "vitest";

import { createEwe, phonemizeWord } from "../src/languages/ewe/ewe.ts";
import { normalizeEwe } from "../src/languages/ewe/normalize.ts";
import { numberToWords } from "../src/languages/ewe/numbers.ts";

// Canonical-IPA goldens for Ewe (ee) — Eʋegbe, a Gbe language (Niger-Congo, Kwa), the Latin-based African alphabet.
// Signatures: labial-velars ⟨gb kp⟩→[ɡ͡b k͡p], the bilabial ⟨ƒ⟩→[ɸ]/⟨ʋ⟩→[β] (vs labiodental f/v), affricates ⟨dz ts⟩,
// ⟨ny⟩→[ɲ], ⟨x⟩→[x]; written nasalization (tilde kept); TONELESS (tone unmarked in the orthography). The two non-obvious
// allophonies (per Jalloh's grammar): ⟨w⟩→[w] before a rounded vowel but [ɰ] before an unrounded one, and ⟨r⟩→[l] in an
// onset cluster (after a consonant) but [r] elsewhere. ⚠ Referee: kaikki Ewe, 249 human pairs — it agrees
// completely, which is a statement about how shallow the orthography is, not a quality margin.
describe("Ewe (Eʋegbe) canonical IPA", () => {
    test("labial-velars, bilabials, affricates, ⟨ny⟩", () => {
        expect(phonemizeWord("Eʋegbe")).toBe("eβeɡ͡be"); // the language name — ⟨ʋ⟩→[β], ⟨gb⟩→[ɡ͡b]
        expect(phonemizeWord("agbe")).toBe("aɡ͡be"); // 'life' — labial-velar ⟨gb⟩
        expect(phonemizeWord("atsiaƒu")).toBe("at͡siaɸu"); // 'sea' — ⟨ts⟩→[t͡s], bilabial ⟨ƒ⟩→[ɸ]
        expect(phonemizeWord("nyɔnu")).toBe("ɲɔnu"); // 'woman' — ⟨ny⟩→[ɲ]
    });

    test("⟨w⟩ rounding allophony ([w]/[ɰ]) and ⟨x⟩, ⟨ɣ⟩", () => {
        expect(phonemizeWord("wɔ")).toBe("wɔ"); // ⟨w⟩ before a ROUNDED vowel → [w]
        expect(phonemizeWord("Xawa")).toBe("xaɰa"); // ⟨x⟩→[x]; ⟨w⟩ before UNROUNDED [a] → [ɰ]
        expect(phonemizeWord("ɣ")).toBe("ɰ"); // ⟨ɣ⟩ → the velar approximant [ɰ]
    });

    test("⟨r⟩→[l] in a cluster; written nasalization; ⟨kp⟩; ⟨ŋ⟩", () => {
        expect(phonemizeWord("adre")).toBe("adle"); // 'seven' — ⟨r⟩ after a consonant → [l]
        expect(phonemizeWord("agbalẽ")).toBe("aɡ͡balẽ"); // 'book' — nasalized ⟨ẽ⟩ kept
        expect(phonemizeWord("fukpekpe")).toBe("fuk͡pek͡pe"); // ⟨kp⟩ labial-velar
        expect(phonemizeWord("ŋusẽ")).toBe("ŋusẽ"); // 'strength' — ⟨ŋ⟩→[ŋ], nasal ⟨ẽ⟩
    });

    test("text() tokenizes NFC precomposed vowels + uppercase Ɖ (public-API path)", () => {
        const ee = createEwe();
        expect(ee.text("agbalẽ".normalize("NFC"))).toBe("aɡ͡balẽ"); // NFC nasal ⟨ẽ⟩ not dropped by the tokenizer
        expect(ee.text("Ɖekawo")).toBe("ɖekawo"); // uppercase ⟨Ɖ⟩ tokenized
    });

    // NUMBERS — DECIMAL, but with PREFIXING morphology no data-only composer can express: the teens are wui- +
    // unit stem and the round tens are bla- + unit stem (bla- is a multiplicative TEN prefix, so blaeve 20 is
    // 'ten×two' and blaene 40 is 'ten×four' — NOT a base-20 series), 21–99 link with vɔ 'plus', and the
    // magnitude nouns alafa/akpe/miliɔn take a FOLLOWING multiplier with kple 'and' between slots. Sources:
    // Omniglot "Numbers in Ewe" + desmotsetdeslangues.eklablog.com/ewe. See src/languages/ewe/numbers.ts.
    test("numbers: units, wui- teens, bla- tens, vɔ compounds", () => {
        expect(numberToWords(7)).toBe("adre");
        expect(numberToWords(10)).toBe("ewo");
        expect(numberToWords(11)).toBe("wuiɖeke"); // wui- + the unit stem
        expect(numberToWords(20)).toBe("blaeve"); // bla- (×10) + eve → 10×2
        expect(numberToWords(21)).toBe("blaeve vɔ ɖeka"); // TENS vɔ UNIT
        expect(numberToWords(42)).toBe("blaene vɔ eve");
        expect(numberToWords(99)).toBe("blaasieke vɔ asieke");
    });

    test("numbers: alafa hundreds, akpe thousands, miliɔn millions (multiplier FOLLOWS, kple joins)", () => {
        expect(numberToWords(100)).toBe("alafa ɖeka");
        expect(numberToWords(101)).toBe("alafa ɖeka kple ɖeka");
        expect(numberToWords(555)).toBe("alafa atɔ̃ kple blaatɔ̃ vɔ atɔ̃");
        expect(numberToWords(1000)).toBe("akpe ɖeka");
        expect(numberToWords(12345)).toBe("akpe wuieve kple alafa etɔ̃ kple blaene vɔ atɔ̃");
        expect(numberToWords(1_000_000)).toBe("miliɔn ɖeka");
        expect(numberToWords(2_000_000)).toBe("miliɔn eve");
    });

    test("numbers: end-to-end through the scan (text path)", () => {
        expect(createEwe().text("20")).toBe("blaeve");
        expect(createEwe().text("1000")).toBe("ak͡pe ɖeka"); // ⟨kp⟩ → the labial-velar k͡p
    });
});

// ── TEXT NORMALIZATION (src/languages/ewe/normalize.ts) ───────────────────────────────────────────────
// Evidence and refusals: that file's header and docs/investigations/ee_normalization_investigation.md.
// The corpus is ee.wikipedia (tools/corpus/mined/ee.jsonc, 5,921 paragraphs) — there is no FLEURS for Ewe.
describe("Ewe text normalization", () => {
    const ee = createEwe();

    // ⚠ THE HOMOGLYPH FOLD, which is why this layer exists at all. ⟨Ð⟩ U+00D0 (×19 in the corpus) and
    // ⟨Đ⟩ U+0110 stand in for Ewe's ⟨Ɖ⟩ U+0189; ⟨Ƞ⟩ U+0220 for ⟨Ŋ⟩; U+0342 COMBINING GREEK PERISPOMENI for
    // the nasalization tilde U+0303. The first three are outside `TOKEN`, so the WORD ENDED and the
    // fragment went to the English fallback as a letter name; the fourth deleted a phoneme contrast in
    // silence. Pinned through the public API, because the defect is in tokenization and not in the scan.
    test("homoglyph fold: Ð Đ → Ɖ, Ƞ → Ŋ, U+0342 → U+0303", () => {
        expect(ee.text("Ðasefowo")).toBe("ɖasefowo"); // was *dˈiː asefowo* — the letter name "dee"
        expect(ee.text("Đoɖo")).toBe("ɖoɖo");
        expect(ee.text("Ƞkɔ")).toBe("ŋkɔ"); // was *ƞ kɔ* — the raw ⟨ƞ⟩ ALSO reached the IPA
        expect(ee.text("ha͂")).toBe("hã"); // was *ha* — /hã/ and /ha/ are two words
        expect(ee.text("kata͂")).toBe("katã");
        // …and the same fold must reach the word identically however the wiki encoded it.
        expect(ee.text("Ðasefowo")).toBe(ee.text("Ɖasefowo"));
    });

    // ⚠ THE LOOKALIKES THAT ARE NOT HOMOGLYPHS — the negative half of the census, pinned so a later widening
    // of the fold has to argue with it. ⟨ʊ⟩ U+028A looks exactly like ⟨ʋ⟩ and every instance in this corpus
    // is inside an ENGLISH pronunciation gloss the wiki writes in parentheses; ⟨ð⟩ and ⟨ƞ⟩ lowercase are
    // ×0 and are live IPA characters. The fold is capitals-only and attested-only (trap 9).
    test("lookalikes are left alone: ʊ is not ʋ, and the fold is capitals-only", () => {
        expect(normalizeEwe("/boʊnˈfoʊ ɑːbˈæs/")).toBe("/boʊnˈfoʊ ɑːbˈæs/");
        expect(normalizeEwe("ð đ ƞ")).toBe("ð đ ƞ");
    });

    // Percent is POSTPOSED — `le alafa me`, "in a hundred" (ee.wikipedia: "Exɔ ame 50.11 le alafa me").
    // A SPAN takes the word once, after the second operand, which is why percent runs before ranges.
    test("percent is postposed, and a span takes it once", () => {
        expect(ee.text("90%")).toBe("blaasieke le alafa me");
        expect(ee.text("25–33%")).toBe("blaeve vɔ atɔ̃ va ɖo blaetɔ̃ vɔ etɔ̃ le alafa me");
    });

    // Currency is PREPOSED. ⚠ `dɔla` is the SERVANT (×3 on ee.wikipedia); the money word is `dɔlar` (×48).
    test("currency is preposed, and GH¢ outranks the bare ¢", () => {
        expect(normalizeEwe("$400")).toBe("dɔlar 400");
        expect(normalizeEwe("GH¢ 1")).toBe("cedi 1");
        expect(normalizeEwe("€200")).toBe("euro 200");
        expect(normalizeEwe("£7,500")).toBe("pound 7500");
    });

    // Units: the noun goes BEFORE the figure, which is Ewe's own order (`kilometa 240`, `meta 100`,
    // `milimeta 1,439`) and is why the shared postposing tier cannot express it (trap 47 reason 2).
    // ⚠ `km2` reads as the bare unit noun — this wiki's own way of writing an area — rather than leaving
    // the trap-53 "kilometres TWO" the ASCII exponent produces.
    test("units reorder to noun-first, and km2 does not become a number", () => {
        expect(normalizeEwe("5 km")).toBe("kilometa 5");
        expect(normalizeEwe("100,210 km2")).toBe("kilometa 100210");
        // …and the decimal step downstream then spaces the tail, since no point word is attested:
        expect(normalizeEwe("56.52m")).toBe("meta 56 5 2"); // a hammer-throw distance, ×6 in the corpus
        expect(normalizeEwe("$400mm")).toBe("dɔlar 400mm"); // a MAGNITUDE after a sign, not millimetres
        expect(normalizeEwe("5 kg")).toBe("5 kg"); // no kilogram word is attested — left raw, on purpose
    });

    // Ranges take `va ɖo`, whose bare numeric infix is the attested frame ("0.5 va ɖo 2 °C").
    // ⚠ THE THREE BRANCHES ARE PINNED SEPARATELY (trap 13): ascending claims, descending does not, and a
    // pair of SINGLE digits is refused because the corpus's are football and tennis SCORES, not spans.
    test("ranges: ascending only, never a score, never a scripture reference", () => {
        expect(normalizeEwe("1648-1654")).toBe("1648 va ɖo 1654");
        expect(normalizeEwe("7000–3300")).toBe("7000–3300"); // BCE, descending
        expect(normalizeEwe("7–6")).toBe("7–6"); // a tennis set — ascending pairs occur in the same list
        expect(normalizeEwe("Luka 19:28-44")).toBe("Luka 19:28-44"); // scripture; there is no clock rule
        expect(normalizeEwe("ISBN 0-582-49219-X")).toBe("ISBN 0-582-49219-X");
    });

    // De-grouping first, or the separator is read as clause punctuation and the tail as its own number.
    // The decimal point is REMOVED and the tail spaced: no Ewe point word is attested (see the header), so
    // what this fixes is the spurious SENTENCE BREAK, not the missing word.
    test("grouping is spent, and the decimal point stops being a pause", () => {
        expect(ee.text("51,446,201")).toBe("miliɔn blaatɔ̃ vɔ ɖeka k͡ple ak͡pe alafa ene k͡ple blaene vɔ ade k͡ple alafa eve k͡ple ɖeka");
        expect(normalizeEwe("10 955 000")).toBe("10955000");
        expect(normalizeEwe("0.5")).toBe("0 5");
        expect(normalizeEwe("44.4%")).toBe("44 4 le alafa me");
    });

    // Interior dots only — the letters are left where they were, because no letter-name table exists and no
    // era expansion is attested. ⚠ `\p{L}`, NOT the fleet's usual ASCII `[^\W\d_]`: Ewe's own era marker is
    // `D.M.Ŋ.` and ⟨Ŋ⟩ is not in `\w` even under the `u` flag (trap 1).
    test("dotted abbreviations lose their interior dots, including across ⟨Ŋ⟩", () => {
        expect(normalizeEwe("U.S.")).toBe("US.");
        expect(normalizeEwe("D.M.Ŋ.")).toBe("DMŊ.");
        expect(ee.text("3rd edition")).toBe("etɔ̃ edition"); // the English suffix no longer reaches the IPA
    });

    // The entity forms come first, or `&nbsp;` is read as "and" plus four letters — and two of this wiki's
    // are UNTERMINATED. `kple` is Ewe's ordinary coordinator.
    test("HTML entities before the ampersand, which reads kple", () => {
        expect(normalizeEwe("GH¢&nbsp;1")).toBe("cedi 1");
        // ⚠ THE `;` IS OPTIONAL — two of this wiki's entities are unterminated, and the substituted space
        // is left beside the original one rather than trimmed (a trim would erase a real boundary).
        expect(normalizeEwe("meter 3&nbsp (afɔ 10&nbsp)")).toBe("meter 3  (afɔ 10 )");
        expect(ee.text("Duncker & Humblot")).toBe("dunt͡sker k͡ple humblot");
    });

    // ⚠ AN ORDINARY EWE SENTENCE MUST SURVIVE ALL OF IT — the sample-tier question in one assertion.
    test("ordinary text is untouched", () => {
        const s = "Wodzi Ephraim le Peki-Avetile le Anyɔnyɔ 13 le ƒe 1899 me.";
        expect(normalizeEwe(s)).toBe(s);
    });
});
