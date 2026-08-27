// Porting shim, not a TS module: the handful of JavaScript string idioms the TS source leans on that
// have no one-token C# equivalent. Everything here mirrors the JS semantics EXACTLY (PORTING.md: the
// TS code's behaviour is the specification) — in particular code-point spreading `[...s]` and
// `String.prototype.replace(searchString, …)` replacing only the FIRST occurrence.

using System.Globalization;
using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class Js
{
    /// <summary>Port of `[...s]` / `Array.from(s)`: split into CODE POINTS (each astral pair stays one
    /// element; a lone surrogate becomes its own element, exactly as in JS).</summary>
    public static List<string> CodePoints(string s)
    {
        var outp = new List<string>(s.Length);
        for (var i = 0; i < s.Length; i++)
        {
            if (char.IsHighSurrogate(s[i]) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
            {
                outp.Add(s.Substring(i, 2));
                i++;
            }
            else outp.Add(s[i].ToString());
        }
        return outp;
    }

    /// <summary>The ECMAScript `WhiteSpace ∪ LineTerminator` set — the set `String.prototype.trim` strips
    /// AND the set `Number(s)` reads as 0, which are the same set. ⚠ IT IS NOT `char.IsWhiteSpace`, IN BOTH
    /// DIRECTIONS: .NET does not count U+FEFF (the BOM, which JS does) and does count U+0085 (which JS does
    /// not). Measured on wuu, whose engine tests `WUGNIU.test(input.trim())` as a whole-string fast path — a
    /// BOM-prefixed romanized reading took the fast path in Node and the English foreign reader in .NET, and
    /// a U+0085-prefixed one did the reverse.
    /// ⚠ ONE TABLE. `Sinitic.JsNumberIndex` carried a second copy of these same 21 code points; a table
    /// spelled twice is a table that drifts, which is the argument `normalize.ts` already makes for
    /// re-exporting `DIGITS` rather than redeclaring it.</summary>
    public static bool IsJsWhiteSpace(char c) =>
        c is '\t' or '\n' or '\v' or '\f' or '\r' or ' ' or '\u00A0' or '\u1680'
            or (>= '\u2000' and <= '\u200A') or '\u2028' or '\u2029' or '\u202F' or '\u205F'
            or '\u3000' or '\uFEFF';

    /// <remarks>
    /// ⚠ 23 BARE `.Trim()` CALL SITES REMAIN IN THIS TREE AND WERE AUDITED RATHER THAN SWEPT. A blind
    /// replacement would be a behaviour change wearing a cleanup's clothes, so each was classified:
    /// roughly half are DATA LOADERS (LoadTsv, the Afrikaans/Dutch morphology line readers, Core/Segment,
    /// the English dictionary, the Arabic diacritizer's line scan) and the rest run over engine text.
    /// A cross-engine differential over 86 gated languages x 8 BOM/NEL-bearing probes was byte-identical
    /// in the IPA column, so none of them diverges today.
    /// The loader half is safe for ONE reason — no file they read starts with a BOM — and that premise is
    /// now pinned by test/data-no-bom.test.ts rather than left as a coincidence. If it ever breaks, JS
    /// strips the mark from the first key and .NET keeps it, and one lexicon entry goes missing in C#
    /// alone, invisible to the gate unless a golden row happens to use that exact first headword.
    /// </remarks>
    /// <summary>Port of `s.trim()`. Use this, not `string.Trim()`, wherever the TS wrote `.trim()`.</summary>
    public static string Trim(string s)
    {
        var a = 0;
        var b = s.Length;
        while (a < b && IsJsWhiteSpace(s[a])) a++;
        while (b > a && IsJsWhiteSpace(s[b - 1])) b--;
        return s[a..b];
    }

    /// <summary>Port of `s.replace(search, replacement)` with a STRING first argument: replaces only
    /// the FIRST occurrence (C#'s string.Replace replaces all — a silent porting trap).</summary>
    public static string ReplaceFirst(string s, string search, string replacement)
    {
        var i = s.IndexOf(search, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + replacement + s[(i + search.Length)..];
    }

    /// <summary>Port of `str.codePointAt(0)` for a non-empty string.</summary>
    public static int CodePointAt0(string s) =>
        char.IsHighSurrogate(s[0]) && s.Length > 1 && char.IsLowSurrogate(s[1])
            ? char.ConvertToUtf32(s[0], s[1])
            : s[0];

    /// <summary>Port of `String.fromCodePoint(cp)`.</summary>
    public static string FromCodePoint(int cp) => char.ConvertFromUtf32(cp);

    /// <summary>Port of JS `String(n)` / number-to-string for a double that TS produced with integer
    /// arithmetic: integral values print without a decimal point, exactly as JS renders them.
    ///
    /// ⚠ THE `(long)` FAST PATH CANNOT COVER EVERY INTEGRAL DOUBLE, and the overflow is silent. A cast of
    /// 1e20 does not fit Int64 (max ≈9.22e18) and yields garbage digits, which the engines' digit-by-digit
    /// number fallbacks then read aloud one by one: ja's `99999999999999999999個` came out
    /// *kʲɯᵝːninisän…* where JS says *it͡ɕi* + れい×20. Every language whose out-of-range branch is
    /// `[...String(Math.abs(n))]` shares the path, and no golden carries a number that large, so the parity
    /// gate cannot see it.
    ///
    /// ⚠ AND JS DOES NOT PRINT THE EXACT BINARY EXPANSION. `String(123456789012345678901)` is
    /// "123456789012345680000", not the double's true value 123456789012345683968: it takes the SHORTEST
    /// round-trip digits and pads with zeros. Below 1e21 that is positional; at 1e21 and above JS switches
    /// to exponential ("1e+21"). Both are reproduced here from .NET's shortest-round-trip "R".</summary>
    public static string NumberToString(double n)
    {
        if (double.IsNaN(n)) return "NaN";
        if (double.IsPositiveInfinity(n)) return "Infinity";
        if (double.IsNegativeInfinity(n)) return "-Infinity";
        if (n != Math.Floor(n)) return JsExponentForm(n.ToString("R", CultureInfo.InvariantCulture));
        // Integral and inside Int64: the exact, cheap path.
        // ⚠ THE EXACT-CAST PATH STOPS AT 2^53, NOT AT Int64. Above 2^53 doubles are spaced more than 1
        // apart, and JS prints the SHORTEST round-trip rather than the exact value — String(2**62) is
        // "4611686018427388000", where the double really is 4611686018427387904 and a long cast would
        // print that. So the fast path is exactly the SAFE-INTEGER range, which is the same bound the TS
        // number paths already guard with isSafeInteger.
        if (Math.Abs(n) <= 9007199254740992.0) return ((long)n).ToString(CultureInfo.InvariantCulture);
        return JsExponentForm(n.ToString("R", CultureInfo.InvariantCulture));
    }

    /// <summary>.NET's shortest round-trip string → the form JS's `String(n)` would print. .NET writes
    /// "1E+20" where JS writes "100000000000000000000", and .NET's exponent threshold and casing differ
    /// from JS's; this rewrites the exponential form positionally when |exponent| puts JS in that mode.</summary>
    private static string JsExponentForm(string r)
    {
        var e = r.IndexOfAny(new[] { 'E', 'e' });
        if (e < 0) return r;
        var mantissa = r[..e];
        var exp = int.Parse(r[(e + 1)..], CultureInfo.InvariantCulture);
        var neg = mantissa.StartsWith('-');
        if (neg) mantissa = mantissa[1..];
        var dot = mantissa.IndexOf('.');
        var digits = dot < 0 ? mantissa : mantissa.Remove(dot, 1);
        var intLen = (dot < 0 ? mantissa.Length : dot) + exp; // digits before the point after scaling
        // JS prints positionally for 1e-7 < |n| < 1e21 and switches to exponential outside that range.
        if (intLen > 21 || exp < -6) return (neg ? "-" : "") + mantissa + (exp < 0 ? "e-" : "e+") + Math.Abs(exp);
        var sb = new System.Text.StringBuilder();
        if (neg) sb.Append('-');
        if (intLen <= 0)
        {
            sb.Append("0.");
            sb.Append('0', -intLen);
            sb.Append(digits);
        }
        else if (intLen >= digits.Length)
        {
            sb.Append(digits);
            sb.Append('0', intLen - digits.Length);
        }
        else
        {
            sb.Append(digits, 0, intLen).Append('.').Append(digits, intLen, digits.Length - intLen);
        }
        return sb.ToString();
    }

    /// <summary>Port of JS `Number(s)` for the numeral strings the engines parse out of text.
    ///
    /// ⚠ INVARIANT, ALWAYS. `double.Parse(s)` reads the AMBIENT culture, where "." can be a group
    /// separator and "," a decimal point — a language module parsing its own captured digits would then
    /// give a different number on a de-DE machine than on an en-US one, with nothing in the output to say
    /// why. Every call site gets it right by not having to remember. NaN for an unparseable string, as
    /// JS `Number()` gives.</summary>
    public static double Number(string s) =>
        double.TryParse(s, System.Globalization.NumberStyles.Float, CultureInfo.InvariantCulture, out var v)
            ? v
            : double.NaN;

    /**
     * THE 28 CODE POINTS JS LOWERCASES AND `ToLowerInvariant` DOES NOT (#1116).
     *
     * ⚠ MEASURED, NOT READ OFF A         [0x0130] = "\u0069\u0307",
        [0x1C89] = "\u1c8a",
        [0xA7CB] = "\u0264",
        [0xA7CC] = "\ua7cd",
        [0xA7DA] = "\ua7db",
        [0xA7DC] = "\u019b",
        [0x10D50] = char.ConvertFromUtf32(0x10D70),
        [0x10D51] = char.ConvertFromUtf32(0x10D71),
        [0x10D52] = char.ConvertFromUtf32(0x10D72),
        [0x10D53] = char.ConvertFromUtf32(0x10D73),
        [0x10D54] = char.ConvertFromUtf32(0x10D74),
        [0x10D55] = char.ConvertFromUtf32(0x10D75),
        [0x10D56] = char.ConvertFromUtf32(0x10D76),
        [0x10D57] = char.ConvertFromUtf32(0x10D77),
        [0x10D58] = char.ConvertFromUtf32(0x10D78),
        [0x10D59] = char.ConvertFromUtf32(0x10D79),
        [0x10D5A] = char.ConvertFromUtf32(0x10D7A),
        [0x10D5B] = char.ConvertFromUtf32(0x10D7B),
        [0x10D5C] = char.ConvertFromUtf32(0x10D7C),
        [0x10D5D] = char.ConvertFromUtf32(0x10D7D),
        [0x10D5E] = char.ConvertFromUtf32(0x10D7E),
        [0x10D5F] = char.ConvertFromUtf32(0x10D7F),
        [0x10D60] = char.ConvertFromUtf32(0x10D80),
        [0x10D61] = char.ConvertFromUtf32(0x10D81),
        [0x10D62] = char.ConvertFromUtf32(0x10D82),
        [0x10D63] = char.ConvertFromUtf32(0x10D83),
        [0x10D64] = char.ConvertFromUtf32(0x10D84),
        [0x10D65] = char.ConvertFromUtf32(0x10D85),. Every one of the 1,114,112 code points was lowercased in both
     * engines and the outputs diffed: JS maps 1,460 single code points to something else, .NET 1,432, and
     * the 28 below are the whole of the difference. There is no code point they map DIFFERENTLY — .NET is
     * only ever missing one — which is what makes a lookup the right shape.
     *
     * They are two distinct causes, and the issue that reported this named only the first:
     *   · **U+0130** İ LATIN CAPITAL LETTER I WITH DOT ABOVE is the one LENGTH-CHANGING SpecialCasing entry
     *     that applies unconditionally — it lowercases to `i` + U+0307, two code points. .NET returns it
     *     unchanged, so every greedy-scan engine that starts with `toLowerCase()` then met a character its
     *     grapheme table has never heard of and dropped it.
     *   · **THE OTHER 27 ARE UNICODE VERSION SKEW**, plain single-code-point mappings that .NET's table
     *     simply predates: U+1C89 (Cyrillic, Unicode 12), U+A7CB/CC/DA/DC (Latin Extended-D, 15–16) and the
     *     22 Garay capitals U+10D50–65 (16). Nothing special-cased about them; Node's ICU is just newer.
     *     ⚠ THIS LIST IS THEREFORE VERSION-BOUND. A .NET upgrade shrinks it and a Node upgrade may grow it;
     *     `JsToLowerCaseTests` re-runs the sweep so the file cannot drift silently.
     */
    private static readonly Dictionary<int, string> LOWER_EXTRA = new()
    {
        [0x0130] = "\u0069\u0307",
        [0x1C89] = "\u1c8a",
        [0xA7CB] = "\u0264",
        [0xA7CC] = "\ua7cd",
        [0xA7DA] = "\ua7db",
        [0xA7DC] = "\u019b",
        [0x10D50] = char.ConvertFromUtf32(0x10D70),
        [0x10D51] = char.ConvertFromUtf32(0x10D71),
        [0x10D52] = char.ConvertFromUtf32(0x10D72),
        [0x10D53] = char.ConvertFromUtf32(0x10D73),
        [0x10D54] = char.ConvertFromUtf32(0x10D74),
        [0x10D55] = char.ConvertFromUtf32(0x10D75),
        [0x10D56] = char.ConvertFromUtf32(0x10D76),
        [0x10D57] = char.ConvertFromUtf32(0x10D77),
        [0x10D58] = char.ConvertFromUtf32(0x10D78),
        [0x10D59] = char.ConvertFromUtf32(0x10D79),
        [0x10D5A] = char.ConvertFromUtf32(0x10D7A),
        [0x10D5B] = char.ConvertFromUtf32(0x10D7B),
        [0x10D5C] = char.ConvertFromUtf32(0x10D7C),
        [0x10D5D] = char.ConvertFromUtf32(0x10D7D),
        [0x10D5E] = char.ConvertFromUtf32(0x10D7E),
        [0x10D5F] = char.ConvertFromUtf32(0x10D7F),
        [0x10D60] = char.ConvertFromUtf32(0x10D80),
        [0x10D61] = char.ConvertFromUtf32(0x10D81),
        [0x10D62] = char.ConvertFromUtf32(0x10D82),
        [0x10D63] = char.ConvertFromUtf32(0x10D83),
        [0x10D64] = char.ConvertFromUtf32(0x10D84),
        [0x10D65] = char.ConvertFromUtf32(0x10D85),
    };

    /** Cheap pre-test so the common string keeps the single-pass `ToLowerInvariant` fast path. */
    private static bool NeedsLowerExtra(string s)
    {
        foreach (var c in s)
            if (c == '\u0130' || c == '\u1C89' || (c >= '\uA7CB' && c <= '\uA7DC') || char.IsHighSurrogate(c))
                return true;
        return false;
    }

    /** Substitute the missing mappings BEFORE the sigma pass — their outputs are already lowercase, so the
     *  `ToLowerInvariant` that follows is a no-op on them, and the Final_Sigma context test still sees the
     *  cased letters it needs (a combining dot above is case-IGNORABLE, so it does not break the run). */
    private static string ApplyLowerExtra(string s)
    {
        var sb = new StringBuilder(s.Length);
        for (var i = 0; i < s.Length; i++)
        {
            var cp = char.IsHighSurrogate(s[i]) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1])
                ? char.ConvertToUtf32(s[i], s[i + 1])
                : s[i];
            if (LOWER_EXTRA.TryGetValue(cp, out var rep)) sb.Append(rep);
            else sb.Append(char.ConvertFromUtf32(cp));
            if (cp > 0xFFFF) i++;
        }
        return sb.ToString();
    }

    /**
     * JS `String.prototype.toLowerCase`, which .NET's `ToLowerInvariant` is NOT.
     *
     * ⚠ THE DIFFERENCE IS THE GREEK FINAL SIGMA, and it is a real divergence rather than a nicety. JS
     * implements the Unicode SpecialCasing `Final_Sigma` condition, so `"ΠΟΙΟΣ".toLowerCase()` is `ποιος`
     * with ς. .NET returns `ποιοσ` with σ in EVERY culture — invariant, el-GR and current alike, all
     * checked. The Greek g2p's `isCons` excludes ς by name, so the two engines took different branches and
     * `ΠΟΙΟΣ` read `pios` in C# against `pços` in Node.
     *
     * `Final_Sigma`: Σ lowercases to ς when a cased letter precedes it (skipping case-ignorable characters)
     * and no cased letter follows it (likewise).
     *
     * ⚠ AND THE SIGMA IS NOT THE ONLY DIVERGENCE — there are 28, found by sweeping all 1,114,112 code
     * points through both engines rather than by reading the SpecialCasing table (#1116). See
     * `LOWER_EXTRA`.
     */
    public static string ToLowerCase(string s)
    {
        if (s.IndexOf('\u03a3') < 0 && !NeedsLowerExtra(s)) return s.ToLowerInvariant(); // the two agree
        s = ApplyLowerExtra(s);
        var lower = s.ToLowerInvariant().ToCharArray();
        for (var i = 0; i < s.Length; i++)
        {
            if (s[i] != '\u03a3') continue;
            if (CasedBefore(s, i) && !CasedAfter(s, i)) lower[i] = '\u03c2';
        }
        return new string(lower);
    }

    /**
     * ⚠ THESE TWO TAKE A CODE POINT, NOT A `char`, AND THAT IS A FIX RATHER THAN A STYLE (#1116).
     * `char.GetUnicodeCategory(char)` reports `Surrogate` for either half of a surrogate pair, so an ASTRAL
     * CASED LETTER counted as neither cased nor case-ignorable and the Final_Sigma context test silently
     * got the wrong answer beside one. Found by fuzzing 20,000 mixed strings against Node with the Garay
     * capitals (U+10D50–65) in the alphabet: 314 of them diverged, every one a Σ standing next to an astral
     * letter. The single-code-point sweep cannot see this class at all — it takes two characters to build.
     */
    private static bool IsCaseIgnorable(int cp)
    {
        var cat = CharUnicodeInfo.GetUnicodeCategory(char.ConvertFromUtf32(cp), 0);
        return cat is UnicodeCategory.NonSpacingMark
            or UnicodeCategory.EnclosingMark
            or UnicodeCategory.Format
            or UnicodeCategory.ModifierLetter
            or UnicodeCategory.ModifierSymbol
            || cp is '\'' or '\u2019' or '\u00b7' or '\u0387' or ':' or '.';
    }

    private static bool IsCased(int cp)
    {
        var cat = CharUnicodeInfo.GetUnicodeCategory(char.ConvertFromUtf32(cp), 0);
        return cat is UnicodeCategory.UppercaseLetter
            or UnicodeCategory.LowercaseLetter
            or UnicodeCategory.TitlecaseLetter;
    }

    /** The code point ENDING at `end` (exclusive), and where it starts — a surrogate pair counts as one. */
    private static (int Cp, int Start) CodePointBefore(string s, int end)
    {
        if (end >= 2 && char.IsLowSurrogate(s[end - 1]) && char.IsHighSurrogate(s[end - 2]))
            return (char.ConvertToUtf32(s[end - 2], s[end - 1]), end - 2);
        return (s[end - 1], end - 1);
    }

    private static bool CasedBefore(string s, int i)
    {
        for (var k = i; k > 0;)
        {
            var (cp, start) = CodePointBefore(s, k);
            k = start;
            if (IsCaseIgnorable(cp)) continue;
            return IsCased(cp);
        }
        return false;
    }

    private static bool CasedAfter(string s, int i)
    {
        for (var k = i + 1; k < s.Length;)
        {
            var pair = char.IsHighSurrogate(s[k]) && k + 1 < s.Length && char.IsLowSurrogate(s[k + 1]);
            var cp = pair ? char.ConvertToUtf32(s[k], s[k + 1]) : s[k];
            k += pair ? 2 : 1;
            if (IsCaseIgnorable(cp)) continue;
            return IsCased(cp);
        }
        return false;
    }
}
