/**
 * Occitan (oc) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/oc.jsonc` — oc.wikipedia dump, 393,961 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 157,616 · `year` 156,751 · `abbrev` 53,958 ·
 * `roman` 29,634 · `ranges` 22,189 · `ordinal-latin` 21,189 · `signs` 10,249 · `decimals` 8,826 ·
 * `percent` 4,385 · `dotted` 4,147 · `units` 3,685 · `clock` 1,222 · `fractions` 1,267 · `degrees` 953 ·
 * `rate` 566 · `era-marker` 256 · `currency` 108.
 *
 * ⚠ `>` IS A TAXONOMIC RANK CHAIN, AND THAT IS A FIFTH DISTINCT SENSE IN THIS SWEEP. All 47 instances in
 * the retained text are one string, repeated down a mammal article's classification box:
 *
 *     Eucariòtas > Metazoaris > Cordats > Craniats > vertebrats > Euteleostòms > Mamifèrs > Euteriats
 *     > Carnivora > Fissipedia > Canidae
 *
 * gd's `>` was a LaTeX fragment, tk's a typo for ⟨ş⟩, shn's a SOUND-CHANGE ARROW, la's a genuine
 * comparison (`si summa > 11 sit`), and this is a rank separator. Zero are comparisons here; the sign is
 * refused and registered.
 *
 * ⚠ THE SEPARATORS ARE SIMPLER THAN THE NEIGHBOUR'S, and worth stating because Asturian was treated one
 * round earlier and is NOT the same: oc groups with the SPACE only (`19 042 936 estatjants`,
 * `21 680 974`, `250 000 per an`, `1 275 207 abitants`, `518 536`) and decimates with BOTH marks — the
 * comma in its own prose (`38,5-38,7 °C`, `13,1°C`, `5,2°C`, `-20,4°C`) and the dot in imported figures
 * (`1640.93 abitants`). No dot ever groups here, so the three-digit test Asturian needs is not needed and
 * would be wrong: `1640.93` has two digits after the dot and `1.640` would have three, but the corpus
 * writes neither. Both marks fold onto the comma the engine's number branch reads.
 *
 * ⚠ AND ONE DEGREE SIGN IS A BIBLIOGRAPHIC FORMAT. `Les Troubadours cantaliens XII-XXe siècle, 1910,
 * Bloud et Gay, , 2 in-12°, 645 et 577 p.` — `in-12°` is DUODECIMO, a book size, and reading it as twelve
 * degrees is the trap-56 shape. The rule carries a lookbehind for it; the corpus's other degrees are
 * temperatures (`100°C`, `0°C`, `13,1°C`) and one field of vision (`Son camp de vision de 250°`).
 *
 * ⚠ THE ERA MARKER IS WRITTEN TWO WAYS AND THE ENGINE READS IT AS A WORD. `abC` and `avC` — *abans
 * Crist* and its Provençal spelling — in "Entre 5500 e 4000 abC", "A partir de 3500 abC", "(2900-2750
 * abC)", "Erodòt (484-425 avC)". Occitan's TOKEN admits the hyphen and treats a letter run as a word, so
 * `abC` was reaching the g2p as the syllable [abk] rather than as three letters, which is why no leak
 * gate saw it.
 *
 * ⚠ THERE IS NO CENTURY POLICY, for the same reason Asturian has none: `sègle XX` and `sègle XII` are
 * ×153 in the retained text and the corpus never spells one out. The shared cardinal pass reads *sègle
 * vint*. Recorded, not guessed.
 *
 * SOURCING — every word emitted is an oc.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/oc.jsonc`.
 */

/** ⚠ NEVER `\b` — Occitan carries `à è ò ó ç ï ú` and the interpunct, which `\b` treats as boundaries. */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Occitan;

