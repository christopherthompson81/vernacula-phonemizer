/**
 * Modern Greek (el) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ GREEK CARRIES THE HIGHEST RATE OF EMBEDDED LATIN OF ANY LANGUAGE MEASURED — roughly one utterance in
 * seven. Most of it is brand and place names left alone deliberately (see below), but the all-caps
 * initialisms have to be claimed, or `το FBI` reads with ENGLISH phonemes in a Greek stream
 * (to ˈɛfbˈiːʲˈaᶦ) and `η UNESCO` comes out carrying ɪ ʊ ɹ ʃ d͡ʒ æ ɫ.
 *
 * ⚠ LATIN↔GREEK HOMOGLYPHS ARE A REAL CLASS HERE, not a curiosity: a Latin `o` typed for the article ο makes
 * the word vanish into the foreign path (`και o αγριόκουρκος` → ce ˈoᶷ aɣɾʝokuɾkos). See step 1.
 *
 * ⚠ GREEK GROUPS THOUSANDS WITH A PERIOD AND TAKES A COMMA DECIMAL, so both separators reach
 * `clausePunctuation` as pauses unless claimed: `1.000 άτομα` → *ena . miðen atoma*.
 *
 * ⚠ THE ORDINAL ENDING IS THE CASE (15ο, 1η, 18ου, 9ης), not a fixed suffix — see step 7.
 *
 * ⚠ NEVER `\b` IN THIS FILE. It is ASCII-defined and finds no boundary against Greek script, so a rule
 * written with it silently matches NOTHING. Every boundary here is an explicit `(?<![\p{L}\p{M}])` /
 * `(?![\p{L}\p{M}])` lookaround.
 *
 * NOT DONE, deliberately:
 *   · NUMERIC RANGES — `3-5%`, `35-40 μίλια`. A Greek reader supplies a connective (έως / με), but which one
 *     is a register choice the text cannot settle, and the dash also occurs in `COVID-19`, `Super-G`,
 *     `1984-1985` and `Il-76`.
 *   · MIXED-CASE LATIN, the bulk of the embedded runs — brand and place names. Same call Japanese and Thai
 *     made: letter-spelling is not an available reading for `Xinhua`, and transliterating a name is invention.
 *   · AGE COMPOUNDS like `53χρονης`, whose reading is one fused word (πενηντατριάχρονης). A wrong compound is
 *     worse than the space it currently gets.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Greek;

public static class Normalize
{
    // ── data ────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Latin→Greek HOMOGLYPHS. Only ever applied where a Latin letter TOUCHES Greek script, i.e. inside a
     * token that is already broken — see step 1 for why the corpus contains these at all.
     */
    private static readonly IReadOnlyDictionary<string, string> HOMOGLYPH = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["A"] = "Α", ["B"] = "Β", ["E"] = "Ε", ["H"] = "Η", ["I"] = "Ι", ["K"] = "Κ", ["M"] = "Μ",
        ["N"] = "Ν", ["O"] = "Ο", ["P"] = "Ρ", ["T"] = "Τ", ["X"] = "Χ", ["Y"] = "Υ", ["Z"] = "Ζ",
        ["a"] = "α", ["e"] = "ε", ["i"] = "ι", ["k"] = "κ", ["o"] = "ο", ["p"] = "ρ", ["t"] = "τ",
        ["u"] = "υ", ["v"] = "ν", ["x"] = "χ", ["y"] = "υ",
    };

    /**
     * LATIN letter → its GREEK letter name. Greek reads a Latin-script initialism with the ENGLISH letter
     * names written in Greek orthography — ΝΤΙ ΒΙ ΝΤΙ for DVD, ΕΦ ΜΠΙ ΑΪ for FBI.
     *
     * The names are emitted SPACED, not joined: μπ is [b] word-initially but prenasalised [mb] medially, so
     * joining «εφ»+«μπι» would read the B of FBI as [mb]. Greek writes them spaced too.
     */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "έι", ["b"] = "μπι", ["c"] = "σι", ["d"] = "ντι", ["e"] = "ι", ["f"] = "εφ", ["g"] = "τζι",
        ["h"] = "έιτς", ["i"] = "άι", ["j"] = "τζέι", ["k"] = "κέι", ["l"] = "ελ", ["m"] = "εμ", ["n"] = "εν",
        ["o"] = "όου", ["p"] = "πι", ["q"] = "κιου", ["r"] = "αρ", ["s"] = "ες", ["t"] = "τι", ["u"] = "γιου",
        ["v"] = "βι", ["w"] = "ντάμπλιου", ["x"] = "εξ", ["y"] = "γουάι", ["z"] = "ζετ",
    };

    /**
     * Acronyms Greek reads as a WORD rather than as letters. A LEXICAL fact, so this holds only established
     * ones — anything absent falls through to letter-spelling, which is always legitimate.
     */
    private static readonly IReadOnlyDictionary<string, string> WORD_ACRONYM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["UNESCO"] = "Ουνέσκο", ["NATO"] = "ΝΑΤΟ", ["NASA"] = "Νάσα", ["ISIS"] = "Ίσις",
        ["COVID"] = "Κόβιντ", ["ASUS"] = "Άσους",
    };

    /**
     * MIXED-CASE Latin is otherwise left to the foreign fallback (see the header), with one exception: `pH`
     * (×3) is an initialism that merely happens to carry a lowercase letter, so the all-caps rule cannot
     * reach it. Japanese made the same single exception for the same token.
     */
    private static readonly IReadOnlyDictionary<string, string> MIXED_CASE_INITIALISM =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["pH"] = "πι έιτς" };

    /** Ordinals 1–12, masculine nominative — the citation form the inflector works from. */
    private static readonly string[] ORD_UNITS =
    {
        "", "πρώτος", "δεύτερος", "τρίτος", "τέταρτος", "πέμπτος", "έκτος", "έβδομος", "όγδοος",
        "ένατος", "δέκατος", "ενδέκατος", "δωδέκατος",
    };

    /** Ordinal tens, masculine nominative. All OXYTONE (…ός), which changes the endings — see `inflect`. */
    private static readonly string[] ORD_TENS =
    {
        "", "", "εικοστός", "τριακοστός", "τεσσαρακοστός", "πεντηκοστός", "εξηκοστός", "εβδομηκοστός",
        "ογδοηκοστός", "ενενηκοστός",
    };

    /**
     * Written ending → the ordinal's ending, for a BARYTONE stem (πρώτος, δέκατος, όγδοος) and for an
     * OXYTONE one (εικοστός, τριακοστός), which carries the accent on the ending itself.
     *
     * Only the endings the corpus attests, plus the masculine-nominative citation form: -ο (masc.acc /
     * neut) ×34, -η (fem.nom) ×15, -ου (gen.masc/neut) ×8, -ης (gen.fem) ×5.
     */
    private static readonly IReadOnlyDictionary<string, string[]> ORD_ENDING = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        //  written        barytone  oxytone
        ["ος"] = new[] { "ος", "ός" },
        ["ου"] = new[] { "ου", "ού" },
        ["ης"] = new[] { "ης", "ής" },
        ["ο"] = new[] { "ο", "ό" },
        ["η"] = new[] { "η", "ή" },
        // The ACCENTED spellings of the same endings. An oxytone ordinal is properly written with its tonos
        // on the ending (60ό, 21ή); this corpus writes all 55 of them bare, but both spellings occur.
        ["ός"] = new[] { "ος", "ός" },
        ["ού"] = new[] { "ου", "ού" },
        ["ής"] = new[] { "ης", "ής" },
        ["ό"] = new[] { "ο", "ό" },
        ["ή"] = new[] { "η", "ή" },
    };

    /** LONGEST FIRST, so `ου` is not matched as the shorter `ο` and `ης` not as `η`. */
    private static readonly string ORD_ALT = string.Join("|", ORD_ENDING.Keys.OrderByDescending(k => k.Length));

    /** Greek ALPHABETIC numerals, for the regnal/era numbers of step 2. ΣΤ (6) is a two-letter sign. */
    private static readonly IReadOnlyDictionary<string, int> GREEK_NUMERAL = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["Α"] = 1, ["Β"] = 2, ["Γ"] = 3, ["Δ"] = 4, ["Ε"] = 5, ["ΣΤ"] = 6, ["Ϛ"] = 6, ["Ζ"] = 7,
        ["Η"] = 8, ["Θ"] = 9, ["Ι"] = 10, ["Κ"] = 20, ["Λ"] = 30, ["Μ"] = 40, ["Ν"] = 50, ["Ξ"] = 60,
        ["Ο"] = 70, ["Π"] = 80,
    };

    /**
     * FEMININE hour cardinals. Greek numerals 1/3/4 agree in gender and the clock counts ώρες (feminine):
     * «στις τρεις», never «στις τρία». The manifest's `numbers.units` are NEUTER, so a clock built on them
     * would be wrong for exactly those three.
     */
    private static readonly string[] HOUR_FEM =
    {
        "μηδέν", "μία", "δύο", "τρεις", "τέσσερις", "πέντε", "έξι", "εφτά", "οχτώ", "εννιά", "δέκα",
        "έντεκα", "δώδεκα", "δεκατρείς", "δεκατέσσερις", "δεκαπέντε", "δεκαέξι", "δεκαεφτά", "δεκαοχτώ",
        "δεκαεννιά", "είκοσι", "είκοσι μία", "είκοσι δύο", "είκοσι τρεις",
    };

    /** Minutes count λεπτά (neuter), so the plain neuter cardinals are right here. */
    private static readonly string[] MIN_UNITS = { "", "ένα", "δύο", "τρία", "τέσσερα", "πέντε", "έξι", "εφτά", "οχτώ", "εννιά" };
    private static readonly string[] MIN_TEENS =
    {
        "δέκα", "έντεκα", "δώδεκα", "δεκατρία", "δεκατέσσερα", "δεκαπέντε", "δεκαέξι", "δεκαεφτά",
        "δεκαοχτώ", "δεκαεννιά",
    };
    private static readonly string[] MIN_TENS = { "", "", "είκοσι", "τριάντα", "σαράντα", "πενήντα" };

    /** 1–59 as neuter cardinals, for the minutes of a clock time. */
    private static string MinuteWords(double m)
    {
        if (m < 10) return MIN_UNITS[(int)m];
        if (m < 20) return MIN_TEENS[(int)m - 10];
        var t = MIN_TENS[(int)Math.Floor(m / 10)];
        var u = (int)(m % 10);
        return u == 0 ? t : $"{t} {MIN_UNITS[u]}";
    }

    /**
     * Multi-dot and single-dot abbreviations. π.Χ. and π.χ. differ ONLY in the case of the χ and mean
     * entirely different things — «προ Χριστού» vs «παραδείγματος χάριν» — so this table is matched
     * CASE-SENSITIVELY on the second letter.
     */
    private static readonly IReadOnlyDictionary<string, string> DOTTED = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["π.Χ."] = "προ Χριστού",
        ["μ.Χ."] = "μετά Χριστόν",
        ["π.χ."] = "παραδείγματος χάριν",
        ["π.μ."] = "προ μεσημβρίας",
        ["μ.μ."] = "μετά μεσημβρίας",
        ["κ.λπ."] = "και λοιπά",
        ["κ.ά."] = "και άλλα",
    };

    private static readonly JsRe DOT_ESCAPE = JsRegex.Compile("\\.", "gu");
    private static readonly string DOTTED_ALT = string.Join("|", DOTTED.Keys
        .OrderByDescending(k => k.Length)
        .Select(k => DOT_ESCAPE.Replace(k, "\\.")));

    // ── the shared symbol tier ──────────────────────────────────────────────────────────────────────────

    /**
     * symbol normalization — Greek.
     *
     * NO `unitPer`. Greek does not say "A per B" for a rate; it takes the DEFINITE ARTICLE agreeing with the
     * denominator — «χιλιόμετρα ΤΗΝ ώρα» (fem), «μέτρα ΤΟ δευτερόλεπτο» (neut). The corpus itself writes the
     * long form twice, which is the evidence. `unitPer` is one invariant word and cannot express an agreeing
     * article, so rates are kept LOCAL (step 5).
     *
     * The exponent measure word IS expressible: Greek puts an agreeing adjective BEFORE the noun, exactly
     * like Russian — «783.562 τετραγωνικά χιλιόμετρα» — so `position: "before"`.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — this language is one of the fourteen
        // that still had no word declared, so `&` was DROPPED outright. και is ×2717 TOKEN in its own corpus.
        Ampersand = "και",
        // `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
        // attestation: the plausible hits are homographs of PREPOSITIONS, never the operator.
        Multiply = new MultiplyDef { Times = "επί" },
        Percent = new[] { "τοις εκατό" }, // invariant
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "δολάριο", "δολάρια" },
            ["€"] = new[] { "ευρώ" }, // indeclinable in Greek
            ["£"] = new[] { "λίρα", "λίρες" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "χιλιόμετρο", "χιλιόμετρα" },
            ["m"] = new[] { "μέτρο", "μέτρα" },
            ["cm"] = new[] { "εκατοστό", "εκατοστά" },
            ["mm"] = new[] { "χιλιοστό", "χιλιοστά" },
            ["kg"] = new[] { "κιλό", "κιλά" },
            ["g"] = new[] { "γραμμάριο", "γραμμάρια" },
            ["mi"] = new[] { "μίλι", "μίλια" },
        },
        // Greek writes the magnitude before the currency noun and takes no connective:
        // «14,7 δισεκατομμύρια δολάρια», which is how the corpus spells it out.
        Magnitudes = new[] { "χιλιάδες", "εκατομμύρια", "εκατομμύριο", "δισεκατομμύρια", "δισεκατομμύριο" },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "τετραγωνικό", "τετραγωνικά" },
            Cubed = new[] { "κυβικό", "κυβικά" },
            Position = ExponentPosition.Before,
        },
    });

    // ── helpers ─────────────────────────────────────────────────────────────────────────────────────────

    /** Inflect one masculine-nominative ordinal to the case/gender the written ending marks. */
    private static string Inflect(string bas, string written)
    {
        var forms = ORD_ENDING[written];
        // An OXYTONE ordinal (εικοστός) carries the accent on the ending, so the ending itself is accented:
        // εικοστ+ός/ό/ού/ή/ής. A barytone one (πρώτος, όγδοος) keeps its stem accent: πρώτ+ος/ο/ου/η/ης.
        var oxytone = bas.EndsWith("ός", StringComparison.Ordinal);
        return bas[..^2] + forms[oxytone ? 1 : 0];
    }

    /**
     * n → the ordinal's masculine-nominative WORDS. Greek inflects EVERY member of a compound ordinal
     * (δέκατος πέμπτος, εικοστός πρώτος), so this returns the parts and the caller inflects each.
     * Returns `null` past the range the corpus attests (1–100), so an out-of-range number is left alone.
     */
    private static string[]? OrdinalParts(double n)
    {
        if (n < 1 || n > 100 || !double.IsInteger(n)) return null;
        if (n == 100) return new[] { "εκατοστός" };
        if (n <= 12) return new[] { ORD_UNITS[(int)n] };
        if (n < 20) return new[] { "δέκατος", ORD_UNITS[(int)n - 10] };
        var t = (int)Math.Floor(n / 10);
        var u = (int)(n % 10);
        return u == 0 ? new[] { ORD_TENS[t] } : new[] { ORD_TENS[t], ORD_UNITS[u] };
    }

    /** n → the ordinal inflected to `written` ("15","ο" → «δέκατο πέμπτο»), or null if out of range. */
    private static string? Ordinal(double n, string written)
    {
        var parts = OrdinalParts(n);
        return parts is null ? null : string.Join(" ", parts.Select(p => Inflect(p, written)));
    }

    /** A run of Greek alphabetic-numeral signs → its value, or null if any sign is unknown. */
    private static double? GreekNumeralValue(string run)
    {
        double total = 0;
        var i = 0;
        while (i < run.Length)
        {
            var two = i + 2 <= run.Length ? run[i..(i + 2)] : "";
            if (two.Length == 2 && GREEK_NUMERAL.TryGetValue(two, out var tv))
            {
                total += tv;
                i += 2;
                continue;
            }
            if (!GREEK_NUMERAL.TryGetValue(run[i].ToString(), out var v)) return null;
            total += v;
            i++;
        }
        return total == 0 ? null : total;
    }

    /** One all-caps Latin run → its word reading if it has one, else its Greek letter names, spaced. */
    private static string SpellLatin(string run)
    {
        if (WORD_ACRONYM.TryGetValue(run, out var word)) return word;
        var names = new List<string>();
        foreach (var ch in Js.CodePoints(run))
        {
            if (!LETTER_NAME.TryGetValue(ch.ToLowerInvariant(), out var n)) return run; // not spellable ⇒ leave it for the foreign fallback
            names.Add(n);
        }
        return string.Join(" ", names);
    }

    // ── compiled patterns (the TS builds several of these per call with `new RegExp`) ───────────────────
    private static readonly JsRe ANO_TELEIA = JsRegex.Compile("\\u0387", "gu");
    private static readonly JsRe LATIN_TOUCHING_GREEK = JsRegex.Compile(
        "(?<=\\p{Script=Greek})[A-Za-z]+|[A-Za-z]+(?=\\p{Script=Greek})", "gu");
    private static readonly JsRe BARE_O = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d'’-])o(?![\\p{L}\\p{M}\\d'’-])", "gu");
    private static readonly JsRe SENTENCE_INITIAL_HO = JsRegex.Compile("(^|[.!;·…»]\\s+)([HO])(?=\\s+\\p{Script=Greek})", "gu");
    private static readonly JsRe GREEK_NUMERAL_RE = JsRegex.Compile("(?<![\\p{L}\\p{M}])([Α-ΩϚ]{1,4})[΄ʹʹ](?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOTTED_RE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({DOTTED_ALT})(\\s*[,;:!?)\\]»·]|\\s+\\p{{Ll}}|)", "gu");
    private static readonly JsRe VLEPE = JsRegex.Compile("(?<![\\p{L}\\p{M}])βλ\\.(?=\\s+\\p{Ll})", "gu");
    private static readonly JsRe RATE_KM_H = JsRegex.Compile("(\\d)\\s?(?:km|χλμ)\\s?\\/\\s?(?:h|ώρα)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RATE_MI_H = JsRegex.Compile("(\\d)\\s?(?:mi|μίλια)\\s?\\/\\s?(?:h|ώρα)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RATE_MPH = JsRegex.Compile("(\\d)\\s?mph(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RATE_M_S = JsRegex.Compile("(\\d)\\s?m\\s?\\/\\s?s(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe XLM_DOT = JsRegex.Compile("(?<![\\p{L}\\p{M}])χλμ\\.(?=\\s+\\p{Ll})", "gu");
    private static readonly JsRe XLM = JsRegex.Compile("(?<![\\p{L}\\p{M}])χλμ(?![\\p{L}\\p{M}.])", "gu");
    private static readonly JsRe DEGROUP = JsRegex.Compile("(\\d)\\.(\\d{3})(?!\\d)", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])(\\d{{1,3}})({ORD_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?![.,]\\d)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe HALF = JsRegex.Compile("(\\d)\\s?½", "gu");
    private static readonly JsRe QUARTER = JsRegex.Compile("(\\d)\\s?¼", "gu");
    private static readonly JsRe THREE_QUARTERS = JsRegex.Compile("(\\d)\\s?¾", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe PARENTHETICAL_DASH = JsRegex.Compile("(?<=\\S)(?:\\s+[–—]\\s*|[–—]\\s+)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\p{Nd}])(?<!\\p{Nd}[\\p{L}\\p{M}]{0,2}[.,]?[ \\t]?)[-−](?=\\p{Nd})", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d),(?=\\d)", "gu");
    private static readonly List<(JsRe Re, string Word)> MIXED_CASE_RES = MIXED_CASE_INITIALISM
        .Select(kv => (JsRegex.Compile($"(?<![\\p{{Script=Latin}}\\d]){kv.Key}(?![\\p{{Script=Latin}}\\d])", "gu"), kv.Value))
        .ToList();
    private static readonly JsRe CAPS_RUN = JsRegex.Compile("(?<![\\p{Script=Latin}\\d'’])[A-Z]{2,}(?![\\p{Script=Latin}\\d'’])", "gu");
    private static readonly JsRe SINGLE_LATIN = JsRegex.Compile("(?<![\\p{Script=Latin}\\d'’&])[A-Za-z](?![\\p{Script=Latin}\\d'’&])", "gu");

    // ── the ordered rules ───────────────────────────────────────────────────────────────────────────────

    /** Normalize one Modern Greek input string. Pure text→text. */
    public static string NormalizeGreek(string input)
    {
        var s = input;

        // 0) ANO TELEIA. Greek's semicolon is canonically U+0387, but that codepoint sits INSIDE the Greek
        //    letter range the engine's TOKEN uses for words, so it would be swallowed into the preceding word
        //    run and never reach the clause-mark alternation. Folded to U+00B7 MIDDLE DOT.
        s = ANO_TELEIA.Replace(s, "·");

        // 1) LATIN↔GREEK HOMOGLYPHS. FIRST, because every rule after this one assumes that a Latin run is
        //    genuinely foreign text, and these are not — they are Greek words with a lookalike Latin letter
        //    typed into them (`oι`, `στo`, `Bουλή`, `Yπό`), plus a bare Latin `o` typed for the article ο.
        //    Only fires where the Latin letter TOUCHES Greek script, so the token is already broken.
        s = LATIN_TOUCHING_GREEK.Replace(s, m =>
            string.Concat(Js.CodePoints(m.Value).Select(c => HOMOGLYPH.TryGetValue(c, out var g) ? g : c)));
        //    A standalone lowercase Latin `o` is the article ο. Every letter the corpus genuinely DISCUSSES
        //    as a letter is a different one, so this claims nothing real.
        s = BARE_O.Replace(s, "ο");
        //    The SENTENCE-INITIAL capitals are the same defect one case up: `H` and `O` are the only Latin
        //    letters that are also whole Greek articles (Η, Ο). Restricted to sentence-initial position and a
        //    following Greek word, which is what separates them from the genuine letter mentions.
        s = SENTENCE_INITIAL_HO.Replace(s, m => m.Groups[1].Value + HOMOGLYPH[m.Groups[2].Value]);

        // 2) GREEK ALPHABETIC NUMERALS. Before every other rule that reads Greek capitals. The corpus writes
        //    the sign as U+0384 GREEK TONOS rather than the canonical U+0374 keraia, so both are accepted.
        //    THE FORM EMITTED IS -ο (masculine accusative / neuter): five of the six corpus instances are
        //    exactly that; the sixth is a queen's regnal number and wants -η. Gender is not recoverable.
        s = GREEK_NUMERAL_RE.Replace(s, m =>
        {
            var v = GreekNumeralValue(m.Groups[1].Value);
            if (v is null) return m.Value;
            return Ordinal(v.Value, "ο") ?? m.Value;
        });

        // 3) DOTTED ABBREVIATIONS, multi-dot ones only, and BEFORE any single-dot rule so their interior dots
        //    cannot survive as phrase breaks — `300 π.Χ.` was three pauses out of one word. Matched
        //    CASE-SENSITIVELY: π.Χ. is «προ Χριστού» and π.χ. is «παραδείγματος χάριν».
        //    The FINAL dot is consumed when a lowercase word or another punctuation mark follows and KEPT
        //    otherwise; the punctuation arm is not optional, or `1000 π.Χ., οι` emits a stop AND a comma.
        s = DOTTED_RE.Replace(s, m =>
        {
            var after = m.Groups[2].Value;
            return $"{DOTTED[m.Groups[1].Value]}{(after == "" ? "." : after)}";
        });

        // 4) SINGLE-DOT ABBREVIATION `βλ.` → βλέπε. After step 3 so it cannot bite into a multi-dot form.
        s = VLEPE.Replace(s, "βλέπε");

        // 5) RATES, kept LOCAL because Greek takes an agreeing definite article, not an invariant "per".
        //    BEFORE the shared tier: the tier would otherwise claim `240 km` and strand `/h`, which then
        //    read as the English letter H.
        s = RATE_KM_H.Replace(s, "$1 χιλιόμετρα την ώρα");
        s = RATE_MI_H.Replace(s, "$1 μίλια την ώρα");
        s = RATE_MPH.Replace(s, "$1 μίλια την ώρα");
        s = RATE_M_S.Replace(s, "$1 μέτρα το δευτερόλεπτο");

        // 6) χλμ, after the rate rule has taken `χλμ / ώρα`. The dot is consumed only mid-sentence.
        s = XLM_DOT.Replace(s, "χιλιόμετρα");
        s = XLM.Replace(s, "χιλιόμετρα");

        // 7) DIGIT DE-GROUPING. FIRST among the number rules: Greek groups thousands with a PERIOD, so
        //    `1.000` was read as «ένα» + a phrase break + «μηδέν». Run twice for `5.000.000`. Only a block of
        //    EXACTLY three digits is grouping — `4:41.30` (a sports time) and `802,11` are left intact.
        for (var k = 0; k < 2; k++) s = DEGROUP.Replace(s, "$1$2");

        // 8) ORDINAL NOTATION. The Greek ending is the CASE and GENDER, not an ordinal marker: `15ο` is
        //    δέκατο πέμπτο, `9ης` ένατης — and BOTH members of a compound inflect. After step 7 so a grouped
        //    number reaches it as digits. The trailing lookaround is what stops `53χρονης` being claimed.
        s = ORDINAL_RE.Replace(s, m => Ordinal(Js.Number(m.Groups[1].Value), m.Groups[2].Value) ?? m.Value);

        // 9) CLOCK. The colon was a clause mark, so `11:00` read as «έντεκα , μηδέν». Hours are FEMININE
        //    (they count ώρες); minutes are neuter. A whole hour drops the minutes entirely.
        //    GUARDED against a SPORTS time — the corpus has three, which are minutes and decimal seconds.
        s = CLOCK.Replace(s, m =>
        {
            var hv = Js.Number(m.Groups[1].Value);
            var mv = Js.Number(m.Groups[2].Value);
            return mv == 0 ? HOUR_FEM[(int)hv] : $"{HOUR_FEM[(int)hv]} και {MinuteWords(mv)}";
        });

        // 10) DEGREES. `°C` was reading as the English letter C. Nominative plural is used.
        s = DEG_C.Replace(s, "$1 βαθμοί Κελσίου");
        s = DEG_F.Replace(s, "$1 βαθμοί Φαρενάιτ");
        s = DEG.Replace(s, "$1 βαθμοί");

        // 11) SIGNS and VULGAR FRACTIONS. `(UTC +1)`; and `29¾ επί 24½ ίντσες`, where the elided noun is
        //     feminine (ίντσα) — «είκοσι εννιά και τρία τέταρτα».
        // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it.
        s = PLUS_MINUS.Replace(s, " συν μείον ");
        s = PLUS.Replace(s, "συν ");
        s = HALF.Replace(s, "$1 και μισή");
        s = QUARTER.Replace(s, "$1 και ένα τέταρτο");
        s = THREE_QUARTERS.Replace(s, "$1 και τρία τέταρτα");

        // 11b) RELATIONAL AND DIVISION SIGNS. ⚠ SOURCED ENTIRELY AT TIER 4 — the corpus has nothing to give:
        //      `ίσον` ×0 token / ×0 substring, `διά` ×0 token / ×338 SUBSTRING (every one inside διάφορες,
        //      διαδικασία — the substring trap, and the largest count it has produced anywhere in the fleet).
        //      el.wikipedia's arithmetic articles read the notation out, which is the article class tier 4
        //      wants: "Το αποτέλεσμα εκφράζεται με ένα ίσον", "9 + 4 ίσον 1 modulo 12", "διαιρετός διά δύο".
        s = EQUALS.Replace(s, " ίσον ");
        s = LESS_THAN.Replace(s, " μικρότερο από ");
        s = GREATER_THAN.Replace(s, " μεγαλύτερο από ");
        s = DIVIDE.Replace(s, " διά ");

        // 11c) THE PARENTHETICAL DASH → A PAUSE. Greek writes an APPOSITION between dashes where English
        //      would use commas, and both dashes were dropped SILENTLY so the aside ran into its host clause.
        //      THE CORPUS SEPARATES THE TWO USES BY CHARACTER: ASCII hyphen before a digit ×29, every one a
        //      range or designation; EN DASH before a digit ×1, the parenthetical. ⚠ WHITESPACE IS THE
        //      DISCRIMINATOR — `Apollo–Soyuz` is a COMPOUND with no space either side and is left alone.
        s = PARENTHETICAL_DASH.Replace(s, ", ");

        // 11d) THE MINUS → μείον, and this one is ROBUSTNESS, not a measured repair: el_gr contains ZERO true
        //      negatives, so no gate can see it. Worth having because step 11 already voices `+` as συν.
        //      THE GUARD IS THE ONE defects.ts arrived at: no letter, mark or digit before (excluding
        //      `COVID-19`), and not a RANGE (the second lookbehind rejects `35-40`, `7:00-8:00`, `26 - 00`).
        s = MINUS.Replace(s, "μείον ");

        // 12) SHARED SYMBOL TIER: %, currency, plain units, squared/cubed. AFTER the rate and degree rules,
        //     which need the raw `km/h` and `°C`, and BEFORE the decimal rewrite of step 13 — the tier only
        //     matches a unit when a NUMBER is adjacent, and inserting «κόμμα» destroys that adjacency.
        s = SYMBOLS(s);

        // 13) DECIMAL COMMA. Greek's decimal mark is the comma and the tokenizer read it as a clause break.
        s = DECIMAL_COMMA.Replace(s, "$1 κόμμα ");

        // 14) LATIN INITIALISMS → Greek letter names. LAST of all, so every rule above still sees the ASCII
        //     it matches on. Bounded by Latin-script lookarounds on both sides and by a digit guard. A
        //     HYPHEN is deliberately NOT a boundary (`COVID-19`, `XDR-TB`); an apostrophe IS one.
        foreach (var (re, v) in MIXED_CASE_RES) s = re.Replace(s, v);
        s = CAPS_RUN.Replace(s, m => SpellLatin(m.Value));
        //     Single letters, same boundaries: the corpus's 9 remaining ones are genuine letter mentions.
        s = SINGLE_LATIN.Replace(s, m => SpellLatin(m.Value));

        return s;
    }
}
