/**
 * Punjabi (pa) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/punjabi/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Punjabi;

public static class Normalize
{
    /** The SHARED symbol tier, with Punjabi's data. Punjabi count nouns do not inflect after a numeral, so
     *  every count-forms array here is 1-element. The table serves BOTH scripts: pa (Gurmukhi) and pnb
     *  (Shahmukhi) ride the same engine, and the Latin unit/currency keys are there for the pnb corpus. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "ਅਤੇ",
        Multiply = new MultiplyDef { Times = "ਗੁਣਾ" },
        Percent = new[] { "ਪ੍ਰਤੀਸ਼ਤ" },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "ਕਿਲੋਮੀਟਰ" }, ["m"] = new[] { "ਮੀਟਰ" }, ["kg"] = new[] { "ਕਿਲੋਗਰਾਮ" },
        },
        ExponentWords = new ExponentWordsDef { Squared = new[] { "ਵਰਗ" }, Cubed = new[] { "ਘਣ" }, Position = "before" },
        // ⚠ `US$` IS ITS OWN KEY AND THE BARE `$` CANNOT REACH IT. The shared tier wraps every currency key
        // in `(?<![\p{L}\p{M}])…`, so a sign that a LETTER runs into is never matched — and nothing reports
        // it, because the sign is not dropped, it is simply never seen. Same word; only the key is new.
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { "ਡਾਲਰ" }, ["$"] = new[] { "ਡਾਲਰ" }, ["¥"] = new[] { "ਯੇਨ" },
        },
        Magnitudes = new[] { "ਹਜ਼ਾਰ", "ਲੱਖ", "ਕਰੋੜ", "ਮਿਲੀਅਨ", "ਅਰਬ" },
    });

    /** Ordinal suffixes. The suffix carries the gender/number agreement, so it is read off the text rather
     *  than guessed; both the bindi and bindi-less spellings occur. */
    private static readonly string[] ORDINAL_SUFFIXES = { "ਵੀਂ", "ਵੀ", "ਵਾਂ", "ਵਾ", "ਵੇਂ", "ਵੇ" };

    /** Gurmukhi unit abbreviations → the full word, matched only AFTER a number (which is what keeps ordinary
     *  words that merely start with these letters out). ⚠ LONGEST FIRST in `UNIT_ALT`: the multi-dot forms
     *  must precede the single-dot ones, or an interior dot survives the match and becomes a phrase break. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ਕਿ.ਮੀ."] = "ਕਿਲੋਮੀਟਰ", ["ਕਿ.ਮੀ"] = "ਕਿਲੋਮੀਟਰ", ["ਕਿਮੀ"] = "ਕਿਲੋਮੀਟਰ",
        ["ਸੈ.ਮੀ."] = "ਸੈਂਟੀਮੀਟਰ", ["ਸੈ.ਮੀ"] = "ਸੈਂਟੀਮੀਟਰ",
        ["ਮਿ.ਮੀ."] = "ਮਿਲੀਮੀਟਰ", ["ਮਿ.ਮੀ"] = "ਮਿਲੀਮੀਟਰ", ["ਮਿਮੀ"] = "ਮਿਲੀਮੀਟਰ",
        ["ਮੀ."] = "ਮੀਟਰ",
    };
    private static readonly JsRe DOT_ESC = JsRegex.Compile("\\.", "gu");
    private static readonly string UNIT_ALT = string.Join("|",
        UNIT_WORD.Keys.OrderByDescending(k => k.Length).Select(k => DOT_ESC.Replace(k, "\\.")));

    private static readonly JsRe ENTITY = JsRegex.Compile("&(nbsp|lrm|rlm|zwnj|zwj|amp|ndash|mdash)[;؛]", "giu");
    private static readonly JsRe GROUP_INDIAN = JsRegex.Compile("(?<![\\d,])(\\d{1,2}(?:,\\d{2})+,\\d{3})(?![\\d,])", "gu");
    private static readonly JsRe GROUP_WESTERN = JsRegex.Compile("(?<![\\d,])(\\d{1,3}(?:,\\d{3})+)(?![\\d,])", "gu");
    private static readonly JsRe COMMA_G = JsRegex.Compile(",", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(\\d)\\.(?=\\d)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+)\\s?({string.Join("|", ORDINAL_SUFFIXES)})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe UNIT_RE = JsRegex.Compile($"(\\d)\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe ERA_GURMUKHI = JsRegex.Compile("(?<![\\p{L}\\p{M}])ਈ\\.\\s?ਪੂ\\.?", "gu");
    private static readonly JsRe ERA_HAMZA = JsRegex.Compile("(\\d)\\s?ء(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOCTOR = JsRegex.Compile("(?<![\\p{L}\\p{M}])ਡਾ\\.(\\s+)(?=[\\p{L}])", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_INFIX = JsRegex.Compile("(\\d)\\s?\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|[\\s(])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe MINUS_RE = JsRegex.Compile("(^|[\\s(])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_BEFORE = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");

    /** Build the Punjabi normalizer. Takes the numbers definition so the ordinal rule composes its cardinal
     *  from exactly the data the engine's own number path uses. */
    public static Func<string, string> MakePunjabiNormalizer(NumbersDef numbers)
    {
        List<string> Cardinal(double n) => Core.Numbers.indicNumberWords(n, numbers).Select(w => w ?? "").ToList();

        /** The ordinal: the cardinal with the suffix JOINED to its final word. */
        string? Ordinal(double n, string suffix)
        {
            var words = Cardinal(n);
            if (words.Count == 0 || words.Any(w => w == "")) return null;
            words[^1] = $"{words[^1]}{suffix}";
            return string.Join(" ", words);
        }

        return input =>
        {
            // 0) HTML ENTITIES the shared decoder cannot see, BEFORE the symbol tier — whose ampersand rule
            //    reads every ⟨&⟩ and would voice the entity NAME as a word. The arm that cannot be made
            //    general is the ARABIC SEMICOLON ⟨؛⟩ terminator: the shared pattern ends at an ASCII `;`.
            //    An entity not in this list still falls through to the shared decoder unchanged.
            var s = ENTITY.Replace(input, m =>
            {
                var name = m.Groups[1].Value.ToLowerInvariant();
                return name == "amp" ? "&" : name == "ndash" ? "–" : name == "mdash" ? "—" : name == "nbsp" ? " " : "";
            });

            // 1) THE SHARED SYMBOL TIER FIRST. It matches a sign only with a NUMBER adjacent, and its own
            //    numeral pattern reads "2,500" / "2.3" as ONE token. Steps 2 and 3 split exactly those into
            //    two tokens, so running them first would strand every sign on half a numeral.
            s = SYMBOLS(s);

            // 2) DIGIT DE-GROUPING, before anything else that reads punctuation — a grouping comma is
            //    otherwise claimed as a phrase break AND truncates the numeral, since the tokenizer's number
            //    class has no separators. Both groupings: Indian 2-2-3 and Western 3-3. A final 3-digit group
            //    is REQUIRED, which is what keeps a list separator ("1990, 1991") out of the match.
            s = GROUP_INDIAN.Replace(s, m => COMMA_G.Replace(m.Value, ""));
            s = GROUP_WESTERN.Replace(s, m => COMMA_G.Replace(m.Value, ""));

            // 3) DECIMALS — after de-grouping (a grouped numeral may carry a decimal tail) and before the
            //    clock, so a stray dot cannot survive into a time match. The dot is NEUTRALISED, not spoken:
            //    the defect being fixed is the SENTENCE BREAK it produced mid-number.
            s = DECIMAL_DOT.Replace(s, "$1 ");

            // 4) TIMES, before the unit and ordinal rules so a bare-number rule cannot claim 11:30 first. The
            //    colon becomes a space; at :00 the minutes DROP OUT, or "10:00 ਵਜੇ" reads "ten zero". The
            //    two-digit minute guard is load-bearing — it is what keeps the ratio "3:2" from matching.
            s = CLOCK.Replace(s, m =>
                Js.Number(m.Groups[2].Value) == 0 ? m.Groups[1].Value : $"{m.Groups[1].Value} {m.Groups[2].Value}");

            // 5) ORDINAL SUFFIXES, written attached to the numeral but tokenized apart from it. THE TRAILING
            //    BOUNDARY IS LOAD-BEARING: without it the suffix matches the START of an ordinary word and
            //    glues it to the numeral. It is an explicit lookaround because `\b` is ASCII-defined in both
            //    runtimes and finds no boundary at all against Gurmukhi.
            s = ORDINAL_RE.Replace(s, m =>
                Ordinal(Js.Number(m.Groups[1].Value), m.Groups[2].Value) ?? m.Value);

            s = UNIT_RE.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

            // 7) ERA MARKERS, BEFORE the ਡਾ. abbreviation rule below — otherwise the generic single-dot rule
            //    claims the bare ਈ. first and strands the ਪੂ.
            s = ERA_GURMUKHI.Replace(s, "ਈਸਾ ਪੂਰਵ");
            //    The Shahmukhi half writes its era marker as a bare hamza after the year. ⚠ THE PRECEDING
            //    DIGIT IS REQUIRED: it is what keeps the rule off the ordinary word-final hamza of an Arabic
            //    loan, which is correctly silent in a language with no /ʔ/.
            s = ERA_HAMZA.Replace(s, "$1 عیسوی");

            // 8) ABBREVIATION. The DOT IS REQUIRED: ਡਾ is a live word-medial sequence, so a dot-optional rule
            //    would fire inside ordinary words. The dot is consumed so it cannot become a phrase break.
            s = DOCTOR.Replace(s, m => $"ਡਾਕਟਰ{m.Groups[1].Value}");

            s = DEGREE.Replace(s, "$1 ਡਿਗਰੀ");

            s = PLUS_MINUS.Replace(s, " ਜਮ੍ਹਾਂ ਘਟਾਓ ");
            s = PLUS_INFIX.Replace(s, "$1 ਜਮ੍ਹਾਂ ");
            s = PLUS_LEADING.Replace(s, "$1ਜਮ੍ਹਾਂ ");
            // ⚠ THE MINUS TAKES A RANGE GUARD. A digit anywhere to the LEFT rejects the match: a negative
            // quantity does not follow a number, but a range does (`1000 -1300`).
            s = MINUS_RE.Replace(s, m =>
                DIGIT_BEFORE.IsMatch(s[..m.Index]) ? m.Value : $"{m.Groups[1].Value}ਘਟਾਓ ");

            // ⚠ THE COMPARATIVES ARE POSTPOSITIONAL (ਤੋਂ follows the standard), hence the postposed-sign pass;
            // an infix rule would read the comparison backwards.
            s = PostposedSignPass.PostposedSign(s, "<", "ਤੋਂ ਘੱਟ");
            s = PostposedSignPass.PostposedSign(s, ">", "ਤੋਂ ਵੱਧ");
            s = EQUALS_RE.Replace(s, " ਬਰਾਬਰ ");
            s = DIVIDE.Replace(s, " ਭਾਗ ");

            return s;
        };
    }
}
