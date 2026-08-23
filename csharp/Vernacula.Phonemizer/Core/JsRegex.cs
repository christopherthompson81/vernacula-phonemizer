// ⚠ THE SINGLE MOST SAFETY-CRITICAL FILE IN THE PORT (PORTING.md, regex section).
//
// NO JavaScript pattern in this codebase is hand-translated. Every regex call site passes the TS
// pattern string VERBATIM to JsRegex.Compile, and this file is the one place where JS regex
// semantics are mapped onto .NET's. The mapping is a TRANSLATOR, not an engine: it rewrites the
// pattern source, then hands it to System.Text.RegularExpressions.
//
// The rewrites, and why each exists:
//   \d \D      -> [0-9] / [^0-9].       JS \d is ASCII-ONLY; .NET \d matches every Unicode Nd digit.
//                                       The engine's native-digit handling DEPENDS on \d not matching
//                                       Devanagari/Bengali/Arabic digits (see core/unicode.ts).
//   \w \W      -> [A-Za-z0-9_] classes. Same ASCII-vs-Unicode split.
//   \b \B      -> lookaround emulation over the ASCII \w definition (JS \b is defined via JS \w).
//                 Inside a character class, JS \b is BACKSPACE (U+0008).
//   \s \S      -> the exact ECMAScript WhiteSpace+LineTerminator set. .NET \s includes U+0085 and
//                 excludes U+FEFF; JS is the reverse. [\s\S] ("anything") becomes (?s:.).
//   \p{Script=X} -> explicit character classes from UnicodeScripts (generated from the SAME engine
//                 truth the TS runs on). .NET has no Script properties, and \p{IsX} blocks are NOT
//                 scripts. Inside a class the BMP ranges are spliced in and any astral ranges are
//                 OR-ed around the class as surrogate-pair alternations.
//   \p{L} etc. -> passed through: .NET general categories agree with JS on the BMP (astral letters
//                 differ -- .NET regexes are code-unit based -- accepted and documented).
//   \u{...}    -> \uXXXX, or a (?:surrogate pair) group for astral code points.
//   .          -> the class of everything except the four JS line terminators (LF CR LS PS) --
//                 .NET dot excludes only LF -- unless the s flag is set (both match everything).
//   $          -> \z when the m flag is absent (JS $ is hard end-of-string; .NET $ also matches
//                 before a trailing newline).
//   astral literal (surrogate pair) outside a class -> wrapped in (?:...) so a quantifier applies to
//                 the whole code point as it does under the JS u flag; inside a class -> THROW.
//
// ⚠ ANYTHING OUTSIDE THIS SUBSET THROWS AT Compile() TIME. v-flag patterns, unknown \p{} names,
// in-class \D/\W/\S (other than [\s\S]), negated classes containing Script references, unknown alpha
// escapes: loud at construction beats silent at match time.
//
// Flags: g/y are call-site semantics captured on the JsRe wrapper (JS String.replace with a non-g
// regex replaces the FIRST match only; .NET Regex.Replace replaces all -- JsRe.Replace honours the
// JS rule). i -> IgnoreCase|CultureInvariant, s -> Singleline, m -> Multiline, u -> no-op (the
// rewrites above encode u semantics), d -> no-op, v -> THROW.

using System.Text;
using System.Text.RegularExpressions;

namespace Vernacula.Phonemizer.Core;

/// <summary>A compiled JS regex: the translated .NET Regex plus the JS-side flags that are call-site
/// semantics (g, y) rather than pattern semantics.</summary>
public sealed class JsRe
{
    internal JsRe(Regex re, bool global, bool sticky, string source, string flags)
    {
        Re = re;
        Global = global;
        Sticky = sticky;
        Source = source;
        Flags = flags;
    }

    public Regex Re { get; }
    public bool Global { get; }
    public bool Sticky { get; }
    public string Source { get; }
    public string Flags { get; }

    public bool IsMatch(string input) => Re.IsMatch(input);

    public Match Match(string input) => Re.Match(input);

    /// <summary>All matches (JS matchAll / g-flag iteration).</summary>
    public MatchCollection Matches(string input) => Re.Matches(input);

    /// <summary>JS `String.prototype.replace(re, replacement)`: all matches when the regex is g,
    /// otherwise the FIRST match only. .NET substitution syntax ($1, ${name}, $&amp;) matches JS's for
    /// the forms this codebase uses; JS's literal "$0" (no group-0 substitution in JS) is refused.</summary>
    public string Replace(string input, string replacement)
    {
        if (replacement.Contains("$0"))
            throw new ArgumentException("JsRe.Replace: \"$0\" is a literal in JS but group 0 in .NET - rewrite the call site");
        return Global ? Re.Replace(input, replacement) : Re.Replace(input, replacement, 1);
    }

