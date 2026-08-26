/**
 * Shared ROMAN NUMERAL normalization — rewrite a Roman numeral to its DIGITS so the language's own cardinal
 * number compositor pronounces it.
 * Ported from src/core/roman.ts — see that file for the corpus evidence.
 */

namespace Vernacula.Phonemizer.Core;

public sealed class RomanPolicy
{
    /** Extra tokens this language must never read as a numeral — its own homographs. Lowercase. */
    public IReadOnlySet<string>? Exclude;
    /**
     * Integer → ORDINAL word, or null where this language cannot form one.
     *
     * KNOWN CONTRACT LIMIT, worth stating where the next person will look: it receives only the number, not
     * the matched context word — so it cannot inflect for the head noun.
     */
    public Func<int, string?>? Ordinal;
    /**
     * Fires the ORDINAL reading when it matches the text immediately BEFORE the numeral — the century noun
     * ("siglo", "secolul", "wiek", "век") or a regnal title.
     */
    public JsRe? OrdinalBefore;
    /** As `ordinalBefore`, but matched against the word FOLLOWING the numeral ("xix secolo", "xix век"). */
    public JsRe? OrdinalAfter;
}

public static class Roman
{
    /** Canonical Roman numeral form. Non-canonical spellings (IIII, XXXX, IC) are deliberately rejected —
     *  they are far more likely to be an acronym or typo than an intended numeral. */
    private static readonly JsRe CANONICAL = JsRegex.Compile("^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$");
    private static readonly (string Sym, int Val)[] VALUES =
    [
        ("m", 1000), ("cm", 900), ("d", 500), ("cd", 400), ("c", 100), ("xc", 90),
        ("l", 50), ("xl", 40), ("x", 10), ("ix", 9), ("v", 5), ("iv", 4), ("i", 1),
    ];

    /** Canonical Roman numeral → integer, or `null` if the token is not one. */
    public static int? RomanToInt(string token)
    {
        var s = token.ToLowerInvariant();
        if (s == "" || !CANONICAL.IsMatch(s)) return null;
        var n = 0;
        for (var i = 0; i < s.Length; )
        {
            var two = s.Substring(i, Math.Min(2, s.Length - i));
            var pairHit = false;
            foreach (var (sym, val) in VALUES)
            {
                if (sym.Length == 2 && sym == two) { n += val; i += 2; pairHit = true; break; }
            }
            if (pairHit) continue;
            var oneHit = false;
            foreach (var (sym, val) in VALUES)
            {
                if (sym.Length == 1 && sym[0] == s[i]) { n += val; oneHit = true; break; }
            }
            if (!oneHit) return null;
            i += 1;
        }
        return n > 0 ? n : null;
    }

    /** Valid canonical Roman numerals that are overwhelmingly NOT numerals in running text: metric and
     *  size abbreviations, and short words. Applied regardless of case — `CD`/`CM`/`XL` uppercase are the
     *  abbreviations, not 400/900/40. */
    internal static readonly IReadOnlySet<string> COLLISIONS = new HashSet<string>
    {
        "mm", "cm", "ml", "dl", "cl", "cc", // metric: millimetre, centimetre, millilitre, …
        "xl", "xxl", // clothing sizes
        "cd", "dc", "dv", "dx", "lv", "mv", "mc", "md", "cv", "ccc", // measured abbreviations; see the TS
        "mi", "di", "ci", "li", "vi", "xi", // short words across Romance/Slavic/Nordic/Turkic; `xi` is also a name
        "mix", "div", "civ", "liv", "dix", // words/abbreviations: mix, div, civ, Nordic "liv", French "dix"
    };

