/**
 * Odia (or) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ ODIA DIGITS ୦-୯ ARE LIVE in real text (୨୦୦୮, ୧୪୦୦, ୬.୫, ୩:୨, ୩୫ମିମି), unlike several sibling Indic
 * languages where the lead fails and the inventory is ASCII throughout. `foldNativeDigits` runs in `text()`
 * BEFORE this pass, because every pattern below is written against ASCII digits; `number()` already folded
 * them for the bare-numeral path, so the fold changes no reading — it only lets these rules see them.
 *
 * ⚠ A LATIN `I` IS USED AS A DANDA in this orthography's running text. Unclaimed it reads as the ENGLISH
 * LETTER [ˈaᶦ] and the sentence break is lost — confidently wrong, not merely dropped.
 *
 * ⚠ NO `\b` ANYWHERE IN THIS FILE. It is ASCII-defined and matches nothing against Odia script, so every
 * boundary is an explicit `(?<![\p{L}\p{M}])` / `(?![\p{L}\p{M}])` lookaround.
 *
 * SOURCING. Every Odia word emitted below is attested, and most are attested twice — corpus plus a
 * dictionary or referee. ⚠ ONE EXCEPTION IS FLAGGED AS SUCH: `ଡଲାର` (dollar) has no second witness, because
 * the available Odia dictionary predates the loan. It is kept on the strength of independent modern
 * usage, but it does not have the standing of the rest of this list.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Odia;

public static class Normalize
{
    /**
     * The SHARED symbol tier, with Odia's data. Odia count nouns do not inflect after a numeral
     * (ଏକ ଡଲାର / ପାଞ୍ଚ ଡଲାର), so every `CountForms` here is a 1-element array. No `magnitudeConnective`:
     * Odia takes none. `US$` IS ITS OWN CURRENCY KEY: with only `$` declared the letter-code prefix was left
     * stranded as a Latin run. `unitPer: ପ୍ରତି` IS CORPUS-ORDERED. `exponentWords` position is `before`: ବର୍ଗ
     * is a SPACED PREFIX ("19,500 ବର୍ଗ କିଲୋମିଟର" — corpus ×14). `mph`/`kph` are WHOLE units because they are
     * written as one token with no slash for the rate machinery to find.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — ଏବଂ is ×975 TOKEN in this corpus.
        Ampersand = "ଏବଂ",
        // `multiply` — STANDARD MATHEMATICAL REGISTER, not a corpus attestation.
        Multiply = new MultiplyDef { Times = "ଗୁଣନ" },
        Percent = new[] { "ପ୍ରତିଶତ" },
        // `¥` ADDED: the corpus's `ମୂଲ୍ୟ ପ୍ରାୟ ¥7,000` dropped the sign. `£` was a GENUINE missing
        // declaration, hidden behind the `¥` above — the coverage audit reports the FIRST defective instance
        // per cell, so closing one instance of a cell can reveal another.
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { "ଡଲାର" }, ["$"] = new[] { "ଡଲାର" }, ["¥"] = new[] { "ୟେନ" }, ["£"] = new[] { "ପାଉଣ୍ଡ" },
        },
        Magnitudes = new[] { "ହଜାର", "ଲକ୍ଷ", "କୋଟି", "ନିୟୁତ", "ମିଲିୟନ୍", "ମିଲିୟନ", "ବିଲିଅନ୍", "ବିଲିଅନ" },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "କିଲୋମିଟର" },
            ["mm"] = new[] { "ମିଲିମିଟର" },
            ["mi"] = new[] { "ମାଇଲ" },
            ["mph"] = new[] { "ମାଇଲ ପ୍ରତି ଘଣ୍ଟା" },
            ["kph"] = new[] { "କିଲୋମିଟର ପ୍ରତି ଘଣ୍ଟା" },
        },
        RateDenominators = new Dictionary<string, string> { ["h"] = "ଘଣ୍ଟା", ["s"] = "ସେକେଣ୍ଡ" },
        UnitPer = "ପ୍ରତି",
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "ବର୍ଗ" },
            Cubed = new[] { "ଘନ" },
            Position = ExponentPosition.Before,
        },
    });

    /**
     * Odia unit abbreviations → the full word, matched only AFTER a number. Longest first so କି.ମି. beats
     * ମି — multi-dot abbreviations BEFORE single-dot ones, expressed as alternation order.
     */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["କି.ମି."] = "କିଲୋମିଟର", ["କି.ମି"] = "କିଲୋମିଟର", ["କିମି"] = "କିଲୋମିଟର",
        ["ମି.ମି."] = "ମିଲିମିଟର", ["ମି.ମି"] = "ମିଲିମିଟର", ["ମିମି"] = "ମିଲିମିଟର",
        ["କି.ଗ୍ରା."] = "କିଗ୍ରା", ["କି.ଗ୍ରା"] = "କିଗ୍ରା",
    };

    private static readonly JsRe DOT_ESCAPE = JsRegex.Compile("\\.", "gu");
    private static readonly string UNIT_ALT = string.Join("|", UNIT_WORD.Keys
        .OrderByDescending(k => k.Length)
        .Select(k => DOT_ESCAPE.Replace(k, "\\.")));

    /** Measure nouns that may stand either side of a rate slash. A CLOSED LIST on both sides, because only
     *  five of the corpus's fourteen Odia-to-Odia slashes are rates. */
    private static readonly string[] RATE_NUM = { "କିଲୋମିଟର", "ମିଲିମିଟର", "ମିଟର", "ମାଇଲ୍", "ମାଇଲ" };
    private static readonly string[] RATE_DEN = { "ଘଣ୍ଟା", "ସେକେଣ୍ଡ", "ମିନିଟ୍", "ମିନିଟ" };

    /** Ordinal suffixes, written attached to the numeral. All three occur: ଶ ×11, ତମ ×5, ମ ×3.
     *  Longest first so ତମ is not split by ମ. */
    private static readonly string[] ORDINAL_SUFFIXES = { "ତମ", "ଶ", "ମ" };

    private static readonly JsRe UNIT_RE = JsRegex.Compile($"(\\d)\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe LATIN_INITIALISM = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d])([A-Za-z](?:\\.[A-Za-z])+)\\.?(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe RATE_SLASH = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({string.Join("|", RATE_NUM)})\\s?/\\s?({string.Join("|", RATE_DEN)})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe GROUP_INDIC = JsRegex.Compile("(?<![\\d,])(\\d{1,2}(?:,\\d{2})+,\\d{3})(?![\\d,])", "gu");
    private static readonly JsRe GROUP_WESTERN = JsRegex.Compile("(?<![\\d,])(\\d{1,3}(?:,\\d{3})+)(?![\\d,])", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe KG_STANDALONE = JsRegex.Compile("(?<![\\p{L}\\p{M}])କି\\.ଗ୍ରା\\.?", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(\\d)\\.(?=\\d)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+)\\s?({string.Join("|", ORDINAL_SUFFIXES)})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DOCTOR = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:ଡଃ|ଡାଃ)\\.(\\s*)(?=[\\p{L}])", "gu");
    private static readonly JsRe NUMBER_ABBR = JsRegex.Compile("(?<![\\p{L}\\p{M}])ନଂ\\.(\\s*)(?=[\\d\\p{L}])", "gu");
    private static readonly JsRe LATIN_DANDA = JsRegex.Compile("(?<![A-Za-z\\d])I(?![A-Za-z\\d])", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe LEADING_MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_BEFORE = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe PLUS = JsRegex.Compile("\\+(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");

    /** Build the Odia normalizer. Takes the numbers definition so the ordinal rule composes its cardinal
     *  from exactly the data the engine's own number path uses. */
    public static Func<string, string> MakeOdiaNormalizer(NumbersDef numbers)
    {
        /**
         * The ordinal: the cardinal with the suffix JOINED to its final word. Joining in the DIGITS is not
         * enough — the tokenizer splits a digit run from an adjacent Odia letter, so "18ଶ" still emitted the
         * suffix as its own stressed word. Bails out on any un-authored 21–99 gap rather than gluing a
         * suffix onto a "?" placeholder.
         */
        string? Ordinal(double n, string suffix)
        {
            var words = Numbers.indicNumberWords(n, numbers);
            if (words.Count == 0 || words.Any(w => string.IsNullOrEmpty(w))) return null;
            var outp = words.Select(w => w!).ToList();
            outp[^1] = $"{outp[^1]}{suffix}";
            return string.Join(" ", outp);
        }

        return input =>
        {
            // 1) THE SHARED SYMBOL TIER FIRST. It matches a sign only when a NUMBER is ADJACENT, and its own
            //    numeral pattern reads "19,500" / "14.7" as ONE token. Steps 5 and 7 below split exactly
            //    those into two tokens, so running them first would strand every sign on half a numeral.
            var s = SYMBOLS(input);

            // 2) ODIA UNIT ABBREVIATIONS, only after a number — which is what keeps ordinary words out.
            //    Longest first (see UNIT_ALT). Before step 4 so `160କିମି/ଘଣ୍ଟା` has a recognisable measure
            //    noun on the left of its slash by the time that rule runs.
            s = UNIT_RE.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

            // 3) LATIN DOTTED INITIALISMS — a.m., p.m., U.S., A.D. Every interior dot was surviving as a
            //    PHRASE BREAK. The dots are stripped rather than expanded: the letters then reach the
            //    Latin/foreign path as one run, which is what they are.
            s = LATIN_INITIALISM.Replace(s, m => DOT_ESCAPE.Replace(m.Groups[1].Value, ""));

            // 4) RATE SLASH between two Odia measure nouns → ପ୍ରତି. Runs after step 2 so the abbreviated
            //    left-hand side has already become a full noun. Closed lists on BOTH sides.
            s = RATE_SLASH.Replace(s, m => $"{m.Groups[1].Value} ପ୍ରତି {m.Groups[2].Value}");

            // 5) DIGIT DE-GROUPING, before anything else that reads punctuation. "7,000" was read as
            //    [sˈat̪ɔ , sˈun̪jɔ] — "seven, zero". Both groupings: Indian 2-2-3 and Western 3-3. A final
            //    3-digit group is REQUIRED, which keeps a list separator out of the match.
            s = GROUP_INDIC.Replace(s, m => COMMAS.Replace(m.Value, ""));
            s = GROUP_WESTERN.Replace(s, m => COMMAS.Replace(m.Value, ""));

            // 6) ODIA DOT-ABBREVIATION LEFTOVERS whose expansion is not sourceable — the standalone
            //    କି.ଗ୍ରା. shape, so the final dot cannot survive as a break.
            s = KG_STANDALONE.Replace(s, "କିଗ୍ରା");

            // 7) DECIMALS — after de-grouping and before the clock. The dot is NEUTRALISED, not spoken:
            //    there is no sourceable Odia decimal-point word, and the defect being fixed is the SENTENCE
            //    BREAK the dot produced mid-number. Dropping a sign beats speaking a word we cannot source.
            s = DECIMAL_DOT.Replace(s, "$1 ");

            // 8) TIMES, before the ordinal rule. The colon was becoming a COMMA PAUSE. Odia reads the clock
            //    as bare juxtaposition plus ଟା, which the corpus already writes, so the colon becomes a
            //    space. At :00 the minutes DROP OUT.
            s = CLOCK.Replace(s, m =>
                Js.Number(m.Groups[2].Value) == 0 ? m.Groups[1].Value : $"{m.Groups[1].Value} {m.Groups[2].Value}");

            // 9) ORDINAL SUFFIXES. Written attached to the numeral (18ଶ, 1000ତମ) but tokenized apart, so the
            //    suffix was spoken as its own stressed word. KNOWN LIMIT: 1ମ reads ଏକମ where the suppletive
            //    ordinal is ପ୍ରଥମ. THE TRAILING BOUNDARY IS LOAD-BEARING: "18ଶହ ଶତାବ୍ଦୀ" is ଶହ, the HUNDRED
            //    word, and must be left alone.
            s = ORDINAL_RE.Replace(s, m =>
                Ordinal(Js.Number(m.Groups[1].Value), m.Groups[2].Value) ?? m.Value);

            // 10) ABBREVIATIONS. The DOT IS REQUIRED, and so is the visarga: ଡଃ / ଡାଃ are unambiguous, but a
            //     dot-optional rule would also fire on ordinary word-final ଡା.
            s = DOCTOR.Replace(s, m => $"ଡାକ୍ତର{(m.Groups[1].Value.Length > 0 ? m.Groups[1].Value : " ")}");
            s = NUMBER_ABBR.Replace(s, m => $"ନମ୍ବର{(m.Groups[1].Value.Length > 0 ? m.Groups[1].Value : " ")}");

            // 11) LATIN `I` USED AS A DANDA. Twenty-three of them, every one sentence-final after Odia text —
            //     a keyboard artifact for ।, SPOKEN as the English pronoun [ˈaᶦ] while the sentence break
            //     vanished. The guard is only against other LATIN letters and digits, because the artifact is
            //     frequently glued to the preceding Odia word.
            s = LATIN_DANDA.Replace(s, "।");

            // 12) DEGREES. The bare sign was dropped outright. ଡିଗ୍ରୀ is the corpus's own spelling (×3).
            s = DEGREE.Replace(s, "$1 ଡିଗ୍ରୀ");

            // 13) THE UTC OFFSET'S PLUS — ships on TYPOLOGY (the six Indic languages whose plus WAS resolved
            //     from audio all borrow: प्लस/ప్లస్/પ્લસ/ಪ್ಲಸ್/പ്ലസ്/பிளஸ்), and says so rather than dressing
            //     an inference up as an attestation. ⚠ THE WEAKEST-SOURCED CELL IN THE SWEEP.
            // THE MINUS AND ±. ⚠ MEASURED SAFE: every `-<digit>` in or_in is a range, score or closed
            //     designation. `ଋଣାତ୍ମକ` ×7 is the POLARITY word, attested on the number line beside ଧନାତ୍ମକ.
            //     Three guards: a digit immediately after, a letter/digit immediately before, and a digit
            //     ANYWHERE to the left (the spaced range/score).
            s = PLUS_MINUS.Replace(s, " ପ୍ଲସ୍ ଋଣାତ୍ମକ ");
            var frozen = s;
            s = LEADING_MINUS.Replace(s, m => DIGIT_BEFORE.IsMatch(frozen[..m.Index]) ? m.Value : "ଋଣାତ୍ମକ ");
            s = PLUS.Replace(s, " ପ୍ଲସ୍ ");

            // THE RELATIONAL AND DIVISION SIGNS, sourced ENTIRELY from or_in: ସମାନ ×41 token, ଠାରୁ କମ ×3 /
            // ଠାରୁ ଅଧିକ ×16 phrase (both POSTPOSED — ଠାରୁ follows the standard and fuses to it, so they use
            // core/postposedSign.ts; an infix rule would read the comparison backwards), ଭାଗ ×9 token.
            // ⚠ `ଭାଗ` IS A SUBSTRING TRAP TOO: ×9 token against ×60 SUBSTRING inside ତଳଭାଗରେ and similar.
            s = PostposedSignPass.PostposedSign(s, "<", "ଠାରୁ କମ");
            s = PostposedSignPass.PostposedSign(s, ">", "ଠାରୁ ଅଧିକ");
            s = EQUALS.Replace(s, " ସମାନ ");
            s = DIVIDE.Replace(s, " ଭାଗ ");

            return s;
        };
    }
}
