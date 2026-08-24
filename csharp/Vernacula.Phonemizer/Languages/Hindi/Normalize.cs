/**
 * Hindi (hi) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ MOST OF THE TIERS ARE ALREADY RIGHT AND ARE DELIBERATELY UNTOUCHED, which is worth stating because it
 * bounds what this file does: the Indic number compositor already reads लाख/करोड़ (100000 → एक लाख), the
 * number tokenizer already accepts BOTH the Western and the Indian comma grouping (9,000 and 1,00,000), the
 * decimal already reads as दशमलव, % and currency work through the shared symbol tier, the danda । is already
 * a clause mark, and embedded Latin runs are already delegated to English — which is the right reading for the
 * acronyms that occur, since AOL, PBS and DNA are said with English letter names.
 *
 * What is left is genuinely Hindi-specific: the ordinal suffixes, the Devanagari unit abbreviations, the
 * abbreviations, and the clock.
 *
 * ⚠ HINDI TEXT WRITES NUMBERS WITH ASCII DIGITS, not Devanagari ones, so no digit transliteration is needed
 * here — unlike the Perso-Arabic and Bengali engines, where the fold is load-bearing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hindi;

public static class Normalize
{
    /**
     * Ordinal suffix → the gender/number it marks. Hindi writes the ordinal as the numeral plus this suffix
     * (16वीं), and the suffix itself carries the agreement, so it is read off the text rather than guessed.
     *   वाँ / वां  masculine singular      वीं  feminine        वें / वे  masculine plural / oblique
     */
    private static readonly IReadOnlyDictionary<string, int> SUFFIX_FORM = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["वाँ"] = 0, ["वां"] = 0, ["वा"] = 0,
        ["वीं"] = 1, ["वी"] = 1,
        ["वें"] = 2, ["वे"] = 2,
    };

    /**
     * Irregular ordinals, indexed [masculine, feminine, oblique]. 1–4 and 6 are suppletive; 5 (पाँचवाँ) and
     * everything from 7 up are regular — the cardinal plus the suffix.
     */
    private static readonly IReadOnlyDictionary<int, string[]> IRREGULAR = new Dictionary<int, string[]>
    {
        [1] = new[] { "पहला", "पहली", "पहले" },
        [2] = new[] { "दूसरा", "दूसरी", "दूसरे" },
        [3] = new[] { "तीसरा", "तीसरी", "तीसरे" },
        [4] = new[] { "चौथा", "चौथी", "चौथे" },
        [6] = new[] { "छठा", "छठी", "छठे" },
    };

    /**
     * Devanagari unit abbreviations → the full word. The existing symbol tier is keyed on the LATIN
     * abbreviations, which is not what the corpus writes: किमी ×10, मिमी ×5. Unexpanded, किमी read [kˈɪmiː].
     */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["किमी"] = "किलोमीटर", ["किमी/घंटा"] = "किलोमीटर प्रति घंटा", ["किग्रा"] = "किलोग्राम",
        ["सेमी"] = "सेंटीमीटर", ["मिमी"] = "मिलीमीटर", ["ग्रा"] = "ग्राम", ["मि"] = "मिनट",
        ["मी/से"] = "मीटर प्रति सेकंड",
    };
    private static readonly string UNIT_ALT = string.Join("|", UNIT_WORD.Keys.OrderByDescending(k => k.Length));

    /**
     * Abbreviations. डॉ is the most frequent in the corpus and is usually written WITHOUT a dot (×22 of 27),
     * so the dot cannot be required. श्री and आदि are already ordinary words and need no expansion.
     */
    private static readonly IReadOnlyDictionary<string, string> ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["डॉ"] = "डॉक्टर", ["प्रो"] = "प्रोफ़ेसर", ["कु"] = "कुमारी", ["श्रीमती"] = "श्रीमती",
        ["सं"] = "संख्या", ["पृ"] = "पृष्ठ", ["अध्या"] = "अध्याय",
    };
    private static readonly string ABBREV_ALT = string.Join("|", ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe ERA_ISP = JsRegex.Compile("(?<![\\p{L}\\p{M}])ई\\.?\\s?स\\.?\\s?पू\\.?", "gu");
    private static readonly JsRe ERA_IP = JsRegex.Compile("(?<![\\p{L}\\p{M}])ई\\.?\\s?पू\\.?", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+)\\s?({string.Join("|", SUFFIX_FORM.Keys)})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe ABBREV_RE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.?(\\s+)(?=[\\p{{L}}])", "gu");
    private static readonly JsRe UNIT_RE = JsRegex.Compile($"(\\d)\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe COORD = JsRegex.Compile("(\\d)\\s?[°º]\\s?(\\d+)\\s?[´′'](?:\\s?(\\d+)\\s?[″\"])?", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("(\\d)\\s?℃", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("(\\d)\\s?℉", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?[°º]\\s?C(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?[°º]\\s?F(?![\\p{L}])", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?[°º]", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(\\s*बजे)?", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe MINUS_BRACKET = JsRegex.Compile("(^|[(\\[（])\\s?[-−–](\\d)", "gu");
    private static readonly JsRe MINUS_DEGREE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\p{Nd}-])[-−–](\\d+(?:[.,]\\d+)?)(?=\\s?(?:°|℃|℉|डिग्री))", "gu");
    private static readonly JsRe MINUS_DECIMAL = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\p{Nd}-])(?<!\\p{Nd}[\\p{L}\\p{M}]{0,2}[.,]?[ \\t]?)[-−–](\\d+[.,]\\d+)(?![\\d.,])", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("\\s?×\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe AMP_LATIN = JsRegex.Compile("(?<=[A-Za-z])\\s?&\\s?(?=[A-Za-z])", "gu");
    private static readonly JsRe AMP = JsRegex.Compile("\\s?&\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");

    /** Build the Hindi normalizer. Takes the numbers definition so the ordinal rule can compose the cardinal
     *  words it attaches its suffix to — the same data the engine's own number path uses. */
    public static Func<string, string> MakeHindiNormalizer(NumbersDef numbers)
    {
        /** Integer → its Devanagari cardinal words, as the engine's number path would render them. */
        List<string> Cardinal(double n) => Core.Numbers.indicNumberWords(n, numbers).Select(w => w ?? "").ToList();

        /**
         * The ordinal, agreeing with whatever the written suffix marked. Regular ordinals are the cardinal
         * with the suffix JOINED to its final word — सोलह + वीं is one word, सोलहवीं.
         */
        string? Ordinal(double n, int form, string suffix)
        {
            if (double.IsInteger(n) && n >= int.MinValue && n <= int.MaxValue && IRREGULAR.TryGetValue((int)n, out var irr))
                return irr[form];
            var words = Cardinal(n);
            if (words.Count == 0 || words.Any(w => w == "")) return null;
            words[^1] = $"{words[^1]}{suffix}";
            return string.Join(" ", words);
        }

        return input =>
        {
            var s = input;

            // 1) ERA MARKERS, before the abbreviation rule so the bare ई. is not claimed first. The dots were
            //    surviving as two phrase breaks. NOTE ON BOUNDARIES: `\b` never matches before a Devanagari
            //    letter — every boundary in this file is an explicit lookaround.
            s = ERA_ISP.Replace(s, "ईसा पूर्व");
            s = ERA_IP.Replace(s, "ईसा पूर्व");

            // 2) ORDINAL SUFFIXES. Attached to the numeral in writing (16वीं) but tokenized apart. THE
            //    TRAILING BOUNDARY IS LOAD-BEARING: without it the suffix matched the START of an ordinary
            //    word (`10 वापस` became one glued token). Never a bare match where a letter may follow.
            s = ORDINAL_RE.Replace(s, m =>
                Ordinal(Js.Number(m.Groups[1].Value), SUFFIX_FORM[m.Groups[2].Value], m.Groups[2].Value) ?? m.Value);

            // 3) ABBREVIATIONS. The dot is consumed when the sentence continues; डॉ is matched with the dot
            //    OPTIONAL because that is how it is usually written.
            s = ABBREV_RE.Replace(s, m => $"{ABBREV[m.Groups[1].Value]}{m.Groups[2].Value}");

            // 4) DEVANAGARI UNIT ABBREVIATIONS, after a number. Longest first so किमी/घंटा beats किमी.
            s = UNIT_RE.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

            // 5) DEGREES. Case-insensitive: the corpus is lowercased, so "30° c" occurs.
            //    5a) COORDINATES FIRST, because the degree rules below would eat the ° and strand the minutes
            //        mark. `º` — U+00BA MASCULINE ORDINAL INDICATOR standing in for the degree sign. The
            //        minutes mark is claimed ONLY after a degree, because a bare `'` is an apostrophe.
            s = COORD.Replace(s, m =>
                $"{m.Groups[1].Value} डिग्री {m.Groups[2].Value} मिनट{(m.Groups[3].Success && m.Groups[3].Value.Length > 0 ? $" {m.Groups[3].Value} सेकंड" : "")}");
            //    5b) ℃ AND ℉ ARE SINGLE CODE POINTS and matched nothing here, so `20℃` read as bare *bˈiːs* —
            //        the whole unit silently gone.
            s = DEG_C_SIGN.Replace(s, "$1 डिग्री सेल्सियस");
            s = DEG_F_SIGN.Replace(s, "$1 डिग्री फ़ारेनहाइट");
            s = DEG_C.Replace(s, "$1 डिग्री सेल्सियस");
            s = DEG_F.Replace(s, "$1 डिग्री फ़ारेनहाइट");
            s = DEG.Replace(s, "$1 डिग्री");

            // 6) TIMES. The colon was becoming a PHRASE BREAK, and a :00 was read as शून्य. Hindi says the
            //    full form "दस बजकर तीस मिनट" — which already contains बजे's sense, so a following बजे is
            //    consumed. At :00 the minutes drop out and a following बजे is exactly right.
            s = CLOCK.Replace(s, m =>
            {
                var hw = string.Join(" ", Cardinal(Js.Number(m.Groups[1].Value)));
                if (Js.Number(m.Groups[2].Value) == 0)
                    return $"{hw}{(m.Groups[3].Success && m.Groups[3].Value.Length > 0 ? m.Groups[3].Value : " बजे")}";
                return $"{hw} बजकर {string.Join(" ", Cardinal(Js.Number(m.Groups[2].Value)))} मिनट";
            });

            // 7) PLUS — REWRITTEN FROM THE CORPUS'S OWN AUDIO: प्लस, the loan, is what both speakers say in
            //    the slot; धन is what the sign is CALLED (a correctly-sourced word from the wrong register).
            //    ⚠ IT DOES NOT MAKE THE SIGN SILENT: both speakers omitted the `+` before a temperature, but
            //    a reader who skips a character the author wrote is telling us about reading habits, not
            //    about content we may delete. OMITTING A PLUS IS LOSSLESS AND OMITTING A MINUS INVERTS.
            s = PLUS_ATTACHED.Replace(s, "$1 प्लस $2");
            s = PLUS_LEADING.Replace(s, "$1प्लस $2");

            // 7b) MINUS — WHERE IT IS UNAMBIGUOUS, AND ONLY THERE. The fleet's usual left-guard shape has one
            //     false positive here (`चंद्रयान -1`) and no true ones; what escapes the objection is RIGHT
            //     context: string/bracket start, or a DEGREE word after the number (NOT percent — hi writes a
            //     census figure as `(३१,३८१ -९८.५३% हिंदू)` where the dash INTRODUCES the percentage).
            s = MINUS_BRACKET.Replace(s, "$1ऋण $2");
            s = MINUS_DEGREE.Replace(s, "ऋण $1");
            //     A THIRD ARM: A MINUS BEFORE A **DECIMAL** — the fleet's ONLY true negative number
            //     (`-२.८८ परिमाण`, an astronomical magnitude). Every false positive this class suffers is an
            //     INTEGER (designation, score, year range); none is written with a fractional part. The range
            //     guard is repeated because the census dash IS a decimal and a digit precedes it.
            s = MINUS_DECIMAL.Replace(s, "ऋण $1");

            // 7c) THE REMAINING SIGNS. COMPARATIVES REORDER: Hindi states the comparison POSTPOSITIONALLY —
            //     `A < B` is "A, B से कम". The mechanism lives in core/postposedSign.ts.
            s = PostposedSignPass.PostposedSign(s, "<", "से कम");
            s = PostposedSignPass.PostposedSign(s, ">", "से अधिक");
            //     बराबर — infix, the arithmetic reading.
            s = EQUALS.Replace(s, " बराबर ");
            //     गुणा and भाग — hi.wikipedia's अंकगणित names the four operations and ties each to its sign.
            //     `/` itself is NOT routed here — step 8 already reads it as the fraction बटा.
            s = TIMES.Replace(s, " गुणा ");
            s = DIVIDE.Replace(s, " भाग ");
            //     ± takes the pair named in the पूर्णांक citation, in its conventional order.
            // ⚠ SPACED ON BOTH SIDES, or the reading FUSES onto the preceding word (`तापमान±5` read as one
            //    token with the stress of neither).
            s = PLUS_MINUS.Replace(s, " धन ऋण ");
            //     THE AMPERSAND, split the way the Mandarin pass split it: between LATIN letters it stays
            //     inside the run this engine already delegates to English (`AT&T`); elsewhere it is और.
            s = AMP_LATIN.Replace(s, " and ");
            s = AMP.Replace(s, " और ");

            // 8) FRACTIONS. आधा and तिहाई are suppletive; the rest are "n बटा m", the ordinary spoken form.
            s = FRACTION.Replace(s, m =>
            {
                double num = Js.Number(m.Groups[1].Value), den = Js.Number(m.Groups[2].Value);
                if (num == 1 && den == 2) return "आधा";
                if (num == 1 && den == 4) return "चौथाई";
                if (den == 3) return $"{string.Join(" ", Cardinal(num))} तिहाई";
                string nw = string.Join(" ", Cardinal(num)), dw = string.Join(" ", Cardinal(den));
                return nw == "" || dw == "" ? m.Value : $"{nw} बटा {dw}";
            });

            return s;
        };
    }
}
