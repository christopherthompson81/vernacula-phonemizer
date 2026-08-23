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

    /// <summary>All matches (JS matchAll / g-flag iteration).
    ///
    /// ⚠ NOT Regex.Matches. JS's global iteration has TWO different advance rules and .NET's has one:
    /// after a ZERO-LENGTH match under /u the next attempt starts a whole CODE POINT later, while
    /// after a FAILED attempt the engine steps one code UNIT (V8's actual behaviour, which .NET's
    /// internal scan already shares). A zero-width global pattern over astral text lands on different
    /// positions under each rule — measured on /(?&lt;![\p{L}])/gu, where Node reports 0 and 3 over two
    /// astral letters. Driving the loop here reproduces both rules exactly.</summary>
    public IReadOnlyList<Match> Matches(string input)
    {
        var found = new List<Match>();
        var pos = 0;
        while (pos <= input.Length)
        {
            var m = Re.Match(input, pos);
            if (!m.Success) break;
            found.Add(m);
            pos = m.Length > 0 ? m.Index + m.Length : NextIndex(input, m.Index, Unicode);
        }
        return found;
    }

    private bool Unicode => Flags.Contains('u');

    /// <summary>JS AdvanceStringIndex: one code point under /u, one code unit otherwise.</summary>
    internal static int NextIndex(string s, int i, bool unicode) =>
        unicode && i + 1 < s.Length && char.IsHighSurrogate(s[i]) && char.IsLowSurrogate(s[i + 1]) ? i + 2 : i + 1;

    /// <summary>JS `String.prototype.replace(re, replacement)`: all matches when the regex is g,
    /// otherwise the FIRST match only. .NET substitution syntax ($1, ${name}, $&amp;) matches JS's for
    /// the forms this codebase uses; JS's literal "$0" (no group-0 substitution in JS) is refused.</summary>
    public string Replace(string input, string replacement)
    {
        if (replacement.Contains("$0"))
            throw new ArgumentException("JsRe.Replace: \"$0\" is a literal in JS but group 0 in .NET - rewrite the call site");
        return Global
            ? ReplaceAll(input, m => m.Result(replacement))
            : Re.Replace(input, replacement, 1);
    }

    /// <summary>JS `String.prototype.replace(re, callback)`: all matches when g, else first only.</summary>
    public string Replace(string input, MatchEvaluator evaluator) =>
        Global ? ReplaceAll(input, evaluator) : Re.Replace(input, evaluator, 1);

    /// <summary>Global replace driven by the same JS advance rules as <see cref="Matches"/>.</summary>
    private string ReplaceAll(string input, MatchEvaluator evaluator)
    {
        var sb = new StringBuilder(input.Length);
        var copied = 0;
        foreach (var m in Matches(input))
        {
            sb.Append(input, copied, m.Index - copied).Append(evaluator(m));
            copied = m.Index + m.Length;
        }
        return sb.Append(input, copied, input.Length - copied).ToString();
    }
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
    public static IReadOnlyList<Match> MatchAll(JsRe re, string input) => re.Matches(input);

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
        bool global = false, sticky = false, singleline = false, multiline = false, unicode = false;
        foreach (var f in flags)
        {
            switch (f)
            {
                case 'g': global = true; break;
                case 'y': sticky = true; break;
                case 'i': options |= RegexOptions.IgnoreCase; break;
                case 's': options |= RegexOptions.Singleline; singleline = true; break;
                case 'm': options |= RegexOptions.Multiline; multiline = true; break;
                case 'u': unicode = true; break; // the rewrites encode u-flag semantics
                case 'd': break; // match indices: .NET Match carries them anyway
                case 'v': throw new NotSupportedException($"JsRegex: v-flag pattern not supported (needs per-pattern review): /{pattern}/{flags}");
                default: throw new NotSupportedException($"JsRegex: unknown flag '{f}' in /{pattern}/{flags}");
            }
        }
        var translated = Translate(pattern, singleline, multiline, unicode && options.HasFlag(RegexOptions.IgnoreCase), unicode);
        if (sticky) translated = @"\G(?:" + translated + ")";
        return new JsRe(new Regex(translated, options), global, sticky, pattern, flags);
    }

    // The exact ECMAScript \s set (WhiteSpace + LineTerminator): note U+FEFF in, U+0085 out --
    // the reverse of .NET's \s on both counts.
    private const string JsWhitespaceInner = "\\t\\n\\v\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF";
    private const string AsciiWordInner = "A-Za-z0-9_";

    // ⚠ CODE POINTS vs CODE UNITS — the deepest of the dialect gaps. Under /u JS matches one CODE
    // POINT at a time; .NET always matches one UTF-16 UNIT. So .NET's [^x] happily matches HALF of an
    // astral character, and \p{L} matches NEITHER half of an astral letter. Every "any character
    // except..." construct is therefore emitted as "a whole surrogate pair, OR a non-surrogate unit",
    // and every \p{...} gains its astral half as an alternation.
    private const string AstralPair = "[\uD800-\uDBFF][\uDC00-\uDFFF]";
    private const string NoSurrogate = "\uD800-\uDFFF";
    private const string WordBoundary =
        "(?:(?<![A-Za-z0-9_])(?=[A-Za-z0-9_])|(?<=[A-Za-z0-9_])(?![A-Za-z0-9_]))";
    private const string NonWordBoundary =
        "(?:(?<=[A-Za-z0-9_])(?=[A-Za-z0-9_])|(?<![A-Za-z0-9_])(?![A-Za-z0-9_]))";

    // ⚠ JS SIMPLE CASE FOLDING vs .NET IgnoreCase. Under /iu, JS folds with scf(), which equates a few
    // pairs .NET's IgnoreCase does not: /[a-z]/iu matches U+017F LATIN SMALL LETTER LONG S, /[ι]/iu
    // matches U+0345 COMBINING GREEK YPOGEGRAMMENI, and the pre-1918 Cyrillic letters U+1C80-U+1C88
    // fold onto their modern forms. The differential harness found this on real patterns (French,
    // Portuguese, Mindong and Lingala tokenizers all diverged on a long s); nothing in an ordinary
    // probe would surface it, which is why the probe set carries these characters deliberately.
    //
    // The map is MEASURED, not hand-written: every ordered pair (a, b) here is one where Node says
    // /[a]/iu matches b and .NET says it does not, taken over every case-equivalence group in the BMP
    // (tools/../scratchpad measurement, 94 pairs of 2,408). Adding b to the class body fixes both
    // polarities at once — a positive class gains the member, a negated class excludes it, which is
    // exactly what JS does. Note this is a lower bound: it can only find pairs whose members share a
    // toUpperCase().toLowerCase() key, which is scf for every case in Unicode's BMP fold table.
    private static readonly Dictionary<char, string> FoldExtras = new()
    {
        ['\u0053'] = "\u017F",   // S
        ['\u0073'] = "\u017F",   // s
        ['\u00B5'] = "\u039C\u03BC",   // µ
        ['\u017F'] = "\u0053\u0073",   // ſ
        ['\u0345'] = "\u0399\u03B9\u1FBE",   // ͅ
        ['\u0392'] = "\u03D0",   // Β
        ['\u0395'] = "\u03F5",   // Ε
        ['\u0398'] = "\u03D1",   // Θ
        ['\u0399'] = "\u0345\u1FBE",   // Ι
        ['\u039A'] = "\u03F0",   // Κ
        ['\u039C'] = "\u00B5",   // Μ
        ['\u03A0'] = "\u03D6",   // Π
        ['\u03A1'] = "\u03F1",   // Ρ
        ['\u03A3'] = "\u03C2",   // Σ
        ['\u03A6'] = "\u03D5",   // Φ
        ['\u03B2'] = "\u03D0",   // β
        ['\u03B5'] = "\u03F5",   // ε
        ['\u03B8'] = "\u03D1",   // θ
        ['\u03B9'] = "\u0345\u1FBE",   // ι
        ['\u03BA'] = "\u03F0",   // κ
        ['\u03BC'] = "\u00B5",   // μ
        ['\u03C0'] = "\u03D6",   // π
        ['\u03C1'] = "\u03F1",   // ρ
        ['\u03C2'] = "\u03A3\u03C3",   // ς
        ['\u03C3'] = "\u03C2",   // σ
        ['\u03C6'] = "\u03D5",   // φ
        ['\u03D0'] = "\u0392\u03B2",   // ϐ
        ['\u03D1'] = "\u0398\u03B8\u03F4",   // ϑ
        ['\u03D5'] = "\u03A6\u03C6",   // ϕ
        ['\u03D6'] = "\u03A0\u03C0",   // ϖ
        ['\u03F0'] = "\u039A\u03BA",   // ϰ
        ['\u03F1'] = "\u03A1\u03C1",   // ϱ
        ['\u03F4'] = "\u03D1",   // ϴ
        ['\u03F5'] = "\u0395\u03B5",   // ϵ
        ['\u0412'] = "\u1C80",   // В
        ['\u0414'] = "\u1C81",   // Д
        ['\u041E'] = "\u1C82",   // О
        ['\u0421'] = "\u1C83",   // С
        ['\u0422'] = "\u1C84\u1C85",   // Т
        ['\u042A'] = "\u1C86",   // Ъ
        ['\u0432'] = "\u1C80",   // в
        ['\u0434'] = "\u1C81",   // д
        ['\u043E'] = "\u1C82",   // о
        ['\u0441'] = "\u1C83",   // с
        ['\u0442'] = "\u1C84\u1C85",   // т
        ['\u044A'] = "\u1C86",   // ъ
        ['\u0462'] = "\u1C87",   // Ѣ
        ['\u0463'] = "\u1C87",   // ѣ
        ['\u1C80'] = "\u0412\u0432",   // ᲀ
        ['\u1C81'] = "\u0414\u0434",   // ᲁ
        ['\u1C82'] = "\u041E\u043E",   // ᲂ
        ['\u1C83'] = "\u0421\u0441",   // ᲃ
        ['\u1C84'] = "\u0422\u0442\u1C85",   // ᲄ
        ['\u1C85'] = "\u0422\u0442\u1C84",   // ᲅ
        ['\u1C86'] = "\u042A\u044A",   // ᲆ
        ['\u1C87'] = "\u0462\u0463",   // ᲇ
        ['\u1C88'] = "\uA64A\uA64B",   // ᲈ
        ['\u1E60'] = "\u1E9B",   // Ṡ
        ['\u1E61'] = "\u1E9B",   // ṡ
        ['\u1E9B'] = "\u1E60\u1E61",   // ẛ
        ['\u1FBE'] = "\u0345\u0399\u03B9",   // ι
        ['\uA64A'] = "\u1C88",   // Ꙋ
        ['\uA64B'] = "\u1C88",   // ꙋ
    };

    /// <summary>Characters to add to a class body (or a bare literal) so .NET's IgnoreCase reproduces
    /// JS's scf-based /i. Returns "" when the class touches none of the divergent characters.</summary>
    private static string FoldExtrasFor(string classBody)
    {
        Regex probe;
        try { probe = new Regex("[" + classBody + "]", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant); }
        catch (ArgumentException) { return ""; }   // body we cannot re-parse alone: leave it untouched
        var add = new StringBuilder();
        foreach (var (member, extras) in FoldExtras)
        {
            if (!probe.IsMatch(member.ToString())) continue;
            foreach (var extra in extras)
                if (!probe.IsMatch(extra.ToString()) && add.ToString().IndexOf(extra) < 0)
                    add.Append("\\u").Append(((int)extra).ToString("X4"));
        }
        return add.ToString();
    }

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

    /// <param name="foldWide">true only for /iu: legacy /i (no u) deliberately does NOT fold
    /// non-ASCII onto ASCII, so \u017F must stay out of [a-z] there — a real divergence the harness
    /// caught the moment the fold was applied unconditionally.</param>
    internal static string Translate(string pattern, bool singleline, bool multiline, bool foldWide = false, bool unicode = false)
    {
        var sb = new StringBuilder(pattern.Length + 16);
        var i = 0;
        var n = pattern.Length;
        while (i < n)
        {
            var c = pattern[i];
            if (c == '\\')
            {
                i = AppendEscape(pattern, i, sb, inClass: false, classAstral: null, unicode: unicode);
                continue;
            }
            if (c == '[')
            {
                i = TranslateClass(pattern, i, sb, foldWide, unicode);
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
            if (foldWide && FoldExtras.ContainsKey(c))
            {
                // A BARE LITERAL needs the same treatment: JS /s/iu matches a long s. Wrapping in a
                // class keeps a following quantifier applying to the one character, as it did before.
                var extras = FoldExtrasFor(Regex.Escape(c.ToString()));
                if (extras.Length > 0) { sb.Append('[').Append(Regex.Escape(c.ToString())).Append(extras).Append(']'); i++; continue; }
            }
            sb.Append(c);
            i++;
        }
        return sb.ToString();
    }

    /// <summary>Translate one character class `[...]`. Script references contribute their BMP ranges
    /// in place; their astral ranges are collected and OR-ed around the finished class, which is only
    /// legal for a POSITIVE class (a negated class with a script reference throws).</summary>
    private static int TranslateClass(string pattern, int start, StringBuilder sbOut, bool foldWide, bool unicode)
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
        // [^\S...] — JS's idiomatic "horizontal whitespace": NOT(non-space OR ...) is whitespace with
        // the other members removed. .NET has no in-class \S, but it does have class SUBTRACTION, so
        // the same set is expressible exactly. Emitted POSITIVE: the negation is already consumed by
        // the complement, and re-applying it would invert the answer.
        if (negated && rawBody.Contains("\\S", StringComparison.Ordinal))
        {
            var rest = new StringBuilder();
            var j = i;
            while (j < closeIdx)
            {
                if (pattern[j] == '\\' && j + 1 < closeIdx && pattern[j + 1] == 'S') { j += 2; continue; }
                if (pattern[j] == '\\') { j = AppendEscape(pattern, j, rest, inClass: true, classAstral: null, unicode: unicode); continue; }
                rest.Append(pattern[j]);
                j++;
            }
            sbOut.Append('[').Append(JsWhitespaceInner);
            if (rest.Length > 0) sbOut.Append("-[").Append(rest).Append(']');
            sbOut.Append(']');
            return closeIdx + 1;
        }
        while (i < n)
        {
            var c = pattern[i];
            if (c == ']' && !first)
            {
                i++;
                if (foldWide) body.Append(FoldExtrasFor(body.ToString()));
                if (negated && unicode)
                {
                    // "any code point except these": a whole astral pair (unless the class itself
                    // covers it), or one non-surrogate unit. Emitting plain [^…] would match a LONE
                    // SURROGATE and report half a character as the answer.
                    sbOut.Append("(?:");
                    if (astral.Count > 0) sbOut.Append("(?!").Append(UnicodeScripts.GuardAstral(string.Join("|", astral))).Append(')');
                    sbOut.Append(AstralPair).Append("|[^").Append(body).Append(NoSurrogate).Append("])");
                }
                else if (astral.Count == 0)
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
                    // ⚠ AN EMPTY BMP HALF MUST NOT EMIT "[]". .NET does not read that as the empty set:
                    // it swallows the following "|alt)" as class members, and the class then matches a
                    // LONE HIGH SURROGATE — so [\u{1E950}-\u{1E959}] matched every adjacent astral
                    // code point. Caught by a unit test, not the harness: no probe carried Adlam.
                    sbOut.Append("(?:");
                    if (body.Length > 0) sbOut.Append('[').Append(body).Append("]|");
                    sbOut.Append(UnicodeScripts.GuardAstral(string.Join("|", astral)));
                    sbOut.Append(')');
                }
                return i;
            }
            first = false;
            // ⚠ BEFORE the escape branch: an astral member may be WRITTEN as an escape (\u{20000}),
            // and AppendEscape would reject it without ever seeing that it is the low end of a range.
            if (TryTakeAstralMember(pattern, ref i, body, astral, negated)) continue;
            if (c == '\\')
            {
                i = AppendEscape(pattern, i, body, inClass: true, classAstral: astral, unicode: unicode);
                continue;
            }
            body.Append(c);
            i++;
        }
        throw new ArgumentException($"JsRegex: unterminated character class in {pattern}");
    }

    /// <summary>Consume one class member that is (or starts) an ASTRAL code point — a literal
    /// surrogate pair or a \u{...} escape, optionally as the low end of a range. .NET classes match
    /// UTF-16 units, so an astral member cannot live in the class at all: it is pushed onto
    /// <paramref name="astral"/> as a surrogate-pair alternation OR-ed around the finished class.
    /// A range straddling the BMP boundary contributes to both halves. Returns false (consuming
    /// nothing) when the member at <paramref name="i"/> is ordinary BMP text.</summary>
    private static bool TryTakeAstralMember(string pattern, ref int i, StringBuilder body, List<string> astral, bool negated)
    {
        var save = i;
        var lo = TryReadCodePoint(pattern, ref i);
        if (lo is null) { i = save; return false; }
        var hi = lo.Value;
        if (i < pattern.Length && pattern[i] == '-' && i + 1 < pattern.Length && pattern[i + 1] != ']')
        {
            var afterDash = i + 1;
            var end = TryReadCodePoint(pattern, ref afterDash);
            if (end is not null) { hi = end.Value; i = afterDash; }
        }
        if (hi <= 0xFFFF) { i = save; return false; }   // nothing astral here: let the normal path run
        if (negated)
            throw new NotSupportedException($"JsRegex: negated class with an astral member cannot be translated: {pattern}");
        if (lo.Value <= 0xFFFF)
        {
            body.Append(UnicodeScripts.EscapeBmpChar(lo.Value)).Append('-').Append(UnicodeScripts.EscapeBmpChar(0xFFFF));
            astral.Add(UnicodeScripts.RangeAlt(0x10000, hi));
        }
        else
        {
            astral.Add(UnicodeScripts.RangeAlt(lo.Value, hi));
        }
        return true;
    }

    /// <summary>Read one code point written as a literal (surrogate pair or BMP char) or as
    /// \u{...}/\uXXXX, advancing <paramref name="i"/>. Null for anything else (an escape class like
    /// \d, a class operator).</summary>
    private static int? TryReadCodePoint(string pattern, ref int i)
    {
        var n = pattern.Length;
        if (i >= n) return null;
        if (pattern[i] == '\\')
        {
            if (i + 1 >= n || pattern[i + 1] != 'u') return null;
            if (i + 2 < n && pattern[i + 2] == '{')
            {
                var close = pattern.IndexOf('}', i + 3);
                if (close < 0) return null;
                if (!int.TryParse(pattern[(i + 3)..close], System.Globalization.NumberStyles.HexNumber, null, out var cp)) return null;
                i = close + 1;
                return cp;
            }
            if (i + 6 > n || !int.TryParse(pattern[(i + 2)..(i + 6)], System.Globalization.NumberStyles.HexNumber, null, out var bmp)) return null;
            i += 6;
            return bmp;
        }
        if (char.IsHighSurrogate(pattern[i]))
        {
            if (i + 1 >= n || !char.IsLowSurrogate(pattern[i + 1]))
                throw new NotSupportedException($"JsRegex: lone surrogate in class: {pattern}");
            var cp = char.ConvertToUtf32(pattern[i], pattern[i + 1]);
            i += 2;
            return cp;
        }
        if (char.IsLowSurrogate(pattern[i])) return null;
        return pattern[i++];
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
    private static int AppendEscape(string pattern, int i, StringBuilder sb, bool inClass, List<string>? classAstral, bool unicode = false)
    {
        var n = pattern.Length;
        if (i + 1 >= n) throw new ArgumentException($"JsRegex: trailing backslash in {pattern}");
        var e = pattern[i + 1];
        switch (e)
        {
            case 'd': sb.Append(inClass ? "0-9" : "[0-9]"); return i + 2;
            case 'D':
                if (inClass) throw new NotSupportedException($"JsRegex: in-class \\D not supported: {pattern}");
                sb.Append(unicode ? $"(?:{AstralPair}|[^0-9{NoSurrogate}])" : "[^0-9]");
                return i + 2;
            case 'w': sb.Append(inClass ? AsciiWordInner : "[" + AsciiWordInner + "]"); return i + 2;
            case 'W':
                if (inClass) throw new NotSupportedException($"JsRegex: in-class \\W not supported: {pattern}");
                sb.Append(unicode ? $"(?:{AstralPair}|[^{AsciiWordInner}{NoSurrogate}])" : "[^" + AsciiWordInner + "]");
                return i + 2;
            case 's': sb.Append(inClass ? JsWhitespaceInner : "[" + JsWhitespaceInner + "]"); return i + 2;
            case 'S':
                if (inClass) throw new NotSupportedException($"JsRegex: in-class \\S not supported (except the [\\s\\S] idiom): {pattern}");
                sb.Append(unicode ? $"(?:{AstralPair}|[^{JsWhitespaceInner}{NoSurrogate}])" : "[^" + JsWhitespaceInner + "]");
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
                return AppendUnicodeProperty(pattern, i, sb, inClass, classAstral, negatedProp: e == 'P', unicode: unicode);
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

    private static int AppendUnicodeProperty(string pattern, int i, StringBuilder sb, bool inClass, List<string>? classAstral, bool negatedProp, bool unicode = false)
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
        if (name == "ASCII")
        {
            // A JS binary property with no .NET spelling, but a trivial one: \p{ASCII} is U+0000-U+007F.
            if (inClass && negatedProp)
                throw new NotSupportedException($"JsRegex: in-class \\P{{ASCII}} not supported: {pattern}");
            sb.Append(inClass ? "\\u0000-\\u007F" : negatedProp ? "[^\\u0000-\\u007F]" : "[\\u0000-\\u007F]");
            return close + 1;
        }
        if (!PassThroughCategories.Contains(name))
            throw new NotSupportedException($"JsRegex: unknown \\p{{{name}}} in {pattern}");
        var catAstral = unicode ? UnicodeCategories.AstralAlt(name) : null;
        if (negatedProp)
        {
            // \P{X} under /u is "one code point that is not X" — astral non-X included, lone
            // surrogates excluded.
            if (inClass)
            {
                if (catAstral is not null)
                    throw new NotSupportedException($"JsRegex: in-class \\P{{{name}}} with astral members: {pattern}");
                sb.Append("\\P{").Append(name).Append('}');
            }
            else if (unicode)
            {
                sb.Append("(?:");
                if (catAstral is not null) sb.Append("(?!").Append(UnicodeScripts.GuardAstral(catAstral)).Append(')');
                sb.Append(AstralPair).Append("|[^\\p{").Append(name).Append('}').Append(NoSurrogate).Append("])");
            }
            else
            {
                sb.Append("\\P{").Append(name).Append('}');
            }
            return close + 1;
        }
        if (inClass)
        {
            sb.Append("\\p{").Append(name).Append('}');
            if (catAstral is not null) classAstral!.Add(catAstral);
        }
        else if (catAstral is not null)
        {
            sb.Append("(?:\\p{").Append(name).Append("}|").Append(UnicodeScripts.GuardAstral(catAstral)).Append(')');
        }
        else
        {
            sb.Append("\\p{").Append(name).Append('}');
        }
        return close + 1;
    }
}
