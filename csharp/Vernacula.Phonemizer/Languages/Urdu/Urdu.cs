/**
 * Native Urdu (ur) text phonemizer — canonical IPA. Urdu = Hindi phonology in the
 * Perso-Arabic abjad; the g2p (g2p.ts) does the script→IPA mapping, this file layers weight-based stress
 * (shared with Hindi), numbers, clause punctuation, and embedded-Latin routing. Short-vowel restoration for
 * undiacritized text is DEFERRED (the g2p inserts a default [ə]).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Urdu;

public static class UrduPhonemizer
{
    private static UrduDef DEF => G2p.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    // Urdu uses ASCII 0-9 and the Perso-Arabic (Eastern Arabic) digits ۰-۹.
    private static readonly IReadOnlyDictionary<string, string> EASTERN_DIGITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["۰"] = "0", ["۱"] = "1", ["۲"] = "2", ["۳"] = "3", ["۴"] = "4",
        ["۵"] = "5", ["۶"] = "6", ["۷"] = "7", ["۸"] = "8", ["۹"] = "9",
    };
    private static readonly string DIGIT_CLASS = "0-9" + string.Concat(EASTERN_DIGITS.Keys);
    // Arabic-script word range (U+0600–06FF + U+0750–077F extensions), excluding the digits/punctuation handled below.
    private const string URDU_WORD = "ء-ٟٮ-ۓە-ۜ۞-ۿ";

    // COVERAGE layer: an undiacritized skeleton whose vocalization we've mined is looked up here and returned as
    // canonical IPA DIRECTLY, short-circuiting the g2p's default-schwa guess. Urdu stores IPA (not harakat) because
    // harakat can't encode the majhūl ی=iː~eː / و=oː~uː distinction the cross-script Hindi gold provides; see
    // tools/perso-arabic/build_ur_ipa_lexicon.ts. Entries are UNSTRESSED (weight-stress applied at lookup).
    // Loaded LAZILY (registry.ts imports every rider eagerly; the TSV is only read on first Urdu use).
    private static Dictionary<string, string>? LEXICON;
    private static Dictionary<string, string> IpaLexicon() =>
        LEXICON ??= LoadTsv.LoadTsvMap("languages/urdu", "lexicon-ipa.tsv", optional: true);

    /** The coverage lexicon's key set (covered skeletons), for the neural rider pre-pass to leave covered words bare. */
    public static IReadOnlyDictionary<string, string> CoverageLexicon() => IpaLexicon();

    private static readonly JsRe EXPLICIT_MARK = JsRegex.Compile("̲", "gu");
    private static readonly JsRe N_BEFORE_LABIAL = JsRegex.Compile("n(?=[bp])", "gu");
    private static readonly JsRe N_BEFORE_VELAR = JsRegex.Compile("n(?=[kɡ])", "gu");

    /**
     * Post-g2p canonicalisation (UNSTRESSED): turn raw g2p output into final canonical IPA. Shared by the core and the
     * IPA-lexicon BUILDER (tools/perso-arabic/build_ur_ipa_lexicon.ts) so a stored lexicon value is byte-identical to
     * what the core would emit — the lexicon short-circuit then only needs weight-stress, not this whole tail.
     *   - deleteMedialSchwa: the g2p inserts a default [ə] for every unwritten short vowel; Urdu (like Hindi) DELETES it
     *     in a medial V·C·ə·C·V context so clusters surface bare (پاکستان → pɑːkst̪ɑːn). Explicit vowels are marked with
     *     ̲ and survive.
     *   - strip ̲ (U+0332): the explicit-fatḥa protection mark is an internal marker, never part of the output.
     *   - nasal PLACE assimilation: /n/ → [m] before a labial (b/p), [ŋ] before a velar (k/ɡ) — انبار→əmbɑːɾ, انگور→əŋɡuːɾ.
     */
    public static string FinalizeUrduIpa(string ipa) =>
        N_BEFORE_VELAR.Replace(
            N_BEFORE_LABIAL.Replace(
                EXPLICIT_MARK.Replace(Schwa.DeleteMedialSchwa(ipa), ""), "m"), "ŋ");

    /** Lexicon-FREE core: g2p + finalize + weight stress. Used by the number path and the mining tool, which must NOT
     *  consult the content lexicon (number words / mining candidates would collide with content homographs).
     *  NOTE: word-final ـیہ (ی+ہ) is deliberately NOT rewritten — the ending is genuinely ambiguous (feminine -iyya
     *  حاشیہ→[jɑ] vs masculine Arabic -īh فقیہ→[iːh]) with no orthographic signal, so it is a per-word lexicon matter. */
    public static string PhonemizeWordCore(string word)
    {
        var ipa = G2p.PhonemizeWord(word);
        if (string.IsNullOrEmpty(ipa)) return "";
        return WeightStress.ApplyWeightStress(FinalizeUrduIpa(ipa)).Normalize(System.Text.NormalizationForm.FormC);
    }

    /** One Urdu word → canonical IPA. If the writer supplied harakat, respect it (g2p reads the explicit vowels);
     *  else consult the IPA coverage lexicon (short-circuit straight to canonical IPA + weight-stress); else the
     *  lexicon-free default-schwa core. */
    public static string PhonemizeWord(string word)
    {
        if (!HarakatLexicon.HARAKAT.IsMatch(word))
        {
            if (IpaLexicon().TryGetValue(word.Normalize(System.Text.NormalizationForm.FormC), out var ipa)
                && ipa.Length > 0)
                return WeightStress.ApplyWeightStress(ipa).Normalize(System.Text.NormalizationForm.FormC);
        }
        return PhonemizeWordCore(word);
    }

    // Urdu had no symbol tier at all: "3%" read as just "تین", losing the percent.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — the tier's own `ampersand` note says so,
        // and this language is one of the fourteen that still had no word declared, so `&` was DROPPED outright.
        // اور is ×1476 TOKEN in this language's own corpus, i.e. among its commonest words; there was nothing to source.
        //
        // A Latin-script printing LIGATURE rather than anything native, so what it takes is a reading and not a
        // translation: for a language written in Latin script that is its own conjunction, and for one that is not,
        // the symbol only ever arrives inside a Latin run. Either way the tier substitutes the conjunction, SPACED —
        // see the tier, where the spacing exists because `B&B` is two initialisms.
        Ampersand = "اور",
        // `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
        // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
        // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
        // defaults to it — this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "ضرب" },
        Percent = new[] { "فیصد" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["₨"] = new[] { "روپے" }, ["$"] = new[] { "ڈالر" }, ["€"] = new[] { "یورو" }, ["£"] = new[] { "پاؤنڈ" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "کلومیٹر" }, ["cm"] = new[] { "سینٹیمیٹر" }, ["mm"] = new[] { "ملیمیٹر" },
            ["kg"] = new[] { "کلوگرام" }, ["m"] = new[] { "میٹر" }, ["g"] = new[] { "گرام" },
            ["km/h"] = new[] { "کلومیٹر فی گھنٹہ" },
        },
        // `مربع کلومیٹر` ×9 and `کیوبک میٹر` ×1, both word-first — note Urdu puts مربع BEFORE its noun where
        // Arabic puts the cognate مربع after it. Bare مربع ×20 is mostly the shape, as in French and Turkish.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "مربع" }, Cubed = new[] { "کیوبک" }, Position = "before",
        },
    });

    // The foreign arm is `LATIN_RUN`, ALL of Latin plus marks — not `[A-Za-z]+`, which ended the token at a
    // diacritic and left that letter to be read as an English letter name (`Cañitas` → *ka ˈɛn ˈitas*). This
    // engine ROUTES a foreign word to the injected reader, so widening the class is the whole fix.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([{URDU_WORD}]+)|({HostWord.LATIN_RUN})|([{DIGIT_CLASS}]+(?:[.,][{DIGIT_CLASS}]+)?)|([۔؟،؛.?!,;:])",
        "gu");

    /** The Urdu-specific rewrites, built once against the manifest's numbers definition. */
    private static readonly Func<string, string> NormalizeUrdu = Normalize.MakeUrduNormalizer(G2p.DEF.Numbers);

    private static string ToAscii(string d) =>
        string.Concat(Js.CodePoints(d).Where(c => c != ",").Select(c => EASTERN_DIGITS.GetValueOrDefault(c, c)));

    private static string Number(string digits)
    {
        // A DECIMAL is read as the integer part, the decimal word, then the fractional digits one by one.
        // Without this the guard below returned the raw string and "1.5" LEAKED ASCII DIGITS into the IPA.
        var split = ToAscii(digits).Split('.');
        var intPart = split[0];
        var frac = split.Length > 1 ? split[1] : null;
        var n = Js.Number(intPart);
        // ⚠ ABOVE 2^53 THIS USED TO RETURN "" AND THE NUMBER VANISHED FROM THE READING. Refusing to COMPOSE is
        // right — the float has already lost the low digits, so the numeral would be confidently wrong — but the
        // guard had no else. Digit-at-a-time is exactly what the decimal tail below already does, so the
        // fallback needs no word this engine's data was never measured on. Above 2^53 the reading is a digit
        // string, not a quantity.
        var head = double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d
            ? Core.Numbers.RenderNumber(n, DEF.Numbers, PhonemizeWordCore) // numbers bypass the content lexicon
            : Core.Numbers.SpellDigits(intPart, DEF.Numbers, PhonemizeWordCore);
        if (frac is null || frac == "") return head;
        var dot = DEF.Numbers.DecimalWord;
        var tail = Js.CodePoints(frac).Select(d => Core.Numbers.RenderNumber(Js.Number(d), DEF.Numbers, PhonemizeWordCore));
        return string.Join(" ", new[] { head, !string.IsNullOrEmpty(dot) ? PhonemizeWordCore(dot) : "" }
            .Concat(tail).Where(x => x != ""));
    }

    private sealed class Engine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign = null) => _foreign = foreign;

        public string Text(string input)
        {
            // Urdu-specific rewrites (ordinal suffixes, clock, spaced units, signs, fractions) then the
            // shared symbol tier, which Urdu lacked entirely — % and every currency sign were DROPPED.
            return Clauses.AssembleClauses(SYMBOLS(NormalizeUrdu(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    sink.Emit(_foreign is not null ? _foreign(m.Groups[2].Value) : "");
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Urdu phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateUrdu(Func<string, string>? foreign = null) => new Engine(foreign);

    internal static void RegisterSelf()
    {
        Registry.Register("urdu", () => CreateUrdu(Registry.ReadAsEnglish));
        // The neural rider's coverage-lexicon accessor — see RiderNeural's port note on why this registers
        // rather than being declared statically as the TypeScript does.
        RiderNeural.RegisterRider("ur", CoverageLexicon);
    }
}
