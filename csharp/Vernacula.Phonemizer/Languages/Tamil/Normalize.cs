/**
 * Tamil (ta) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Measured over the ta_in FLEURS corpus (1,886 unique utterances, column 3 — the cased one):
 *   660 numerals · 39 grouped (BOTH Western 5,000,000 and Indian 7,83,562) · 29 decimals · 21 clock-colons
 *   86 ordinal ஆம் · 10 ordinal ம் · 9 ordinal வது/ஆவது · 28 clitic இல் · 14 clitic ல்
 *   31 கிமீ/கி.மீ · 4 மிமீ/கிகி · 5 era கி.மு/கி.பி · ~12 dotted Tamil initialisms (யு.எஸ், எம்.ஆர்.ஐ …)
 *   8 currency signs · 4 percent · 4 ASCII rate units (km/h, m/s, mph) · 2 exponents (km², mm2) · 20 ZWSP
 *
 * THE LARGEST DEFECT WAS NOT IN THIS LAYER. As with bn/ur/id, the number data was the real bug: Tamil
 * numerals are sandhi-fused and the compositor concatenated, so every one of the 660 numerals was read in
 * a form no speaker uses (1995 → *ஒன்று ஆயிரம் ஒன்பது நூறு தொண்ணூறு ஐந்து). That is fixed where it lives,
 * in tamil.jsonc + numbers.ts, and this file composes on top of the corrected words.
 *
 * NO `\b` ANYWHERE. `\b` is defined on ASCII word characters and finds no boundary at all against Tamil
 * script, so a rule written with it silently matches nothing (or, worse, matches mid-word). Every boundary
 * here is an explicit `(?<![\p{L}\p{M}])` / `(?![\p{L}\p{M}])` lookaround.
 *
 * Tamil DIGITS (௦–௯) and the Tamil numeral signs (௰ ௱ ௲) do NOT occur in this corpus — checked, the digit
 * inventory is entirely ASCII — so there is no digit fold here. Same negative result as Persian.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tamil;

public static class Normalize
{
    /** Tamil letter+mark boundary. Never `\b`. */
    private const string NB = "(?<![\\p{L}\\p{M}])";
    private const string NA = "(?![\\p{L}\\p{M}])";

    /**
     * The SHARED symbol tier (percent / currency / units / rate / exponent). Kept here rather than in
     * tamil.ts because its position in the ordering matters and the ordering is this file's job — see step 6.
     *
     * percent: சதவீதம், which the corpus also writes as சதவிகிதம்; both are current, சதவீதம் is the form
     * already used by the engine. currency: only the dollar sign occurs (×8), in the bare `$` and `US$`
     * spellings. Bhutan's `Nu` (×2) is left alone — no sourced Tamil form, and a wrong
     * currency word is worse than a dropped sign.
     *
     * EXPONENT uses position "before" with a SPACE: Tamil says சதுர கிலோமீட்டர், two words — and the corpus
     * itself writes exactly that, ×7, which is what sourced the choice.
     *
     * RATE is deliberately NOT declared here (`unitPer` is unset). Tamil's rate is a PREFIX in the dative,
     * like Korean's 시속: மணிக்கு 480 கிலோமீட்டர், வினாடிக்கு 1.5 கிலோமீட்டர் — both attested verbatim in
     * this corpus. The shared seam's "A per B" postposed idiom cannot express that, so the four ASCII rate
     * forms are handled locally in step 5.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
        // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
        // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
        // defaults to it — this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "பெருக்கல்" },
        // `&` was DROPPED outright, so `B&Bs` lost the sign and read as two bare consonants. `மற்றும்`
        // is the ordinary conjunction, ×997 in the corpus, and the wiki examples put it in exactly this slot —
        // inside an institution name: `எண்ணெய் மற்றும் இயற்கை எரிவாயுக் கழகம்` (Oil and Natural Gas Corporation).
        // ⚠ `அண்ட்`, the transliterated English "and", was the adversarial candidate and is REJECTED on the
        // corpus: ×1 there against மற்றும்'s 997. It is common in the wiki (121 tokens) because that haystack is
        // full of transliterated company names, which is a fact about the haystack and not about how this
        // language reads an ampersand.
        // ⚠ THE STRONGEST EVIDENCE IS IN THE SENTENCE ITSELF: the corpus GLOSSES the abbreviation using this very
        // word — `B&Bs இரண்டு முக்கிய விஷயங்களில் போட்டியிடுகின்றன: படுக்கை மற்றும் காலை உணவு` ("bed AND
        // breakfast"). The text states what the sign expands to, in the same breath, with the conjunction chosen
        // here. Frequency counts are the weaker argument; this is the slot, glossed.
        Ampersand = "மற்றும்",
        Percent = new[] { "சதவீதம்" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "டாலர்" }, ["$"] = new[] { "டாலர்" },
        },
        Magnitudes = new[] { "மில்லியன்", "பில்லியன்", "ட்ரில்லியன்", "லட்சம்", "கோடி" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "கிலோமீட்டர்" },
            ["cm"] = new[] { "சென்டிமீட்டர்" },
            ["mm"] = new[] { "மில்லிமீட்டர்" },
            ["kg"] = new[] { "கிலோகிராம்" },
            ["mi"] = new[] { "மைல்" },
            ["m"] = new[] { "மீட்டர்" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "சதுர" },
            Cubed = new[] { "கன" },
            Position = ExponentPosition.Before,
        },
    });

    /**
     * Tamil unit abbreviations, written with or without the interior dot. The shared tier above is keyed on
     * the Latin spellings and cannot see these. Longest first so கி.மீ is not clipped to கி.
     *
     * Trap #2 (loose patterns over-count) applies hard here: `கி மி` spaced matched *சுருக்கி மிகவும்* until
     * the trailing `NA` boundary was added, and `கிமு` would otherwise fire inside எஸ்கிமோ. Both boundaries
     * are asserted; the spaced variants additionally require a preceding digit, which is the only shape they
     * take in the corpus (12.8 கி மி).
     */
    private static readonly IReadOnlyDictionary<string, string> TAMIL_UNIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["கிமீ"] = "கிலோமீட்டர்", ["கிமி"] = "கிலோமீட்டர்",
        ["மிமீ"] = "மில்லிமீட்டர்", ["மிமி"] = "மில்லிமீட்டர்",
        ["செமீ"] = "சென்டிமீட்டர்", ["செமி"] = "சென்டிமீட்டர்",
        ["கிகி"] = "கிலோகிராம்",
    };

    /**
     * ERA markers, which must be rewritten BEFORE the generic dotted-abbreviation rule below — otherwise
     * கி.மு. is read as a two-letter initialism [kɪ mʊ] and the era is lost. Both dotted and undotted
     * spellings occur (கிமு 10,000 / கி.மு. 356). Also எ.கா. = "for example", the Tamil e.g.
     */
    private static readonly IReadOnlyDictionary<string, string> ERA = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["மு"] = "கிறிஸ்துவுக்கு முன்",
        // Written without the sandhi doubler (கிறிஸ்துவுக்குப் பின்) on purpose: the g2p voices a word-final
        // ப் to [b], so the doubled spelling came out [kiɾistuʋukːub pin].
        ["பி"] = "கிறிஸ்துவுக்கு பின்",
    };

    /**
     * Tamil renderings of the LATIN letter names, which is what a dotted Tamil initialism is made of
     * (யு.எஸ் = U.S., எம்.ஆர்.ஐ = MRI, ஜி. டி. பி = GDP), plus நா — the clipped நாடுகள் in ஐ.நா. (UN).
     *
     * This is a CLOSED LIST on purpose. A generic "short Tamil token, dot, short Tamil token" rule cannot be
     * written safely: probing it against the corpus matched sentence boundaries such as "…ஆவர். கட்பேக்தான்"
     * and "…அல்ல. செங்குத்தாக", because Tamil has no case distinction to mark a sentence start. Restricting
     * the members to actual letter names is what makes the rule sound — trap #2 again.
     */
    private static readonly string[] LETTER_NAME =
    {
        "ஏ", "பி", "சி", "டி", "இ", "எஃப்", "ஜி", "எச்", "ஐ", "ஜே", "கே", "எல்", "எம்", "என்",
        "ஓ", "க்யூ", "ஆர்", "எஸ்", "யு", "வி", "டபிள்யூ", "எக்ஸ்", "ஒய்", "இசட்", "நா",
    };

    private static string Alt(IEnumerable<string> keys) =>
        string.Join("|", keys.OrderByDescending(a => a.Length));

    private static readonly JsRe TAMIL_UNIT_RE = JsRegex.Compile($"{NB}({Alt(TAMIL_UNIT.Keys)}){NA}", "gu");
    private static readonly JsRe TAMIL_UNIT_DOT_RE = JsRegex.Compile($"{NB}(கி|மி|செ)\\s*\\.\\s*(மீ|மி){NA}", "gu");
    private static readonly JsRe TAMIL_UNIT_SPACED_RE = JsRegex.Compile($"(?<=\\d\\s?)(கி|மி|செ)\\s(மீ|மி){NA}", "gu");
    // The trailing `\.?` deliberately has NO `\s*` in front of it: with one, the rule swallowed the space
    // after the abbreviation and produced "கிறிஸ்துவுக்கு முன்10000" as a single token (caught by the corpus
    // diff, ×2 — not by any probe).
    private static readonly JsRe ERA_RE = JsRegex.Compile($"{NB}கி\\s*\\.?\\s*(மு|பி)\\.?{NA}", "gu");
    private static readonly string LETTER = $"(?:{Alt(LETTER_NAME)})";
    // A run of ≥2 dot-separated letter names. The run's TRAILING dot is consumed only when the sentence
    // visibly continues (whitespace + another letter); at a true sentence end it is left in place, so that
    // "…1 யு.எஸ்." keeps its final pause. Zero sentence-final pauses are lost by this rule.
    private static readonly JsRe INITIALISM_RE = JsRegex.Compile(
        $"{NB}{LETTER}(?:\\s*\\.\\s*{LETTER})+(?:\\s*\\.(?=\\s+[\\p{{L}}]))?{NA}", "gu");

    /** Ordinal suffixes, longest first: ஆவது / வது take -ஆவது, ஆம் / ம் take -ஆம். */
    private static readonly string[] ORDINAL_SUFFIX = { "ஆவது", "ஆம்", "வது", "ம்" };
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+)\\s*-?\\s*({string.Join("|", ORDINAL_SUFFIX)}){NA}", "gu");

    /** Numeric fractions. Only the three attested shapes; Tamil lexicalises the halves and quarters. */
    private static readonly IReadOnlyDictionary<string, string> FRACTION_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["1/2"] = "அரை", ["1/4"] = "கால்", ["3/4"] = "முக்கால்",
    };

    /** ASCII rate units. Tamil puts the denominator FIRST, in the dative — see the SYMBOLS comment. */
    private static readonly IReadOnlyDictionary<string, string> RATE_DENOM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["h"] = "மணிக்கு", ["s"] = "வினாடிக்கு",
    };
    private static readonly IReadOnlyDictionary<string, string> RATE_NUM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "கிலோமீட்டர்", ["m"] = "மீட்டர்", ["mi"] = "மைல்", ["ft"] = "அடி",
    };

    private static string Cardinal(double n) => TamilNumbersComposer.NumberToWords(n);

    /**
     * The rate prefix, UNLESS the text already carries it. The corpus writes "மணிக்கு 480 km/h" — the Tamil
     * dative is already there in words and only the ASCII rate needs unpacking, so emitting the prefix
     * unconditionally produced "மணிக்கு மணிக்கு 480 கிலோமீட்டர்". Same shape as the duplicated الساعة the
     * Arabic run hit; found here by the corpus diff, invisible to the unit probes.
     */
    private static string Dative(string word, string full, int offset) =>
        JsRegex.Compile($"{word}\\s*$", "u").IsMatch(full[..offset]) ? "" : $"{word} ";

    /** cardinal + ordinal suffix, fused onto the LAST word (15ஆம் → பதினைந்தாம், not *பதினைந்து ஆம்). */
    private static string? Ordinal(double n, string suffix)
    {
        var words = Cardinal(n).Split(' ');
        var last = words.Length > 0 ? words[^1] : null;
        if (last is null || last == "") return null;
        var stem = TamilNumbersComposer.OrdinalStem(last);
        if (stem is null) return null;
        words[^1] = $"{stem}{(suffix == "ஆவது" || suffix == "வது" ? "ாவது" : "ாம்")}";
        return string.Join(" ", words);
    }

    // The step patterns. The TS builds several inline; JsRegex.Compile caches, so hoisting is a
    // readability choice and not a behaviour one.
    // ⚠ THE ZERO-WIDTH CLASS IS ESCAPED, NOT LITERAL. The TS spells it with the four characters
    //   themselves, which is unreadable and invisible to review — same class, stated by code point.
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\\u200b-\\u200d\\ufeff]", "gu");
    private static readonly JsRe DEGROUP = JsRegex.Compile("(?<=\\d),(?=\\d{2,3}(?:,\\d|[^\\d]|$))", "gu");
    private static readonly JsRe EGA_RE = JsRegex.Compile($"{NB}எ\\s*\\.\\s*கா\\s*\\.?{NA}", "gu");
    private static readonly JsRe DOT_RUN = JsRegex.Compile("\\s*\\.\\s*", "gu");
    private static readonly JsRe THIRU_RE = JsRegex.Compile($"{NB}திரு\\s*\\.\\s*(?=[\\p{{L}}])", "gu");
    private static readonly JsRe RATE_ASCII = JsRegex.Compile("(?<![\\p{L}\\d])(\\d[\\d.]*)\\s?(km|mi|ft|m)\\s?/\\s?(h|s)(?![A-Za-z])", "giu");
    private static readonly JsRe RATE_MPH = JsRegex.Compile($"(\\d[\\d.]*)\\s?mph{NA}", "giu");
    private static readonly JsRe CLOCK_DOT_TZ = JsRegex.Compile("(?<![\\d.:])([01]?\\d|2[0-3])\\.([0-5]\\d)(?=\\s*(?:UTC|GMT))", "gu");
    private static readonly JsRe CLOCK_ZERO = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):00(?![\\d:.])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<=\\d):(?=\\d)", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_START = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe FRACTION_RE = JsRegex.Compile("(?<![\\d./])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe LOCATIVE = JsRegex.Compile("(\\d)\\s*-?\\s*ல்(?![\\p{L}\\p{M}])", "gu");

    /**
     * The Tamil normalizer. A numbered, ORDER-DEPENDENT sequence; the coupling is stated at each step because
     * a future reader cannot recover it from the code.
     */
    public static string NormalizeTamil(string input)
    {
        // 1) ZERO-WIDTH characters (×20 in the corpus, mostly a doubled ZWSP after a comma). Removed FIRST:
        //    every later rule asserts letter/digit adjacency, and an invisible character sitting inside a
        //    numeral or between a number and its unit defeats all of them.
        var s = JsRegex.Replace(input, ZERO_WIDTH, _ => "");

        // 1b) TAMIL DIGITS ௦-௯ → ASCII. None occur in the corpus (a negative result the file header records),
        //     but without the fold the engine returned an EMPTY STRING for them: `\d+` is ASCII-only, so a
        //     native numeral matched no token and assembleClauses dropped it entirely.
        s = Unicode.FoldNativeDigits(s);

        // 2) DIGIT DE-GROUPING, before anything that reads punctuation. A grouping comma is otherwise clause
        //    punctuation and 2,243 became "இரண்டு <pause> இருநூற்றி நாற்பத்தி மூன்று" — and 5,000,000 became
        //    "ஐந்து <pause> பூஜ்ஜியம் <pause> பூஜ்ஜியம்". BOTH grouping systems occur: Western 3-digit blocks
        //    (100,000) and Indian 2-then-3 (7,83,562), so the block is 2 OR 3 digits. Requiring ≥2 digits
        //    after the comma is what keeps a genuine list ("11, 12 வது" — always spaced) out of the rule.
        s = JsRegex.Replace(s, DEGROUP, _ => "");

        // 3) ERA markers, BEFORE the initialism rule (step 4) — கி.மு. is a letter pair by shape and would
        //    otherwise be spelled out as [kɪ mʊ] with the era lost.
        s = JsRegex.Replace(s, ERA_RE, m => ERA[m.Groups[1].Value]);
        s = JsRegex.Replace(s, EGA_RE, _ => "எடுத்துக்காட்டாக");

        // 4) MULTI-DOT ABBREVIATIONS before single-dot ones, else the interior dot survives as a phrase break:
        //    எம்.ஆர்.ஐ was reading as [ˈem . ˈaːr . ˈaᶦ], three clauses. Dotted Tamil unit abbreviations
        //    (கி.மீ ×6, மி.மி ×2) are folded to their full word here too, before the letter-name rule, since
        //    கி/மீ are not letter names and would otherwise keep their dot.
        s = JsRegex.Replace(s, TAMIL_UNIT_DOT_RE, m =>
        {
            string a = m.Groups[1].Value, b = m.Groups[2].Value;
            return TAMIL_UNIT.GetValueOrDefault($"{a}{b}") ?? TAMIL_UNIT.GetValueOrDefault($"{a}மீ") ?? $"{a}{b}";
        });
        s = JsRegex.Replace(s, TAMIL_UNIT_SPACED_RE, m =>
        {
            string a = m.Groups[1].Value, b = m.Groups[2].Value;
            return TAMIL_UNIT.GetValueOrDefault($"{a}{b}") ?? TAMIL_UNIT.GetValueOrDefault($"{a}மீ") ?? $"{a} {b}";
        });
        s = JsRegex.Replace(s, TAMIL_UNIT_RE, m => TAMIL_UNIT[m.Groups[1].Value]);
        s = JsRegex.Replace(s, INITIALISM_RE, m => JsRegex.Replace(m.Value, DOT_RUN, _ => " ").Trim());
        //    திரு. (Mr.) — a single-dot abbreviation, ×3; its dot was a phrase break mid-sentence.
        s = JsRegex.Replace(s, THIRU_RE, _ => "திரு ");

        // 5) RATE units, before the shared unit tier (step 6) claims the numerator and strands the `/x`.
        //    Prefix + dative, which is the Tamil idiom and is attested verbatim in this corpus
        //    ("மணிக்கு 64 கி.மீ", "வினாடிக்கு 1.5 கிலோமீட்டர்"). mph is the same shape spelled as one token.
        // The closing boundary is `(?![A-Za-z])`, NOT the general letter class: the corpus writes
        // "160km/hக்கு" with a Tamil case clitic welded to the denominator, and a `\p{L}` guard rejected
        // it — after which the shared tier claimed "160km" and left "/h" stranded as the letter H.
        var full5 = s;
        s = JsRegex.Replace(s, RATE_ASCII, m =>
        {
            var num = RATE_NUM.GetValueOrDefault(m.Groups[2].Value.ToLowerInvariant());
            var d = RATE_DENOM.GetValueOrDefault(m.Groups[3].Value.ToLowerInvariant());
            if (num is null || d is null) return m.Value;
            return $"{Dative(d, full5, m.Index)}{m.Groups[1].Value} {num}";
        });
        var full5b = s;
        s = JsRegex.Replace(s, RATE_MPH, m => $"{Dative("மணிக்கு", full5b, m.Index)}{m.Groups[1].Value} மைல்");

        // 6) The SHARED symbol tier: percent, currency, units, exponents. UNITS BEFORE DECIMALS (step 8) —
        //    the tier matches a unit only when a NUMBER is adjacent, and rewriting "3.50 மீ" to
        //    "3 புள்ளி 5 0 மீ" first would destroy that adjacency. It also runs AFTER de-grouping so that
        //    "US$22,500" is one number, and after the rate rule so `km/h` is already gone.
        s = SYMBOLS(s);

        // 7) TIMES BEFORE the decimal and sign steps: a bare-number rule must not claim 11:30, and 15.00 UTC
        //    is a clock, not a decimal.
        //    (a) the dotted clock, which only appears with an explicit zone (15.00 UTC, 12.00 GMT ×2).
        s = JsRegex.Replace(s, CLOCK_DOT_TZ, m =>
            Js.Number(m.Groups[2].Value) == 0 ? m.Groups[1].Value : $"{m.Groups[1].Value} {m.Groups[2].Value}");
        //    (b) :00 minutes are DROPPED, not read: "11:00 மணிக்கு" is பதினொன்று மணிக்கு, and reading the
        //    zeros gave "பதினொன்று பூஜ்ஜியம் பூஜ்ஜியம் மணிக்கு".
        s = JsRegex.Replace(s, CLOCK_ZERO, m => m.Groups[1].Value);
        //    (c) every remaining digit-colon-digit becomes a SPACE. The colon is clause punctuation in this
        //    engine, so it was inserting a pause inside 10:08, 06:30 and the sports times 4:41.30 / 2:11.60 /
        //    1:09.02. A fuller "H மணி M நிமிடம்" rendering was REJECTED after reading the corpus: 13 of the 15
        //    wall-clock instances already carry மணிக்கு/மணியளவில் in the text, so it would duplicate the noun.
        s = JsRegex.Replace(s, CLOCK_COLON, _ => " ");

        // 8) DECIMALS, after units and times have taken their share. Tamil reads the fractional part digit by
        //    digit after புள்ளி ("point"), so they are separated — 3.50 → மூன்று புள்ளி ஐந்து பூஜ்ஜியம்.
        s = JsRegex.Replace(s, DECIMAL_RE, m =>
            $"{m.Groups[1].Value} புள்ளி {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 8b) PLUS — SOURCED FROM THE CORPUS'S OWN AUDIO
        s = JsRegex.Replace(s, PLUSMINUS, _ => " கூட்டல் கழித்தல் ");
        s = JsRegex.Replace(s, PLUS_AFTER, m => $"{m.Groups[1].Value} பிளஸ் {m.Groups[2].Value}");
        s = JsRegex.Replace(s, PLUS_START, m => $"{m.Groups[1].Value}பிளஸ் {m.Groups[2].Value}");

        // 8c) THE RELATIONAL AND DIVISION SIGNS
        s = PostposedSignPass.PostposedSign(s, "<", "ஐ விட குறைவாக");
        s = PostposedSignPass.PostposedSign(s, ">", "ஐ விட அதிகமாக");
        s = JsRegex.Replace(s, EQUALS, _ => " சமம் ");
        s = JsRegex.Replace(s, DIVIDE, _ => " வகுத்தல் ");

        // 9) DEGREES. One bare `35 ° W` plus the spelled-out டிகிரி elsewhere; the scale letter is matched
        //    case-insensitively because the corpus writes both C and c.
        s = JsRegex.Replace(s, DEG_C, m => $"{m.Groups[1].Value} டிகிரி செல்சியஸ்");
        s = JsRegex.Replace(s, DEG_F, m => $"{m.Groups[1].Value} டிகிரி பாரன்ஹீட்");
        s = JsRegex.Replace(s, DEG_BARE, m => $"{m.Groups[1].Value} டிகிரி");

        // 10) FRACTIONS. Only after the rate rule, which also owns `/`. Tamil lexicalises ½/¼/¾; anything
        //     else takes the "N-இல் M பங்கு" frame (1/5 → ஐந்தில் ஒரு பங்கு).
        s = JsRegex.Replace(s, FRACTION_RE, m =>
        {
            string a = m.Groups[1].Value, b = m.Groups[2].Value;
            var lex = FRACTION_WORD.GetValueOrDefault($"{a}/{b}");
            if (lex is not null) return lex;
            var tail = Cardinal(Js.Number(b)).Split(' ');
            var den = TamilNumbersComposer.OrdinalStem(tail.Length > 0 ? tail[^1] : "");
            if (den is null || Js.Number(b) == 0) return m.Value;
            var dw = Cardinal(Js.Number(b)).Split(' ');
            dw[^1] = $"{den}ில்";
            return $"{string.Join(" ", dw)} {(Js.Number(a) == 1 ? "ஒரு" : Cardinal(Js.Number(a)))} பங்கு";
        });

        // 11) ORDINALS, last of the digit rules — it must see a de-grouped, de-colonised numeral, and it
        //     consumes the hyphen that the range/clitic forms also use. Tamil fuses the suffix onto the final
        //     cardinal word (2019-ஆம் → இரண்டாயிரத்து பத்தொன்பதாம்); emitted apart, ஆம் reached the g2p as a
        //     stray [aːm]. All 105 digit-adjacent ஆம்/ம்/வது in the corpus are ordinals — checked by
        //     tabulating what follows, which is ஆண்டு / நூற்றாண்டு / தேதி / பிரிவு every time.
        s = JsRegex.Replace(s, ORDINAL_RE, m =>
            Ordinal(Js.Number(m.Groups[1].Value), m.Groups[2].Value) ?? m.Value);

        // 12) The LOCATIVE clitic written as bare ல் (×14, "1444-ல்"). Alone it is a single consonant and
        //     reached the output as [l]; இல் is the full form of the same case marker and is what the corpus
        //     writes in the other 28 instances. Attaching the case to the numeral's oblique properly
        //     (ஆயிரத்து நானூற்று நாற்பத்து நான்கில்) is left undone — see the header of the commit.
        s = JsRegex.Replace(s, LOCATIVE, m => $"{m.Groups[1].Value} இல்");

        return s;
    }
}
