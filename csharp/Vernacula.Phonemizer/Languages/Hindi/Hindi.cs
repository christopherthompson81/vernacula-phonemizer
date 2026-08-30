/**
 * Native Hindi text phonemizer — canonical IPA.
 * Ported from src/languages/hindi/hindi.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hindi;

public sealed class PostRule
{
    public string From { get; set; } = "";
    public string To { get; set; } = "";
}

public sealed class SchwaDeletionDef
{
    public bool? DeleteWordFinal { get; set; }
    public bool? RetainInMonosyllable { get; set; }
    public bool? RetainFinalAfterCluster { get; set; }
    /** ⚠ A word-final AVAGRAHA ⟨ऽ⟩ (U+093D) retains the inherent vowel it writes. Spelling-driven, so it
     *  overrides the deletion rule for that word alone. The SIGN itself comes from `AbugidaScript.avagraha`. */
    public bool? RetainOnAvagraha { get; set; }
}

public class HindiDef : AbugidaDef
{
    public List<PostRule> PostRules { get; set; } = new();
    public List<PostRule> FinalRules { get; set; } = new();
    public NumbersDef Numbers { get; set; } = new();
    public SchwaDeletionDef SchwaDeletion { get; set; } = new();
    public Dictionary<string, string> ClausePunctuation { get; set; } = new();
    public Dictionary<string, string>? Symbols { get; set; }
    public string? StripSymbols { get; set; }
    /**
     * ⚠ THE SHARED SYMBOL TIER's data — NOT `Symbols` above, which is the BARE-SIGN → word map this engine's
     * own tokenizer reads. Nullable because hi/mr/gu share this type and are migrating one at a time.
     */
    public HindiSymbolTier? SymbolTier { get; init; }
    /**
     * Irregular ordinals, 1–4 and 6 only. ⚠ KEYED BY STRING (JSON keys always are; the TS side gets
     * number-coercion for free and C# does not) and the TUPLE WIDTH IS LANGUAGE-SPECIFIC — this Def is
     * SHARED, and Hindi marks [masc, fem, oblique] where Gujarati adds a neuter.
     */
    public IReadOnlyDictionary<string, string[]> IrregularOrdinals { get; init; } = new Dictionary<string, string[]>();

    /**
     * The written ordinal suffixes and the agreement form each marks. ⚠ NULLABLE: this Def is SHARED, and a
     * family member that has not sourced its own ordinal orthography declares nothing and inherits Hindi's
     * rather than getting a half-built rule. See the jsonc.
     */
    public HindiOrdinalSuffixes? OrdinalSuffixes { get; init; }
}

/** Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry. */
public delegate string ForeignPhonemizer(string latin);

/** The script's word-run char class + digit map — defaults to Devanagari (Hindi/Marathi); Gujarati etc. pass
 *  their own so the whole abugida orchestration (schwa deletion, weight stress, numbers) is reused as-is. */
public sealed class AbugidaScript
{
    public required string Word { get; init; }
    public required IReadOnlyDictionary<string, string> Digits { get; init; }
    /** The script's AVAGRAHA sign, for `schwaDeletion.retainOnAvagraha`. ⚠ PER-SCRIPT, not a constant: the
     *  Brahmic blocks are aligned so it sits at offset 0x3D in each — Devanagari ऽ U+093D, Bengali ঽ U+09BD. */
    public string? Avagraha { get; init; }
}

/** The engine `makeNativeHindi` returns: the four entry points every composing language uses. */
public sealed class NativeHindiEngine
{
    public required Func<string, string> Word { get; init; }
    public required Func<string, string> WordRules { get; init; }
    public required Func<string, string> Number { get; init; }
    public required Func<string, string> Text { get; init; }
}

/** ILanguage adapter over the engine, for registry registration. */
public sealed class NativeHindiLanguage : ILanguage
{
    private readonly NativeHindiEngine _engine;
    public NativeHindiLanguage(NativeHindiEngine engine) => _engine = engine;
    public string Text(string input) => _engine.Text(input);
}

public static class Hindi
{
    /** ⚠ ONE LOAD, MODULE-LEVEL. `CreateHindi()` loaded the file per call; the symbol tier is built once at
     *  class scope and needs it too, so the load lands here and both read the same object — matching
     *  hindi/manifest.ts on the TS side. */
    internal static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/hindi", "hindi.jsonc");

    private static readonly JsRe VOWEL_G = JsRegex.Compile($"[{Unicode.IPA_VOWELS}]", "g");
    private static readonly JsRe CONS_LONG_FINAL = JsRegex.Compile($"[^{Unicode.IPA_VOWELS}]ː$");
    private static readonly JsRe AFFRICATES = JsRegex.Compile("t͡ʃ|d͡ʒ|t͡s|d͡z", "g");
    private static readonly JsRe MARKS_ETC = JsRegex.Compile("[̀-ͯʰ-ʱːˈˌ]", "g");
    private static readonly JsRe SCHWA_FINAL = JsRegex.Compile("ə$");