    /// <summary>JS `String.prototype.replace(re, callback)`: all matches when g, else first only.</summary>
    public string Replace(string input, MatchEvaluator evaluator) =>
        Global ? Re.Replace(input, evaluator) : Re.Replace(input, evaluator, 1);
}

public static class JsRegex
{
    private static readonly Dictionary<(string, string), JsRe> Cache = new();
    private static readonly object Gate = new();

    /// <summary>Translate + compile a VERBATIM JavaScript pattern. Memoized, so per-call-site
    /// construction in the TS (e.g. patterns built from template strings) stays cheap here.</summary>
    public static JsRe Compile(string pattern, string flags = "")
    {
        lock (Gate)
        {
            if (Cache.TryGetValue((pattern, flags), out var hit)) return hit;
            var re = CompileUncached(pattern, flags);
            Cache[(pattern, flags)] = re;
            return re;
        }
    }

    /// <summary>JS `text.matchAll(re)` (requires g in JS; here Matches already is "all").</summary>
    public static MatchCollection MatchAll(JsRe re, string input) => re.Matches(input);

    /// <summary>JS replace-with-callback, honouring g vs non-g.</summary>
    public static string Replace(string input, JsRe re, MatchEvaluator evaluator) =>
        re.Replace(input, evaluator);

    /// <summary>Sticky (y) helper: match anchored EXACTLY at <paramref name="index"/> or fail
    /// (the JsRe must have been compiled with the y flag -- Compile prepends \G for it).</summary>
    public static Match? ExecAt(JsRe re, string input, int index)
    {
        if (!re.Sticky) throw new ArgumentException("ExecAt requires a sticky (y) regex");
        var m = re.Re.Match(input, index);
        return m.Success ? m : null;
    }

    private static JsRe CompileUncached(string pattern, string flags)
    {
        var options = RegexOptions.CultureInvariant | RegexOptions.Compiled;
        bool global = false, sticky = false, singleline = false, multiline = false;
        foreach (var f in flags)
        {
            switch (f)
            {
                case 'g': global = true; break;
                case 'y': sticky = true; break;
                case 'i': options |= RegexOptions.IgnoreCase; break;
                case 's': options |= RegexOptions.Singleline; singleline = true; break;
                case 'm': options |= RegexOptions.Multiline; multiline = true; break;
                case 'u': break; // the rewrites encode u-flag semantics
                case 'd': break; // match indices: .NET Match carries them anyway
                case 'v': throw new NotSupportedException($"JsRegex: v-flag pattern not supported (needs per-pattern review): /{pattern}/{flags}");
                default: throw new NotSupportedException($"JsRegex: unknown flag '{f}' in /{pattern}/{flags}");
            }
        }
        var translated = Translate(pattern, singleline, multiline);
        if (sticky) translated = @"\G(?:" + translated + ")";
        return new JsRe(new Regex(translated, options), global, sticky, pattern, flags);
    }

    // The exact ECMAScript \s set (WhiteSpace + LineTerminator): note U+FEFF in, U+0085 out --
    // the reverse of .NET's \s on both counts.
    private const string JsWhitespaceInner = "\\t\\n\\v\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF";
    private const string AsciiWordInner = "A-Za-z0-9_";
    private const string WordBoundary =
        "(?:(?<![A-Za-z0-9_])(?=[A-Za-z0-9_])|(?<=[A-Za-z0-9_])(?![A-Za-z0-9_]))";
    private const string NonWordBoundary =
        "(?:(?<=[A-Za-z0-9_])(?=[A-Za-z0-9_])|(?<![A-Za-z0-9_])(?![A-Za-z0-9_]))";

    // .NET general categories that agree with JS \p{...} on the BMP and pass through unchanged.
    private static readonly HashSet<string> PassThroughCategories = new()
    {
        "L", "Lu", "Ll", "Lt", "Lm", "Lo",
        "M", "Mn", "Mc", "Me",
        "N", "Nd", "Nl", "No",
        "P", "Pc", "Pd", "Ps", "Pe", "Pi", "Pf", "Po",
        "S", "Sm", "Sc", "Sk", "So",
        "Z", "Zs", "Zl", "Zp",
        "C", "Cc", "Cf", "Co", "Cn",
    };

