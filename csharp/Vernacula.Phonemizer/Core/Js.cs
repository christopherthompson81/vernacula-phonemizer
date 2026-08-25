// Porting shim, not a TS module: the handful of JavaScript string idioms the TS source leans on that
// have no one-token C# equivalent. Everything here mirrors the JS semantics EXACTLY (PORTING.md: the
// TS code's behaviour is the specification) — in particular code-point spreading `[...s]` and
// `String.prototype.replace(searchString, …)` replacing only the FIRST occurrence.

using System.Globalization;

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
     * JS `String.prototype.toLowerCase`, which .NET's `ToLowerInvariant` is NOT.
     *
     * ⚠ THE DIFFERENCE IS THE GREEK FINAL SIGMA, and it is a real divergence rather than a nicety. JS
     * implements the Unicode SpecialCasing `Final_Sigma` condition, so `"ΠΟΙΟΣ".toLowerCase()` is `ποιος`
     * with ς. .NET returns `ποιοσ` with σ in EVERY culture — invariant, el-GR and current alike, all
     * checked. The Greek g2p's `isCons` excludes ς by name, so the two engines took different branches and
     * `ΠΟΙΟΣ` read `pios` in C# against `pços` in Node.
     *
     * `Final_Sigma`: Σ lowercases to ς when a cased letter precedes it (skipping case-ignorable characters)
     * and no cased letter follows it (likewise). Everything else is `ToLowerInvariant`.
     */
    public static string ToLowerCase(string s)
    {
        if (s.IndexOf('\u03a3') < 0) return s.ToLowerInvariant(); // no Σ ⇒ the two agree
        var lower = s.ToLowerInvariant().ToCharArray();
        for (var i = 0; i < s.Length; i++)
        {
            if (s[i] != '\u03a3') continue;
            if (CasedBefore(s, i) && !CasedAfter(s, i)) lower[i] = '\u03c2';
        }
        return new string(lower);
    }

    private static bool IsCaseIgnorable(char c)
    {
        var cat = char.GetUnicodeCategory(c);
        return cat is System.Globalization.UnicodeCategory.NonSpacingMark
            or System.Globalization.UnicodeCategory.EnclosingMark
            or System.Globalization.UnicodeCategory.Format
            or System.Globalization.UnicodeCategory.ModifierLetter
            or System.Globalization.UnicodeCategory.ModifierSymbol
            || c is '\'' or '\u2019' or '\u00b7' or '\u0387' or ':' or '.';
    }

    private static bool IsCased(char c)
    {
        var cat = char.GetUnicodeCategory(c);
        return cat is System.Globalization.UnicodeCategory.UppercaseLetter
            or System.Globalization.UnicodeCategory.LowercaseLetter
            or System.Globalization.UnicodeCategory.TitlecaseLetter;
    }

    private static bool CasedBefore(string s, int i)
    {
        for (var k = i - 1; k >= 0; k--)
        {
            if (IsCaseIgnorable(s[k])) continue;
            return IsCased(s[k]);
        }
        return false;
    }

    private static bool CasedAfter(string s, int i)
    {
        for (var k = i + 1; k < s.Length; k++)
        {
            if (IsCaseIgnorable(s[k])) continue;
            return IsCased(s[k]);
        }
        return false;
    }
}