public static class Normalize
{
    private const string NOT_BEFORE = "(?<![\\p{L}\\p{M}])";
    private const string NOT_AFTER = "(?![\\p{L}\\p{M}])";

    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])(\\d{1,3})((?:[    ]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe GROUP_SEPS = JsRegex.Compile("[    ]", "gu");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<!\\d)(\\d+)\\.(\\d+)(?!\\d)", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile($"{NOT_BEFORE}a[bv]\\.?\\s?C\\.?{NOT_AFTER}", "gu");
    private static readonly JsRe ERA_AD = JsRegex.Compile($"{NOT_BEFORE}ap\\.?\\s?C\\.?{NOT_AFTER}", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-4]):([0-5]\\d)(?![\\d:.,])", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-−–]\\s?(\\d)", "gu");
    private static readonly JsRe DEG_SCALE = JsRegex.Compile("(?<!in-\\d{0,3})(\\d)\\s?°\\s?([CF])(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_MIN = JsRegex.Compile("(?<!in-\\d{0,3})(\\d)\\s?°\\s?(\\d+)\\s?[′']", "gu");
    private static readonly JsRe DEG = JsRegex.Compile("(?<!in-\\d{0,3})(\\d)\\s?°", "gu");
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile(
        "(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Occitan input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeOccitan(string input)
    {
        var s = input;

        // 1) SEPARATORS. The SPACE groups and BOTH marks decimate — see the header. ⚠ THE WHOLE NUMBER IS
        //    MATCHED AT ONCE, not one join per pass (trap 63), and the trailing guard rejects a DIGIT and
        //    nothing else, or every clause-final figure is declined (trap 58).
        s = SPACE_GROUP.Replace(s, m => m.Groups[1].Value + GROUP_SEPS.Replace(m.Groups[2].Value, ""));
        //    ⚠ AND THE DOT DECIMAL FOLDS ONTO THE COMMA, unconditionally — unlike Asturian, no dot in this
        //    corpus ever groups, so the three-digit test that language needs would be wrong here.
        s = DOT_DECIMAL.Replace(s, "$1,$2");

        // 2) THE ERA MARKER, in both spellings. ⚠ IT IS NOT A LEAK, WHICH IS WHY NO GATE SAW IT: Occitan's
        //    TOKEN treats a letter run as a word, so `abC` reached the g2p as the syllable [abk].
        s = ERA_BC.Replace(s, "abans Crist");
        s = ERA_AD.Replace(s, "après Crist");

        // 3) THE CLOCK. The colon is clause punctuation in occitan.ts, so `12:30 h` read as *dotze , trenta*.
        //    The writer supplies the `h`, so the figures are left as figures and only the colon is spent.
        s = CLOCK.Replace(s, "$1 $2");

        // 4) SIGNS, before the range rule spends the hyphen. The corpus's climate prose writes `-20,4°C`.
        s = MINUS.Replace(s, "$1mens $2");

        // 5) DEGREES. ⚠ WITH A LOOKBEHIND FOR THE BIBLIOGRAPHIC FORMAT — `2 in-12°` is DUODECIMO, a book
        //    size, and reading it as twelve degrees is a defect that produces a READING (trap 56).
        //    ⚠ AND THE LOOKBEHIND HAS TO SPAN THE WHOLE FIGURE: `(?<!in-)` tests the three characters before
        //    the LAST DIGIT and passes on `in-12°`. `(?<!in-\d{0,3})` is variable-length.
        //    `graus` ×17 is the attested plural. ⚠ `gras` ×156 scores far higher and is NOT used: it is the
        //    homograph meaning "fat", the Fula `tere` shape.
        s = DEG_SCALE.Replace(s, m =>
            $"{m.Groups[1].Value} graus {(m.Groups[2].Value.ToUpperInvariant() == "C" ? "Celsius" : "Fahrenheit")}");
        s = DEG_MIN.Replace(s, "$1 graus $2 minutas ");
        s = DEG.Replace(s, "$1 graus ");

        // 6) RANGES. The dash was dropped and the endpoints fused. ⚠ THE DASH IS SPENT ON A PAUSE RATHER
        //    THAN A CONNECTIVE: Occitan writes `entre X e Y` in full where it means it, so imposing the
        //    connective on a bare dash would double a word the writer already chose or not.
        //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58), and a chain of three or more
        //    hyphen-joined groups is an identifier rather than a span.
        s = DASH_RANGE.Replace(s, "$1, ");
        s = HYPHEN_RANGE.Replace(s, "$1, $2");

        // A padded replacement doubles a space that was already there. Harmless downstream because
        // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
        // producing candidates for it.
        return MULTI_SPACE.Replace(s, " ");
    }
}
