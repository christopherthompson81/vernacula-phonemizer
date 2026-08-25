/**
 * Native Bengali (bn) text phonemizer — canonical IPA.
 * Ported from src/languages/bengali/bengali.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bengali;

public class BengaliDef : AbugidaDef
{
    public NumbersDef Numbers { get; set; } = new();
    public Dictionary<string, string> ClausePunctuation { get; set; } = new();
    public Dictionary<string, string>? Symbols { get; set; }
    public string? StripSymbols { get; set; }
    /**
     * Bengali height harmony (ɔ→o before a high vowel). Set false for Assamese, which lacks it. Default true.
     */
    public bool? HeightHarmony { get; set; }
    /**
     * Hindi/Bengali-style medial inherent-vowel deletion. Set false for Assamese, which retains it. Default
     * true.
     */
    public bool? MedialSchwaDeletion { get; set; }
    /**
     * Skip the (Bengali-specific) whole-word lexicon override — set true for a reusing language (Assamese).
     */
    public bool? SkipLexicon { get; set; }
    /**
     * UNIT ABBREVIATION → the reusing language's OWN unit nouns, replacing the Bengali table below wholesale.
     */
    public Dictionary<string, IReadOnlyList<string>>? UnitWords { get; set; }
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public BengaliSymbolTier SymbolTier { get; init; } = new();
}

/** The four entry points `makeNativeBengali` returns — the shape Assamese wraps. */
public sealed class NativeBengaliEngine
{
    public required Func<string, Func<string, string?>?, string> Word;
    public required Func<string, string> WordRules;
    public required Func<string, Func<string, string?>?, string> Number;
    public required Func<string, Func<string, string?>?, string> Text;
}

public static class Bengali
{
    /** ⚠ ONE LOAD, MODULE-LEVEL. The factory below loaded the manifest itself; the symbol tier needs it too,
     *  so the load moves here and both read the same object — matching bengali/manifest.ts on the TS side. */
    internal static readonly BengaliDef DEF = LoadManifest.Load<BengaliDef>("languages/bengali", "bengali.jsonc");

    private static Dictionary<string, string>? LEXICON;