    internal static string Translate(string pattern, bool singleline, bool multiline)
    {
        var sb = new StringBuilder(pattern.Length + 16);
        var i = 0;
        var n = pattern.Length;
        while (i < n)
        {
            var c = pattern[i];
            if (c == '\\')
            {
                i = AppendEscape(pattern, i, sb, inClass: false, classAstral: null);
                continue;
            }
            if (c == '[')
            {
                i = TranslateClass(pattern, i, sb);
                continue;
            }
            if (c == '.')
            {
                // JS dot excludes ALL FOUR line terminators; .NET dot only \n. Under s both match everything.
                sb.Append(singleline ? "." : "[^\\u000A\\u000D\\u2028\\u2029]");
                i++;
                continue;
            }
            if (c == '$' && !multiline)
            {
                // JS $ (no m) is hard end-of-string; .NET $ also matches before a trailing \n.
                sb.Append("\\z");
                i++;
                continue;
            }
            if (char.IsHighSurrogate(c))
            {
                if (i + 1 >= n || !char.IsLowSurrogate(pattern[i + 1]))
                    throw new NotSupportedException($"JsRegex: lone surrogate in pattern: {pattern}");
                // Group the pair so a following quantifier applies to the whole code point (u-flag JS does).
                sb.Append("(?:").Append(c).Append(pattern[i + 1]).Append(')');
                i += 2;
                continue;
            }
            sb.Append(c);
            i++;
        }
        return sb.ToString();
    }

    /// <summary>Translate one character class `[...]`. Script references contribute their BMP ranges
    /// in place; their astral ranges are collected and OR-ed around the finished class, which is only
    /// legal for a POSITIVE class (a negated class with a script reference throws).</summary>
    private static int TranslateClass(string pattern, int start, StringBuilder sbOut)
    {
        var n = pattern.Length;
        var i = start + 1; // past '['
        var negated = i < n && pattern[i] == '^';
        if (negated) i++;
        var body = new StringBuilder();
        var astral = new List<string>();
        var first = true;
        // Detect the [\s\S] / [\S\s] "match anything" idiom before walking (JS-legal, .NET-untranslatable
        // in-class \S otherwise). It matches any single code UNIT here vs any code POINT under JS u —
        // an accepted, documented divergence for astral input.
        var closeIdx = FindClassEnd(pattern, i);
        var rawBody = pattern[i..closeIdx];
        if (!negated && (rawBody == "\\s\\S" || rawBody == "\\S\\s"))
        {
            sbOut.Append("(?s:.)");
            return closeIdx + 1;
        }
        while (i < n)
        {
            var c = pattern[i];
            if (c == ']' && !first)
            {
                i++;
                if (astral.Count == 0)
                {
                    sbOut.Append('[');
                    if (negated) sbOut.Append('^');
                    sbOut.Append(body).Append(']');
                }
                else
                {
                    if (negated)
                        throw new NotSupportedException(
                            $"JsRegex: negated class with an astral-bearing \\p{{Script=...}} cannot be translated: {pattern}");
                    sbOut.Append("(?:[").Append(body).Append(']');
                    foreach (var alt in astral) sbOut.Append('|').Append(alt);
                    sbOut.Append(')');
                }
                return i;
            }
            first = false;
            if (c == '\\')
            {
                i = AppendEscape(pattern, i, body, inClass: true, classAstral: astral);
                continue;
            }
            if (char.IsHighSurrogate(c))
                throw new NotSupportedException($"JsRegex: astral literal inside a character class: {pattern}");
            body.Append(c);
            i++;
        }
        throw new ArgumentException($"JsRegex: unterminated character class in {pattern}");
    }

    private static int FindClassEnd(string pattern, int i)
    {
        var n = pattern.Length;
        var first = true;
        while (i < n)
        {
            var c = pattern[i];
            if (c == '\\') { i += 2; first = false; continue; }
            if (c == ']' && !first) return i;
            first = false;
            i++;
        }
        throw new ArgumentException($"JsRegex: unterminated character class in {pattern}");
    }

