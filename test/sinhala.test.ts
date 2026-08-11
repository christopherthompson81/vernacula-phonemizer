import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/sinhala/sinhala.ts";

describe("Sinhala abugida g2p", () => {
    it("schwa alternation (inherent a ↔ ə)", () => {
        const cases: [string, string][] = [
            ["ගම", "ɡˈamə"], // first inherent a → a, final inherent → ə
            ["මම", "mˈamə"],
            ["ක", "kˈə"], // open monosyllable → ə
            ["නම්", "nˈam"], // closed monosyllable keeps a
            ["පාසල", "pˈaːsələ"], // non-first inherent → ə
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    it("geminates, dentals, and the ᶯ census primitive", () => {
        expect(phonemizeWord("අම්මා")).toBe("ˈamːaː"); // ම්ම geminate → mː
        expect(phonemizeWord("තාත්තා")).toBe("t̪ˈaːt̪ːaː"); // ත dental + ත්ත → t̪ː
        expect(phonemizeWord("අඬනවා")).toBe("ˈaᶯɖənˌəʋaː"); // ඬ → ᶯɖ (census primitive, preserved)
    });

    it("homorganic anusvara ං", () => {
        expect(phonemizeWord("සිංහල")).toBe("sˈiŋhələ"); // before h → ŋ
        expect(phonemizeWord("සංචාරක")).toBe("sˈaɲt͡ʃaːrˌəkə"); // before palatal → ɲ
        expect(phonemizeWord("සංවිධාන")).toBe("sˈamʋid̪ʰˌaːnə"); // before labial → m
    });

    it("coda / final ව → glide w", () => {
        expect(phonemizeWord("බව")).toBe("bˈaw"); // word-final ව → w
        expect(phonemizeWord("නිව්ටන්")).toBe("nˈiwʈən"); // coda ව් → w
        expect(phonemizeWord("කෘති")).toBe("krˈut̪i"); // vocalic-r ෘ → ru
    });

    it("stress: primary on syllable 1, secondary on even non-final nuclei", () => {
        expect(phonemizeWord("අතර")).toBe("ˈat̪ərə"); // 3 nuclei → no secondary
        expect(phonemizeWord("ඡායාරූප")).toBe("t͡ʃhˈaːjaːrˌuːpə"); // 4 nuclei → ˌ on nucleus 3
    });

    it("cardinal numbers", () => {
        expect(phonemize("5", "si")).toBe("pˈahə");
        expect(phonemize("10", "si")).toBe("d̪ˈahəjə");
        expect(phonemize("21", "si")).toBe("ʋˈisiˌekə");
        expect(phonemize("100", "si")).toBe("sˈijəjə");
    });
});

describe("Sinhala text normalization", () => {
    // The largest single repair in the language, and the one no defect class can see: `sinhala.ts`'s word
    // token is `[඀-෿]+`, which excludes U+200D, so every conjunct was two words (`ශ්‍රී` → *s rˈiː*).
    it("the zero-width joiner no longer splits a conjunct", () => {
        expect(phonemize("ක්‍රි", "si")).toBe("krˈi");
        expect(phonemize("ශ්‍රී ලංකා", "si")).toBe("srˈiː lˈaŋkaː");
        expect(phonemize("ප්‍රතිශතය", "si")).toBe("prˈat̪isˌət̪əjə");
        // …and a word this layer EMITS carries its own joiner, which step 12 has to strip too.
        expect(phonemize("ක්‍රි.ව. 1660", "si")).not.toContain("k ");
    });

    it("the decimal point and the grouping comma stop being pauses", () => {
        // Both were clause punctuation: `12.5` read *d̪ˈoləhə . pˈahə*, `2,400` *d̪ˈekə , …*.
        expect(phonemize("12.5", "si")).toBe("d̪ˈoləhə d̪ˈasəmə pˈahə");
        expect(phonemize("2,400", "si")).toBe("d̪ˈekə d̪ˈahəsə hˈat̪ərə sˈijəjə");
        // The fractional digits are said ONE AT A TIME, not as a number.
        expect(phonemize("0.25", "si")).toBe("bˈind̪uw d̪ˈasəmə d̪ˈekə pˈahə");
        // A dotted date and a version string are NOT decimals — the "exactly one dot" guard.
        expect(phonemize("2007.04.25", "si")).not.toContain("d̪ˈasəmə");
    });

    it("percent, currency and units all lead their number", () => {
        expect(phonemize("70%", "si")).toBe("sˈijəjˌəʈə hˈæt̪ːæːw");
        expect(phonemize("$5", "si")).toBe("ɖˈolər pˈahə");
        expect(phonemize("15 cm", "si")).toBe("sˈenʈimˌiːʈər pˈahəlow");
        // The magnitude hops with the sign and still precedes the number: *ඩොලර් බිලියන 7*.
        expect(phonemize("US$7 බිලියන", "si")).toBe("ˈæmerˌikaːnu ɖˈolər bˈilijˌənə hˈat̪ə");
    });

    it("degrees: both scale names, the compass letter, and U+2070 standing in for the sign", () => {
        expect(phonemize("20°C", "si")).toBe("sˈelsijəs ˈaŋsəkə ʋˈisːə");
        expect(phonemize("75 ° F", "si")).toBe("fˈærənhˌəjiʈ ˈaŋsəkə hˈæt̪ːæːpˌəhə");
        expect(phonemize("133 ⁰C", "si")).toBe("sˈelsijəs ˈaŋsəkə sˈijəjə t̪ˈist̪unə");
        expect(phonemize("32°N", "si")).toBe("ˈaŋsəkə t̪ˈisd̪ekə ˈut̪uru");
    });

    // The rule's BRANCHES, not the corpus's instances (trap 13): the sign is read only as U+2212, because
    // an ASCII hyphen before a digit is ×9 in this corpus and none of the nine is a negative.
    it("only U+2212 is a negative sign", () => {
        expect(phonemize("(−5)", "si")).toContain("rˈunə");
        expect(phonemize("වයස 0 -5", "si")).not.toContain("rˈunə");
        expect(phonemize("උපත -1918", "si")).not.toContain("rˈunə");
    });

    it("the rate claims a whole range and puts the number last", () => {
        expect(phonemize("120 km/h", "si")).toBe("pˈæjəʈə kˈiloːmˌiːʈər sˈijəjə ʋˈisːə");
        // The first version tore this in half — *35-පැයට කිලෝමීටර් 40*.
        expect(phonemize("35-40 km/h", "si")).toBe(
            "pˈæjəʈə kˈiloːmˌiːʈər t̪ˈispəhə hˈat̪əlˌihə",
        );
    });

    it("dotted abbreviations: the era pair, a measure, and initials — but never a sentence period", () => {
        expect(phonemize("ක්‍රි.පූ. 29", "si")).toBe("krˈist̪u pˈuːrw ʋˈisinˌəʋəjə");
        expect(phonemize("වර්ග කි.මී 65", "si")).toBe("ʋˈarɡə kˈiloːmˌiːʈər hˈæʈəpˌəhə");
        expect(phonemize("ජේ.ආර්.ජයවර්ධන", "si")).toBe("d͡ʒˈeː ˈaːr d͡ʒˈajəʋˌərd̪ʰənə");
        // A missing space after a full stop is the commonest dot in this corpus and MUST stay a pause.
        expect(phonemize("සිදු වේ.තව ද", "si")).toContain(" . ");
    });
});

// NOT a normalization rule — a manifest gap this run exposed. `ං` before a SIBILANT was falling to the
// ම් default, and the referee refutes it (wikipron: පංසු = `p ə ŋ s u`, engine read *pˈamsu*). It matters
// here because the corpus writes `අක්ෂාංශ`/`දේශාංශ` in every coordinate sentence and the degree rule now
// EMITS `අංශක` for every `°`, so the gap would have been introduced rather than merely inherited.
describe("Sinhala anusvara before a sibilant", () => {
    it("ං + ශ/ෂ/ස → ŋ, not the ම් default", () => {
        expect(phonemizeWord("පංසු")).toBe("pˈaŋsu"); // the referee's own word
        expect(phonemizeWord("අංශක")).toBe("ˈaŋsəkə");
        expect(phonemizeWord("අක්ෂාංශ")).toBe("ˈakʃaːŋsə");
        expect(phonemizeWord("සිංහල")).toBe("sˈiŋhələ"); // the velar/h class still wins
        expect(phonemizeWord("සංවිධාන")).toBe("sˈamʋid̪ʰˌaːnə"); // and a labial still falls to m
    });
});
