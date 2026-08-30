/**
 * Hmong (White Hmong, RPA) text normalization. A numbered sequence of ORDER-DEPENDENT steps; each coupling
 * is stated in the TypeScript, whose header carries the whole evidential record — the two-convention
 * separator census, the sourcing for every emitted word (`feem pua`, `duas`, `mus rau`, `kis lus mev`), and
 * the priced refusals (the minus, the exponent, the coordinate `°`, the initialisms, the clock, the era).
 * Ported from src/languages/hmong/normalize.ts — see that file for the counts.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Hmong;

public static class Normalize
{
    /** The bare-token pass for the kilometre — a standalone `km` with no figure in reach. */
    private static readonly Func<string, string> BARE_UNITS = NormalizeSymbols.MakeBareUnitNormalizer(
        new[] { new KeyValuePair<string, string>("km", "kis lus mev") });

    // ── the patterns, in step order ─────────────────────────────────────────
    private static readonly JsRe NAMED_ENTITY = JsRegex.Compile("&nbsp;|&#(?:x[0-9a-f]+|\\d+);", "giu");
    /** The zero-width marks, spelled as escapes (a literal typed into a shell collapses to a space). */
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\\u200b\\u200c\\u200d\\u2060\\ufeff]", "gu");
    private static readonly JsRe DASH_FOLD = JsRegex.Compile("[\\u2014\\uff0d\\u2212]", "gu");
    private static readonly JsRe CURLY_QUOTES = JsRegex.Compile("[\\u2018\\u2019\\u201c\\u201d]", "gu");
    private static readonly JsRe KM2 = JsRegex.Compile("(?<![\\p{L}\\p{M}])km2(?![\\p{L}\\p{M}\\d])", "gu");

    /** ⚠ THE DISCRIMINATOR IS THE TAIL'S LENGTH, NOT THE MARK: both `,` and `.` group in threes and separate
     *  a 1–2-digit fractional tail, so each mark carries both a grouping arm and (in step 11) a decimal arm. */
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?![\\d]|,\\d)", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:\\.\\d{3})+)(?![\\d]|\\.\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");

    /** ⚠ THE LOOKBEHIND IS WHAT KEEPS THIS OFF A BARE TOKEN: `km` is claimed only in a numeric context. */
    private static readonly JsRe KM_READ =
        JsRegex.Compile("(?<=\\d\\s?|\\d\\s(?:lab|vam|roob)\\s)km\\u00b2?(?![\\p{L}\\p{M}\\d\\u00b2\\u00b3/])", "gu");
    private static readonly JsRe PERCENT =
        JsRegex.Compile("(?<![\\d.,])(\\d+(?:[.,]\\d+)?)\\s?%", "gu");
    private static readonly JsRe CURRENCY =
        JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])(?:US\\s?)?\\$\\s?(\\d+(?:[.,]\\d+)?)(\\s(?:lab|vam|roob)(?![\\p{L}\\p{M}]))?", "gu");
    /** ⚠ THE `i` FLAG: the corpus writes the scale letter in both cases. ONLY `C`/`F` — a compass direction
     *  beside a coordinate `°` is contentful and is left alone. */
    private static readonly JsRe DEGREE =
        JsRegex.Compile("(?<![\\d.,])(\\d+(?:[.,]\\d+)?)\\s?\\u00b0\\s?[CF](?![\\p{L}\\p{M}])", "gui");
    /** ⚠ GLUED PAIRS ONLY — both operands must be digit runs and neither side may touch a letter, which is
     *  what keeps this off the 124 hyphenated proper nouns and the 53 spaced apposition dashes. */
    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![\\d.,:\\p{L}\\p{M}-])(\\d+)[-\\u2013\\u2014](\\d+)(?![\\d.,\\p{L}\\p{M}-])", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s?&\\s?", "gu");
    private static readonly JsRe DECIMAL =
        JsRegex.Compile("(?<![\\d.,])(\\d+)[.,](\\d{1,2})(?![\\d\\p{L}\\p{M}])", "gu");

    /** Normalize one Hmong input string. Steps are ORDER-DEPENDENT; each coupling is stated in the TS. */
    public static string NormalizeHmong(string input)
    {
        // 1) NFC, HTML entities and zero-width marks, before anything else looks at a character.
        var s = Renormalize(input, NormalizationForm.FormC);
        s = Rewrite(s, NAMED_ENTITY, " ");
        s = Rewrite(s, ZERO_WIDTH, "");

        // 2) DASH FOLD, so step 9 can see the corpus's en dash; the curly quotes are dropped, as ASCII `"`
        //    already is. ⚠ NOT a blanket NFKC: that would turn `²` into `2` and re-create step 3's defect.
        s = Rewrite(s, DASH_FOLD, "-");
        s = Rewrite(s, CURLY_QUOTES, " ");

        // 3) THE ASCII EXPONENT, folded onto the real one, BEFORE de-grouping can split the operand.
        s = Rewrite(s, KM2, "km\u00b2");

        // 4) DIGIT DE-GROUPING, before every other numeric rule — both marks, by the tail-length discriminator.
        s = Rewrite(s, GROUP_COMMA, m => COMMAS.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_DOT, m => DOTS.Replace(m.Value, ""));

        // 5) THE KILOMETRE → `kis lus mev`, IN PLACE — after step 3 (km2 folded) and step 4 (grouped areas
        //    already one figure); a bare `km` with no figure is the shared bare-unit path.
        s = Rewrite(s, KM_READ, "kis lus mev");
        s = BARE_UNITS(s);

        // 6) PERCENT → `feem pua`, POSTPOSED — AFTER step 4 (a grouped percent is one number) and BEFORE step
        //    9, which is what makes `5-10%` come out right (the sign is on the right end only).
        s = Rewrite(s, PERCENT, "$1 feem pua");

        // 7) CURRENCY → `duas`, POSTPOSED, the magnitude kept BETWEEN the number and the noun. `US` is
        //    consumed (a stated limit); the leading guard is what forces the `US` arm on `US$30`.
        s = Rewrite(s, CURRENCY, m =>
            m.Groups[1].Value + (m.Groups[2].Success ? m.Groups[2].Value : "") + " duas");

        // 8) DEGREES — the sign AND the scale letter are consumed unread (no Hmong degree/scale word is
        //    attested): a downgrade from the letter `C` reaching the IPA raw to a silence, not a fix.
        s = Rewrite(s, DEGREE, "$1");

        // 9) RANGES → `mus rau`, ASCENDING only; AFTER step 6 (a percent span carries its word) and step 4
        //    (a grouped endpoint is one token).
        s = Rewrite(s, RANGE, m =>
            Js.Number(m.Groups[1].Value) < Js.Number(m.Groups[2].Value)
                ? $"{m.Groups[1].Value} mus rau {m.Groups[2].Value}"
                : m.Value);

        // 10) THE AMPERSAND → `thiab`, spaced on both sides deliberately: `A&B` deletes to `AB`, one token
        //     instead of two, so the replacement restores the boundary the sign was supplying.
        s = Rewrite(s, AMPERSAND, " thiab ");

        // 11) DECIMALS, LAST, after every rule that needs the number intact. BOTH marks, a tail of one or two
        //     digits; the separator becomes nothing and the fractional digits are spaced so the number path
        //     speaks them one at a time. The trailing letter guard is the version-dot guard for free.
        s = Rewrite(s, DECIMAL, m =>
            m.Groups[1].Value + " " + string.Join(" ", Js.CodePoints(m.Groups[2].Value)));

        return s;
    }
}