    /// <summary>Translate one escape sequence starting at pattern[i] == '\\'. Appends to
    /// <paramref name="sb"/> (class BODY text when <paramref name="inClass"/>) and returns the index
    /// after the escape. Astral script ranges inside a class are pushed onto
    /// <paramref name="classAstral"/> for the class translator to OR in.</summary>
    private static int AppendEscape(string pattern, int i, StringBuilder sb, bool inClass, List<string>? classAstral)
    {
        var n = pattern.Length;
        if (i + 1 >= n) throw new ArgumentException($"JsRegex: trailing backslash in {pattern}");
        var e = pattern[i + 1];
        switch (e)
        {
            case 'd': sb.Append(inClass ? "0-9" : "[0-9]"); return i + 2;
            case 'D':
                if (inClass) throw new NotSupportedException($"JsRegex: in-class \\D not supported: {pattern}");
                sb.Append("[^0-9]");
                return i + 2;
            case 'w': sb.Append(inClass ? AsciiWordInner : "[" + AsciiWordInner + "]"); return i + 2;
            case 'W':
                if (inClass) throw new NotSupportedException($"JsRegex: in-class \\W not supported: {pattern}");
                sb.Append("[^" + AsciiWordInner + "]");
                return i + 2;
            case 's': sb.Append(inClass ? JsWhitespaceInner : "[" + JsWhitespaceInner + "]"); return i + 2;
            case 'S':
                if (inClass) throw new NotSupportedException($"JsRegex: in-class \\S not supported (except the [\\s\\S] idiom): {pattern}");
                sb.Append("[^" + JsWhitespaceInner + "]");
                return i + 2;
            case 'b':
                sb.Append(inClass ? "\\u0008" : WordBoundary); // in-class \b is BACKSPACE in JS
                return i + 2;
            case 'B':
                if (inClass) throw new NotSupportedException($"JsRegex: in-class \\B: {pattern}");
                sb.Append(NonWordBoundary);
                return i + 2;
            case 'p':
            case 'P':
                return AppendUnicodeProperty(pattern, i, sb, inClass, classAstral, negatedProp: e == 'P');
            case 'u':
                if (i + 2 < n && pattern[i + 2] == '{')
                {
                    var close = pattern.IndexOf('}', i + 3);
                    if (close < 0) throw new ArgumentException($"JsRegex: malformed \\u{{...}} in {pattern}");
                    var cp = Convert.ToInt32(pattern[(i + 3)..close], 16);
                    if (cp <= 0xFFFF)
                    {
                        sb.Append("\\u").Append(cp.ToString("X4"));
                    }
                    else if (inClass)
                    {
                        throw new NotSupportedException($"JsRegex: astral \\u{{...}} inside a character class: {pattern}");
                    }
                    else
                    {
                        var hi = 0xD800 + ((cp - 0x10000) >> 10);
                        var lo = 0xDC00 + ((cp - 0x10000) & 0x3FF);
                        sb.Append("(?:\\u").Append(hi.ToString("X4")).Append("\\u").Append(lo.ToString("X4")).Append(')');
                    }
                    return close + 1;
                }
                sb.Append("\\u"); // \uXXXX -- identical in .NET
                return i + 2;
            case 'k': // named backreference \k<name> -- identical syntax in .NET
            case 'n': case 'r': case 't': case 'f': case 'v': case '0':
            case 'x': // \xHH -- identical
            case 'c': // control escape \cX -- identical
                sb.Append('\\').Append(e);
                return i + 2;
            default:
                if (e >= '1' && e <= '9') // backreference
                {
                    sb.Append('\\').Append(e);
                    return i + 2;
                }
                if (char.IsAsciiLetter(e))
                    throw new NotSupportedException($"JsRegex: unrecognized escape \\{e} in {pattern}");
                if (char.IsHighSurrogate(e))
                {
                    if (i + 2 >= n || !char.IsLowSurrogate(pattern[i + 2]))
                        throw new NotSupportedException($"JsRegex: lone escaped surrogate in {pattern}");
                    if (inClass)
                        throw new NotSupportedException($"JsRegex: astral literal inside a character class: {pattern}");
                    sb.Append("(?:").Append(e).Append(pattern[i + 2]).Append(')');
                    return i + 3;
                }
                // Identity escape of punctuation/whitespace -- keep the backslash (harmless in .NET).
                sb.Append('\\').Append(e);
                return i + 2;
        }
    }

    private static int AppendUnicodeProperty(string pattern, int i, StringBuilder sb, bool inClass, List<string>? classAstral, bool negatedProp)
    {
        var n = pattern.Length;
        if (i + 2 >= n || pattern[i + 2] != '{')
            throw new NotSupportedException($"JsRegex: bare \\p without {{...}} in {pattern}");
        var close = pattern.IndexOf('}', i + 3);
        if (close < 0) throw new ArgumentException($"JsRegex: malformed \\p{{...}} in {pattern}");
        var name = pattern[(i + 3)..close];
        if (name.StartsWith("Script=", StringComparison.Ordinal) || name.StartsWith("sc=", StringComparison.Ordinal))
        {
            if (negatedProp)
                throw new NotSupportedException($"JsRegex: \\P{{Script=...}} not supported: {pattern}");
            var script = name[(name.IndexOf('=') + 1)..];
            if (inClass)
            {
                sb.Append(UnicodeScripts.BmpInner(script)); // throws on an unknown script
                var alt = UnicodeScripts.AstralAlt(script);
                if (alt is not null) classAstral!.Add(alt);
            }
            else
            {
                sb.Append(UnicodeScripts.Cls(script));
            }
            return close + 1;
        }
        if (name.StartsWith("Script_Extensions", StringComparison.Ordinal) || name.StartsWith("scx=", StringComparison.Ordinal))
            throw new NotSupportedException($"JsRegex: Script_Extensions not supported: {pattern}");
        if (!PassThroughCategories.Contains(name))
            throw new NotSupportedException($"JsRegex: unknown \\p{{{name}}} in {pattern}");
        sb.Append(negatedProp ? "\\P{" : "\\p{").Append(name).Append('}');
        return close + 1;
    }
}