    private static Dictionary<string, string> Lexicon()
    {
        if (LEXICON is null)
        {
            LEXICON = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var (k, v) in LoadTsv.LoadTsvMap("languages/bengali", "bengali-lexicon.tsv", optional: true))
                LEXICON[k.Normalize(System.Text.NormalizationForm.FormC)] = v;
        }
        return LEXICON;
    }

    /**
     * The symbol tier's unit nouns, in BENGALI — the default a reusing language overrides with `unitWords`.
     */
    private static readonly Dictionary<string, IReadOnlyList<string>> BENGALI_UNITS = new(StringComparer.Ordinal)
    {
        ["km"] = new[] { "কিলোমিটার" }, ["cm"] = new[] { "সেন্টিমিটার" }, ["mm"] = new[] { "মিলিমিটার" },
        ["kg"] = new[] { "কিলোগ্রাম" }, ["m"] = new[] { "মিটার" }, ["g"] = new[] { "গ্রাম" },
        ["km/h"] = new[] { "কিলোমিটার প্রতি ঘন্টা" },
    };

    private static readonly JsRe VOWEL_G = JsRegex.Compile($"[{Unicode.IPA_VOWELS}]", "g");
    private static readonly string DIGIT_CLASS = "0-9" + string.Concat(Unicode.BENGALI_DIGITS.Keys);

    private static readonly JsRe GEMINATE =
        JsRegex.Compile("(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃɾɽŋjɦ])\\1(?!͡)", "gu");
    private static readonly JsRe HIGH = JsRegex.Compile("[iu]", ""); // vowels that trigger ɔ→o raising in the preceding syllable

    private static readonly JsRe LENGTH_AFTER_ASPIRATION = JsRegex.Compile("ː([ʰʱ])", "gu");
    private static readonly JsRe HARMONY_STRIP = JsRegex.Compile("[ʰʱ̪̃͡ːʲ]", "gu");
    private static readonly JsRe AFFRICATE_ONE = JsRegex.Compile("t͡ʃ|d͡ʒ", "gu");
    private static readonly JsRe CODA_MODIFIERS = JsRegex.Compile("[ʰʱ̪͡ː̃]", "gu");
    private static readonly JsRe ANUSVARA = JsRegex.Compile("ং", "gu");
    private static readonly JsRe KHANDA_TA = JsRegex.Compile("ৎ", "gu");
    private static readonly JsRe OYA = JsRegex.Compile("ওয়া", "gu");
    private static readonly JsRe INITIAL_OYAA = JsRegex.Compile("^অ্যা", "u");
    private static readonly JsRe INITIAL_YAPHALA_AA = JsRegex.Compile("^(\\S)্যা", "u");
    private static readonly JsRe KSHA = JsRegex.Compile("ক্ষ", "gu");
    private static readonly JsRe GYA = JsRegex.Compile("জ্ঞ", "gu");
    private static readonly JsRe PHALA = JsRegex.Compile("([ক-হড়-য়])্([যবম])", "gu");

    public static NativeBengaliEngine MakeNativeBengali(
        BengaliDef def,
        Phonology? phon = null,
        Func<string, string>? foreign = null)
    {
        phon ??= PhonologyLoader.LoadSharedPhonology();
        var AE = char.ConvertFromUtf32(0xe001);
        def.VowelSigns[AE] = new AbugidaPhone { Ipa = "æ" };
        def.IndependentVowels[AE] = new AbugidaPhone { Ipa = "æ" };
        var g2p = Abugida.MakeAbugidaG2P(def, phon);
        var SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
        {
            Ampersand = DEF.SymbolTier!.Ampersand,
            Multiply = DEF.SymbolTier!.Multiply,
            Percent = DEF.SymbolTier!.Percent,
            Currency = DEF.SymbolTier!.Currency,
            ExponentWords = DEF.SymbolTier!.ExponentWords,
            // ⚠ STAYS IN CODE, exactly as the TS does: a manifest OVERRIDE with a built-in fallback, not a
            // plain table. `def` here is the per-call manifest the factory was handed, which is not always
            // the module-level DEF.
            Units = def.UnitWords ?? BENGALI_UNITS,
        });
        var normalize = Normalize.MakeBengaliNormalizer(def.Numbers);

        var CLAUSE_MARK = def.ClausePunctuation;
        var symbols = def.Symbols ?? new Dictionary<string, string>();
        var strip = def.StripSymbols ?? "";
        var symbolClass = string.Concat(symbols.Keys) + strip;
        var tokenRe = JsRegex.Compile(
            $"([{Unicode.BENGALI_WORD}]+)|({HostWord.LATIN_RUN})|([{DIGIT_CLASS}]+(?:,[{DIGIT_CLASS}]+)*(?:\\.[{DIGIT_CLASS}]+)?)"
                + $"|([।॥.?!,;:]){(symbolClass.Length > 0 ? $"|([{symbolClass}])" : "")}",
            "gu");

        /** Bengali vowel HEIGHT HARMONY: /ɔ/ raises to [o] when the immediately following syllable is OPEN
         *  (exactly one consonant between it and the next vowel) and that vowel is HIGH [i u] — kɔ.ri→ko.ri,
         *  but a CODA blocks it (kɔɾ.ʃit stays ɔ). Right-to-left so a chain can propagate (ɔ.ɡu.ni→o.ɡu.ni). */
        string Harmony(string ipa)
        {
            var vowels = VOWEL_G.Matches(ipa);
            if (vowels.Count < 2) return ipa;
            var @out = ipa;
            for (var k = vowels.Count - 2; k >= 0; k--)
            {
                var idx = vowels[k].Index;
                var cur = @out[idx].ToString();
                if (cur != "ɔ" && cur != "e") continue;
                var nextIdx = vowels[k + 1].Index;
                var nextV = @out[nextIdx].ToString();
                var between = HARMONY_STRIP.Replace(@out[(idx + 1)..nextIdx], "");
                var nBetween = Js.CodePoints(between).Count;
                if (nBetween == 0)
                {
                    if (cur == "ɔ" && (nextV == "i" || nextV == "u"))
                        @out = @out[..idx] + "o" + @out[(idx + 1)..];
                    continue;
                }
                if (nBetween != 1) continue;
                var to =
                    cur == "ɔ" && HIGH.IsMatch(nextV)
                        ? "o"
                        : cur == "e" && nextV == "a"
                          ? "æ"
                          : "";
                if (to != "") @out = @out[..idx] + to + @out[(idx + 1)..];
            }
            return @out;
        }

        /**
         * Delete the word-final inherent /ɔ/ after a SINGLE consonant; keep it (raised to [o]) after a
         * cluster.
         */
        string DeleteFinalInherent(string ipa)
        {
            if (!ipa.EndsWith("ɔ", StringComparison.Ordinal)) return ipa;
            var body = ipa[..^1];
            var bodyVowels = VOWEL_G.Matches(body);
            if (bodyVowels.Count == 0) return body; // no vowel → drop (unusual)
            var lastV = bodyVowels[^1];
            var coda = body[(lastV.Index + 1)..];
            var codaBases = CODA_MODIFIERS.Replace(AFFRICATE_ONE.Replace(coda, "C"), "");
            return coda.Contains('ː') || codaBases.Length >= 2 ? body + "o" : body;
        }

        /** Pure RULE-ENGINE word→IPA (no lexicon): the honest signal used by the referee eval. */
        string WordRules(string w)
        {
            var norm = w.Normalize(System.Text.NormalizationForm.FormC);
            norm = ANUSVARA.Replace(norm, "ঙ্"); // velar-nasal sign → full [ŋ]
            norm = KHANDA_TA.Replace(norm, "ত্"); // khanda ta → vowelless dental [t̪]
            norm = OYA.Replace(norm, "ওআ");
            norm = INITIAL_OYAA.Replace(norm, AE);
            norm = INITIAL_YAPHALA_AA.Replace(norm, "$1" + AE);
            norm = KSHA.Replace(norm, "ক্খ"); // ক্ষ conjunct → [kkʰ] (অক্ষর→ɔkkʰɔr), not [kʃ]
            norm = GYA.Replace(norm, "গ্গ"); // জ্ঞ conjunct → [ɡɡ] ('gyô': জ্ঞান→ɡɡæn), not [d͡ʒn]
            norm = PHALA.Replace(norm, m =>
            {
                var c = m.Groups[1].Value;
                var p2 = m.Groups[2].Value;
                return c == "র" || (p2 == "ব" && "ঙঞণনম".Contains(c, StringComparison.Ordinal))
                    ? m.Value
                    : m.Index == 0 ? c : c + "্" + c;
            });
            var x = g2p(norm);
            x = LENGTH_AFTER_ASPIRATION.Replace(GEMINATE.Replace(x, "$1ː"), "$1ː");
            if (def.HeightHarmony != false) x = Harmony(x); // Assamese (heightHarmony:false) lacks Bengali's ɔ→o raising
            var syls = VOWEL_G.Matches(x).Count;
            if (syls >= 2) x = DeleteFinalInherent(x);
            if (def.MedialSchwaDeletion != false) x = Schwa.DeleteMedialSchwa(x, "ɔ"); // Assamese retains medial inherent ɔ (চকৰি→sɔkɔɹi)
            return x.Normalize(System.Text.NormalizationForm.FormC);
        }

        /** SHIPPED word→IPA: a whole-word lexicon override (for the proven-lexical tail) then the rule engine. The
         *  lexicon is Bengali-specific (bengali-lexicon.tsv), so a reusing language (Assamese) sets
         *  skipLexicon:true to avoid Bengali overrides (এক→æk) leaking onto its shared spellings. */
        string Word(string w, Func<string, string?>? oov)
        {
            if (def.SkipLexicon != true)
            {
                if (Lexicon().TryGetValue(w.Normalize(System.Text.NormalizationForm.FormC), out var hit)) return hit;
            }
            if (oov is not null)
            {
                var o = oov(w);
                if (o is not null) return o;
            }
            return WordRules(w);
        }

        string ToAscii(string digits) =>
            string.Concat(Js.CodePoints(digits)
                .Where(d => d != ",")
                .Select(d => Unicode.BENGALI_DIGITS.GetValueOrDefault(d, d)));

        string Number(string digits, Func<string, string?>? oov)
        {
            string W(string x) => Word(x, oov);
            var ascii = ToAscii(digits);
            var dot = ascii.IndexOf('.');
            if (dot >= 0 && !string.IsNullOrEmpty(def.Numbers.DecimalWord))
            {
                var intHead = ascii[..dot];
                var intN = Js.Number(intHead.Length > 0 ? intHead : "0");
                var head = double.IsInteger(intN) && Math.Abs(intN) <= 9007199254740991d
                    ? Numbers.RenderNumber(intN, def.Numbers, W)
                    : Numbers.SpellDigits(intHead, def.Numbers, W);
                var frac = Js.CodePoints(ascii[(dot + 1)..]).Select(d => W(def.Numbers.Units[(int)Js.Number(d)]));
                return string.Join(" ", new[] { head, W(def.Numbers.DecimalWord!) }.Concat(frac));
            }
            var n = Js.Number(ascii);
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d)) return Numbers.SpellDigits(ascii, def.Numbers, W);
            return Numbers.RenderNumber(n, def.Numbers, W);
        }

        string Text(string input, Func<string, string?>? oovOverride)
        {
            return Clauses.AssembleClauses(SYMBOLS(normalize(input)), tokenRe, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(Word(m.Groups[1].Value, oovOverride));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(foreign is not null ? foreign(m.Groups[2].Value) : "");
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value, oovOverride));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
                else if (m.Groups.Count > 5 && m.Groups[5].Success && m.Groups[5].Value.Length > 0)
                {
                    var sym = m.Groups[5].Value;
                    if (!strip.Contains(sym, StringComparison.Ordinal) && symbols.TryGetValue(sym, out var word) && word.Length > 0)
                        sink.Emit(Word(word, oovOverride));
                }
            });
        }

        return new NativeBengaliEngine { Word = Word, WordRules = WordRules, Number = Number, Text = Text };
    }

    /** Load bengali.jsonc (beside this file) and build the Bengali phonemizer. `foreign` handles embedded Latin; the
     *  returned `text` takes an optional per-call `oovOverride` (neural path only) that injects tagger
     *  readings for OOV words (lexicon → oovOverride → rules). */
    public static NativeBengaliEngine CreateBengali(Func<string, string>? foreign = null) =>
        MakeNativeBengali(
            LoadManifest.Load<BengaliDef>("languages/bengali", "bengali.jsonc"),
            PhonologyLoader.LoadSharedPhonology(),
            foreign);

    /** The whole-word pronunciation lexicon (cross-source consensus + Kolkata gold). Exposed so the neural OOV path
     *  (bengaliNeural.ts) can skip lexicon-covered words — they are served authoritatively by the sync path. */
    public static IReadOnlyDictionary<string, string> BengaliLexicon() => Lexicon();

    private static NativeBengaliEngine? BN;

    /** Bare word→IPA, SHIPPED path (lexicon override → rule engine). For tests and real text. */
    public static string PhonemizeWord(string w) =>
        (BN ??= MakeNativeBengali(LoadManifest.Load<BengaliDef>("languages/bengali", "bengali.jsonc"))).Word(w, null);

    /**
     * Bare word→IPA, RULE-ENGINE ONLY (no lexicon) — the honest, non-circular signal for the referee eval.
     */
    public static string PhonemizeWordRules(string w) =>
        (BN ??= MakeNativeBengali(LoadManifest.Load<BengaliDef>("languages/bengali", "bengali.jsonc"))).WordRules(w);

    /** The registry's `ILanguage` adapter — `createBengali(readAsEnglish)` with no per-call OOV override. */
    private sealed class BengaliLanguage : ILanguage
    {
        private readonly NativeBengaliEngine _engine;
        internal BengaliLanguage(NativeBengaliEngine engine) => _engine = engine;
        public string Text(string input) => _engine.Text(input, null);
    }

    internal static void RegisterSelf() =>
        Registry.Register("bengali", () => new BengaliLanguage(CreateBengali(Registry.ReadAsEnglish)));
}

public sealed class BengaliSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
}