    /** For LOWERCASED input the case signal is gone, so only these shapes convert — the numeral forms that
     *  are essentially never words in any of the fleet's languages. Mirrors the closed set English's own
     *  roman rule uses (which likewise excludes `vi` and `xi`), extended through the twenties. */
    private static readonly IReadOnlySet<string> LOWERCASE_SAFE = new HashSet<string>
    {
        "ii", "iii", "iv", "vii", "viii", "ix",
        "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx",
        "xxi", "xxii", "xxiii", "xxiv", "xxv", "xxvi", "xxvii", "xxviii", "xxix", "xxx",
    };

    /** Per-language homographs of a Roman numeral, beyond the global collision list. */
    public static readonly IReadOnlyDictionary<string, IReadOnlySet<string>> ROMAN_EXCLUSIONS =
        new Dictionary<string, IReadOnlySet<string>>
        {
            ["ro"] = new HashSet<string> { "vii" }, // "vii" = alive / vines (plural of viu, vie)
            ["rup"] = new HashSet<string> { "vii" },
        };

    private static readonly JsRe TOKEN = JsRegex.Compile(@"\p{L}+", "gu");

    /** Rewrite Roman numerals in `text` to digits. */
    private static readonly JsRe PREV_WORD = JsRegex.Compile(@"(\p{L}+)[^\p{L}]*$", "u");
    private static readonly JsRe NEXT_WORD = JsRegex.Compile(@"^[^\p{L}]*(\p{L}+)", "u");

    private static readonly JsRe RomanLetterRe = JsRegex.Compile("[ivxlcdmIVXLCDM]", "u");
    private static readonly JsRe LowercaseRe = JsRegex.Compile(@"\p{Ll}", "u");
    private static readonly JsRe UppercaseRe = JsRegex.Compile(@"\p{Lu}", "u");
    private static readonly JsRe DigitRe = JsRegex.Compile(@"\d", "u");

    public static string NormalizeRomans(string text, RomanPolicy? policy = null)
    {
        policy ??= new RomanPolicy();
        if (!RomanLetterRe.IsMatch(text)) return text;
        var hasLower = LowercaseRe.IsMatch(text);
        return TOKEN.Replace(text, m =>
        {
            var tok = m.Value;
            var offset = m.Index;
            var lower = tok.ToLowerInvariant();
            if (policy.Exclude?.Contains(lower) == true) return tok; // this language's own homograph — never a numeral
            if (DigitRe.IsMatch(offset - 1 >= 0 && offset - 1 < text.Length ? text[offset - 1].ToString() : "")
                || DigitRe.IsMatch(offset + tok.Length < text.Length ? text[offset + tok.Length].ToString() : ""))
                return tok;
            var n = RomanToInt(tok);
            if (n == null) return tok;
            var allCaps = tok == tok.ToUpperInvariant() && UppercaseRe.IsMatch(tok);
            var prevM = PREV_WORD.Match(text[..offset]);
            var prevW = prevM.Success ? prevM.Groups[1].Value : null;
            var nextM = NEXT_WORD.Match(text[(offset + tok.Length)..]);
            var nextW = nextM.Success ? nextM.Groups[1].Value : null;
            var inContext =
                (prevW != null && policy.OrdinalBefore?.IsMatch(prevW) == true) ||
                (nextW != null && policy.OrdinalAfter?.IsMatch(nextW) == true);
            static bool IsSingleCap(string? w) =>
                w != null && w.Length == 1 && w == w.ToUpperInvariant() && UppercaseRe.IsMatch(w);
            if (IsSingleCap(tok) && (IsSingleCap(prevW) || IsSingleCap(nextW))) return tok;

            var licensed = inContext && allCaps && hasLower;
            if (!licensed)
            {
                if (tok.Length < 2) return tok; // single letters are never worth the risk (I, V, X, C, D, M, L)
                if (COLLISIONS.Contains(lower)) return tok;
                if (!(allCaps && hasLower) && !LOWERCASE_SAFE.Contains(lower)) return tok;
            }
            if (inContext)
            {
                var ord = policy.Ordinal?.Invoke(n.Value);
                if (ord != null && ord != "") return ord;
            }
            return Js.NumberToString(n.Value);
        });
    }
}