    /** Does the coda (a word body with the final schwa already removed) end in a consonant CLUSTER or
     *  GEMINATE? Used by `RetainFinalAfterCluster`. Affricates count as ONE consonant; a length mark ː on a
     *  consonant is a geminate and so heavy. */
    public static bool HeavyFinalCoda(string body)
    {
        // The ː is guarded to a CONSONANT so a trailing long vowel is not misread as a geminate.
        if (CONS_LONG_FINAL.IsMatch(body)) return true;
        // Affricates collapse to a single placeholder BEFORE the (combining) tie bar is stripped, so d͡z
        // still counts as one consonant.
        var collapsed = MARKS_ETC.Replace(
            AFFRICATES.Replace(body, "Ç").Normalize(NormalizationForm.FormD), "");
        var n = 0;
        var chars = Js.CodePoints(collapsed);
        for (var i = chars.Count - 1; i >= 0; i--)
        {
            var c = chars[i];
            if (Unicode.IPA_VOWELS.Contains(c, StringComparison.Ordinal)) break;
            if (c.Trim() != "") n++;
        }
        return n >= 2;
    }

    public static NativeHindiEngine MakeNativeHindi(
        HindiDef def,
        Phonology? phon = null,
        ForeignPhonemizer? foreign = null,
        AbugidaScript? script = null,
        IReadOnlyDictionary<string, string>? lexicon = null,
        /**
         * PER-LANGUAGE OVERRIDES for the two things that are Hindi's LEXICAL choices rather than its engine.
         */
        Func<string, string>? normalizeOverride = null,
        Func<string, string>? symbolsOverride = null)
    {
        phon ??= PhonologyLoader.LoadSharedPhonology();
        script ??= new AbugidaScript { Word = Unicode.DEVANAGARI_WORD, Digits = Unicode.DEVANAGARI_DIGITS, Avagraha = "ऽ" };
        var g2p = Abugida.MakeAbugidaG2P(def, phon);
        var DIGIT_CLASS = "0-9" + string.Concat(script.Digits.Keys);
        var CLAUSE_MARK = def.ClausePunctuation; // Devanagari danda ।/॥ + ASCII → canonical pause
        var post = def.PostRules.Select(r => (Re: JsRegex.Compile(r.From, "gu"), r.To)).ToList();
        var fin = def.FinalRules.Select(r => (Re: JsRegex.Compile(r.From, "gu"), r.To)).ToList();
        var symbols = def.Symbols ?? new Dictionary<string, string>();
        var strip = def.StripSymbols ?? "";
        var symbolClass = string.Concat(symbols.Keys) + strip;
        // ⚠ The Latin group spans ALL of Latin, not just ASCII: the group already means "foreign" (its
        // match goes straight to the injected reader), and narrowing it shreds accented foreign names.
        var tokenRe = JsRegex.Compile(
            $"([{script.Word}]+)|(\\p{{Script=Latin}}[\\p{{Script=Latin}}\\p{{M}}]*)|([{DIGIT_CLASS}]+(?:(?<!(?<![{DIGIT_CLASS}])0),[{DIGIT_CLASS}]+)*(?:\\.[{DIGIT_CLASS}]+)?)"
            + $"|([।॥.?!,;:]){(symbolClass.Length > 0 ? $"|([{symbolClass}])" : "")}",
            "gu");

        // ⚠ Fail loudly rather than silently do nothing: a manifest asking for avagraha retention under a
        // script that declares no avagraha would read as though the rule were on while every schwa deleted.
        var retainOnAvagraha = def.SchwaDeletion.RetainOnAvagraha == true;
        if (retainOnAvagraha && script.Avagraha is null)
            throw new InvalidOperationException("schwaDeletion.retainOnAvagraha is set but this script declares no `avagraha` sign");

        /**
         * Pure RULE-ENGINE word→IPA (no lexicon) — the honest, non-circular signal used by the referee eval.
         */
        string WordRules(string w)
        {
            var x = g2p(w);
            // ⚠ The avagraha ⟨ऽ⟩ is read from the SPELLING, not the phones: g2p drops the character, so
            // there is nothing downstream to test.
            var avagraha = retainOnAvagraha && w.EndsWith(script.Avagraha!, StringComparison.Ordinal);
            foreach (var r in post) x = r.Re.Replace(x, r.To);
            var syls = VOWEL_G.Matches(x).Count;
            if (def.SchwaDeletion.DeleteWordFinal == true
                && !avagraha
                && !(def.SchwaDeletion.RetainInMonosyllable == true && syls <= 1)
                && !(def.SchwaDeletion.RetainFinalAfterCluster == true
                     && SCHWA_FINAL.IsMatch(x)
                     && HeavyFinalCoda(x[..^1])))
                x = SCHWA_FINAL.Replace(x, "");
            x = Schwa.DeleteMedialSchwa(x);
            foreach (var r in fin) x = r.Re.Replace(x, r.To);
            return WeightStress.ApplyWeightStress(x).Normalize(NormalizationForm.FormC);
        }

        /** SHIPPED word→IPA: a whole-word lexicon override then the rule engine. */
        string Word(string w) =>
            lexicon is not null && lexicon.TryGetValue(Js.Normalize(w, NormalizationForm.FormC), out var v) ? v : WordRules(w);

        string ToAscii(string digits) =>
            string.Concat(Js.CodePoints(digits)
                .Where(d => d != ",")
                .Select(d => script.Digits.TryGetValue(d, out var a) ? a : d));

        string Number(string digits)
        {
            var ascii = ToAscii(digits);
            var dot = ascii.IndexOf('.');
            if (dot >= 0 && !string.IsNullOrEmpty(def.Numbers.DecimalWord))
            {
                // JS `Number` semantics: above 2^53 the float has lost its low digits, so the integer head
                // is spelled digit-at-a-time out of `def.Numbers.Units` rather than composed.
                var intText = ascii[..dot];
                var intN = Js.Number(intText.Length > 0 ? intText : "0");
                var head = double.IsInteger(intN) && Math.Abs(intN) <= 9007199254740991d
                    ? Core.Numbers.RenderNumber(intN, def.Numbers, Word)
                    : Core.Numbers.SpellDigits(intText, def.Numbers, Word);
                var frac = Js.CodePoints(ascii[(dot + 1)..]).Select(d => Word((Core.Numbers.DigitWord(def.Numbers.Units, d) ?? d)));
                return string.Join(" ", new[] { head, Word(def.Numbers.DecimalWord!) }.Concat(frac));
            }
            var n = Js.Number(ascii);
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d)) return Core.Numbers.SpellDigits(ascii, def.Numbers, Word);
            return Core.Numbers.RenderNumber(n, def.Numbers, Word);
        }

        // ⚠ The Hindi-specific rewrites run BEFORE the shared symbol tier, whose unit keys are LATIN.
        var normalize = normalizeOverride ?? Normalize.MakeHindiNormalizer(def.Numbers, def);
        var symbolTier = symbolsOverride ?? SYMBOLS;

        string Text(string input)
        {
            return Clauses.AssembleClauses(symbolTier(normalize(input)), tokenRe, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(Word(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(foreign is not null ? foreign(m.Groups[2].Value) : "");
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[4].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
                else if (m.Groups.Count > 5 && m.Groups[5].Success && m.Groups[5].Value.Length > 0)
                {
                    var sym = m.Groups[5].Value;
                    if (!strip.Contains(sym, StringComparison.Ordinal) && symbols.TryGetValue(sym, out var w) && w.Length > 0)
                        sink.Emit(Word(w));
                }
            });
        }

        return new NativeHindiEngine { Word = Word, WordRules = WordRules, Number = Number, Text = Text };
    }

    /** प्रतिशत is invariant, and the units follow the number. (Full sourcing notes: hindi.ts.) */
    internal static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = DEF.SymbolTier!.Percent,
        Currency = DEF.SymbolTier!.Currency,
        Units = DEF.SymbolTier!.Units,
        ExponentWords = DEF.SymbolTier!.ExponentWords,
        BareExponent = DEF.SymbolTier!.BareExponent,
        Multiply = DEF.SymbolTier!.Multiply,
    });

    /** Load hindi.jsonc and build the Hindi phonemizer. `foreign` handles embedded Latin. */
    public static NativeHindiEngine CreateHindi(ForeignPhonemizer? foreign = null) =>
        MakeNativeHindi(
            DEF,
            PhonologyLoader.LoadSharedPhonology(),
            foreign);

    internal static void RegisterSelf() =>
        Registry.Register("hindi", () => new NativeHindiLanguage(CreateHindi(latin => Registry.ReadAsEnglish(latin))));
}

public sealed class HindiSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, string> RateDenominators { get; init; } = new Dictionary<string, string>();
    public UnitPerSpec UnitPer { get; init; } = null!;
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string MagnitudeConnective { get; init; } = "";
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public BareExponentDef BareExponent { get; init; } = new();
}

public sealed class HindiOrdinalSuffixes
{
    public IReadOnlyDictionary<string, int> Regular { get; init; } = new Dictionary<string, int>();
    /** Per-NUMBER, which is the guard — a single alternation would claim `2था`. See the jsonc. */
    public IReadOnlyDictionary<string, string> SuppletiveConsonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, int> VowelForms { get; init; } = new Dictionary<string, int>();
}
