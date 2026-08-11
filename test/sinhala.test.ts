import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/sinhala/sinhala.ts";
import { normalizeSinhala } from "../src/languages/sinhala/normalize.ts";

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
        expect(phonemizeWord("අක්ෂාංශ")).toBe("ˈaksaːŋsə"); // ෂ is /s/ too — see the sibilant test below
        expect(phonemizeWord("සිංහල")).toBe("sˈiŋhələ"); // the velar/h class still wins
        expect(phonemizeWord("සංවිධාන")).toBe("sˈamʋid̪ʰˌaːnə"); // and a labial still falls to m
    });
});

// The review pass — trap 8, "probe the adversarial neighbour of every rule". Each of these was a defect
// until the probe found it.
describe("Sinhala normalization: the review pass", () => {
    it("a truncated decimal keeps its dot out of the pause channel", () => {
        // `ස්කන්ධයෙන් .9%` writes 0.9% without the zero; the dot survived the percent rule as a full stop.
        expect(phonemize("ස්කන්ධයෙන් .9% ක්", "si")).not.toContain(" . ");
        // …but the corpus's missing-space-after-a-full-stop MUST stay a pause. All twelve are glued.
        expect(phonemize("ඇත.2011 සහ", "si")).toContain(" . ");
        expect(phonemize("අවු.18 අඩු", "si")).toContain(" . ");
    });

    it("kelvin takes no degree word, and only when space-separated", () => {
        expect(phonemize("90 K", "si")).toBe("kˈelʋin ˈanuːw");
        expect(phonemize("5K", "si")).not.toContain("kˈelʋin"); // a glued designation
        expect(phonemize("1990 K.M.", "si")).not.toContain("kˈelʋin"); // an initial
    });

    it("an abbreviation glued to its year still separates", () => {
        // ×1 in the corpus: `ක්‍රි.ව.1940 දී පමණ`.
        expect(phonemize("ක්‍රි.ව.1940", "si")).toBe(phonemize("ක්‍රි.ව. 1940", "si"));
    });
});

// ⚠ THE REVIEW'S REAL FIND. Every abbreviation key is bounded on both sides, because the corpus's commonest
// dot is a sentence period with NO SPACE after it and Sinhala has ordinary words starting with each of these
// second syllables. Unguarded, `නගරයකි.මීගමුව` (මීගමුව is a city, and it is in this corpus) read as
// *නගරයකිලෝමීටර් ගමුව* — a clause break destroyed and two words corrupted. Invisible in the 448 mined
// segments; a fact about the 191,335-paragraph dump they sample.
describe("Sinhala abbreviation keys cannot cross a sentence boundary", () => {
    it("a missing space after a full stop is still a pause, not an abbreviation", () => {
        for (const s of ["ලංකාවේ නගරයකි.මීගමුව", "මෙය හැකි.මීටර් 400", "තරු. 500 ක්", "ශක්‍රි.වචන"])
            expect(phonemize(s, "si")).toContain(" . ");
    });

    it("…and the genuine abbreviations still expand", () => {
        expect(normalizeSinhala("ක්‍රි.පූ. 29")).toBe("ක්රිස්තු පූර්ව 29");
        expect(normalizeSinhala("2.8 සෙ.මී. ඝන වානේ")).toBe("2 දශම 8 සෙන්ටිමීටර් ඝන වානේ");
        expect(normalizeSinhala("පැයට කි.මී. 250 ක්")).toBe("පැයට කිලෝමීටර් 250 ක්");
        expect(normalizeSinhala("ඇ.ඩො. මිලියන 7.4")).toBe("ඇමෙරිකානු ඩොලර් මිලියන 7 දශම 4");
        expect(normalizeSinhala("රු. 500")).toBe("රුපියල් 500");
    });
});

// The sibilants, settled by a four-way control against the referee after the web sources turned out to
// disagree with each other AND with the engine. r12a's script notes give ශ and ෂ both as /ʃ/; Wikipedia's
// phonology says /ʃ/ is a learned-borrowing phoneme "commonly … replaced by /s/". Both agree the two miśra
// letters are the SAME sound; the engine shipped ශ→s with ෂ→ʃ, which is neither analysis.
describe("Sinhala sibilants: ශ, ෂ and ස are all /s/", () => {
    it("ෂ is /s/ — the referee is 9 of 9 on it", () => {
        expect(phonemizeWord("ඖෂධය")).toBe("ˈaᶷsəd̪ʰˌəjə"); // referee: a u s ə d ə j ə
        expect(phonemizeWord("පුරුෂ")).toBe("pˈurusə"); // referee: p u ɾ u s ə
        expect(phonemizeWord("විෂ්ණු")).toBe("ʋˈisnu"); // referee: ʋ i s ɳ u
    });

    it("ශ is /s/ too — including ශ්‍රී, the word cited as THE example of Sinhala /ʃ/", () => {
        expect(phonemizeWord("ශ්‍රී")).toBe("srˈiː"); // referee: s r iː
        expect(phonemizeWord("මිශ්‍ර")).toBe("mˈisrə"); // referee: m i s r ə
    });

    it("a geminate sibilant still lengthens", () => {
        expect(phonemizeWord("පස්ස")).toBe("pˈasːə"); // referee: p a sː ə
    });
});
