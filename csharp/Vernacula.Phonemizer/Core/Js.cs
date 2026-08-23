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
    /// arithmetic: integral values print without a decimal point, exactly as JS renders them.</summary>
    public static string NumberToString(double n) =>
        n == Math.Floor(n) && !double.IsInfinity(n)
            ? ((long)n).ToString(CultureInfo.InvariantCulture)
            : n.ToString("R", CultureInfo.InvariantCulture);
}
