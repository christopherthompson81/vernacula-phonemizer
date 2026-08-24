/**
 * Native Hindi text phonemizer — canonical IPA. Assembles the generic abugida modules
 * (G2P + weight-stress + number compositor) with Hindi's self-describing JSONC definition (hindi.jsonc,
 * beside this file).
 *
 * text() handles: Devanagari word runs, number runs (integer + Indian grouping + decimal), clause-
 * terminating punctuation → canonical inline pause marks, symbols (% → प्रतिशत, ₹ stripped), and embedded
 * Latin runs → an injected foreign (en) phonemizer.
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
}

/** Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry. */
public delegate string ForeignPhonemizer(string latin);

/** The script's word-run char class + digit map — defaults to Devanagari (Hindi/Marathi); Gujarati etc. pass
 *  their own so the whole abugida orchestration (schwa deletion, weight stress, numbers) is reused as-is. */
public sealed class AbugidaScript
{
    public required string Word { get; init; }
    public required IReadOnlyDictionary<string, string> Digits { get; init; }
    /**
     * The script's AVAGRAHA sign, for `schwaDeletion.retainOnAvagraha`. ⚠ IT IS PER-SCRIPT, not a constant:
     * the Brahmic blocks are aligned so it sits at offset 0x3D in each — Devanagari ऽ U+093D, Bengali ঽ
     * U+09BD, Gujarati ઽ U+0ABD.
     */
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
    private static readonly JsRe VOWEL_G = JsRegex.Compile($"[{Unicode.IPA_VOWELS}]", "g");
    private static readonly JsRe CONS_LONG_FINAL = JsRegex.Compile($"[^{Unicode.IPA_VOWELS}]ː$");
    private static readonly JsRe AFFRICATES = JsRegex.Compile("t͡ʃ|d͡ʒ|t͡s|d͡z", "g");
    private static readonly JsRe MARKS_ETC = JsRegex.Compile("[̀-ͯʰ-ʱːˈˌ]", "g");
    private static readonly JsRe SCHWA_FINAL = JsRegex.Compile("ə$");

    /** Does the coda (a word body with the final schwa already removed) end in a consonant CLUSTER or
     *  GEMINATE? Used by `retainFinalAfterCluster` (Marathi): the word-final inherent schwa is deleted after
     *  a single consonant (घर→ɡʱəɾ) but RETAINED to avoid a word-final cluster (अंक→əŋkə). Affricates are ONE
     *  consonant; a length mark ː is a geminate = heavy. */
    public static bool HeavyFinalCoda(string body)
    {
        // Geminate/long CONSONANT coda (क्क→kː) is heavy. Guard the ː to a consonant so a trailing long
        // VOWEL isn't misread as a geminate.
        if (CONS_LONG_FINAL.IsMatch(body)) return true;
        // Collapse affricates to a single placeholder BEFORE stripping the (combining) tie bar, so d͡z counts as 1.
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
         * Nine languages reuse this engine, and until this parameter existed they also inherited Hindi's
         * normalizer and Hindi's symbol words. Both default to Hindi's.
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
        var tokenRe = JsRegex.Compile(
            // ⚠ THE LATIN GROUP SPANS ALL OF LATIN, not just ASCII — `[A-Za-z]+` shredded every accented
            // foreign name: `São Paulo` in Hindi read *ˈɛs ˈə ˈoᶷ pʰˈɔːloᶷ*. This group already means
            // "foreign" (its match goes straight to the injected reader), so widening it is the whole change.
            // ⚠ REACHES 17 LANGUAGES, every one that composes `makeNativeHindi`.
            $"([{script.Word}]+)|(\\p{{Script=Latin}}[\\p{{Script=Latin}}\\p{{M}}]*)|([{DIGIT_CLASS}]+(?:,[{DIGIT_CLASS}]+)*(?:\\.[{DIGIT_CLASS}]+)?)"
            + $"|([।॥.?!,;:]){(symbolClass.Length > 0 ? $"|([{symbolClass}])" : "")}",
            "gu");

        // ⚠ FAIL LOUDLY RATHER THAN SILENTLY DO NOTHING. A manifest asking for avagraha retention under a
        // script that has not declared its avagraha would read as though the rule were on while every final
        // schwa still deleted.
        var retainOnAvagraha = def.SchwaDeletion.RetainOnAvagraha == true;
        if (retainOnAvagraha && script.Avagraha is null)
            throw new InvalidOperationException("schwaDeletion.retainOnAvagraha is set but this script declares no `avagraha` sign");

        /** Pure RULE-ENGINE word→IPA (no lexicon) — the honest, non-circular signal used by the referee eval. */
        string WordRules(string w)
        {
            var x = g2p(w);
            // ⚠ THE AVAGRAHA ⟨ऽ⟩ IS READ FROM THE SPELLING, NOT THE PHONES: g2p drops the character, leaving
            // nothing downstream to test.
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
            lexicon is not null && lexicon.TryGetValue(w.Normalize(NormalizationForm.FormC), out var v) ? v : WordRules(w);

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
                // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA, in every engine built
                // from this maker — one bug reaching eleven languages. Digit-at-a-time out of
                // `def.numbers.units` is exactly what the decimal tail below already does.
                var intText = ascii[..dot];
                var intN = Js.Number(intText.Length > 0 ? intText : "0");
                var head = double.IsInteger(intN) && Math.Abs(intN) <= 9007199254740991d
                    ? Core.Numbers.RenderNumber(intN, def.Numbers, Word)
                    : Core.Numbers.SpellDigits(intText, def.Numbers, Word);
                var frac = Js.CodePoints(ascii[(dot + 1)..]).Select(d => Word(def.Numbers.Units[(int)Js.Number(d)]));
                return string.Join(" ", new[] { head, Word(def.Numbers.DecimalWord!) }.Concat(frac));
            }
            var n = Js.Number(ascii);
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d)) return Core.Numbers.SpellDigits(ascii, def.Numbers, Word);
            return Core.Numbers.RenderNumber(n, def.Numbers, Word);
        }

        // ⚠ THE HINDI-SPECIFIC REWRITES RUN BEFORE THE SHARED SYMBOL TIER, whose unit keys are LATIN.
        // Roman numerals need no ordering care: `hi` is not ROMAN_NATIVE, so the shared pass has already run.
        var normalize = normalizeOverride ?? Normalize.MakeHindiNormalizer(def.Numbers);
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
        // ⚠ Declaring `multiply` HERE is what makes ASCII `x` read like `×`. One word, so `by` defaults to it.
        Multiply = new MultiplyDef { Times = "गुणा" },
        Percent = new[] { "प्रतिशत" },
        // ⚠ `¢` IS ROBUSTNESS, NOT ATTESTATION (probably an OCR corruption of `″`) — declared anyway,
        // because the engine's job is to read the character it is given and a dropped sign is INAUDIBLE.
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "डॉलर" }, ["€"] = new[] { "यूरो" }, ["£"] = new[] { "पाउंड" },
            ["₹"] = new[] { "रुपये" }, ["¥"] = new[] { "येन" }, ["¢"] = new[] { "सेंट" },
        },
        // ⚠ THIS TIER IS INHERITED BY SEVEN OTHER LANGUAGES (awa, bgc, bho, hne, mag, mai, rkt pass no
        // override), so these keys are declared for them too — sourced from hi.wikipedia, stated rather than
        // left to be discovered. हेक्टर IS NOT the hectare word (it is HECTOR, the Trojan prince); ग्राम's
        // count is mostly the "village" homograph and the definitional hit is the evidence, not the count.
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "किलोमीटर" }, ["cm"] = new[] { "सेंटीमीटर" }, ["mm"] = new[] { "मिलीमीटर" },
            ["kg"] = new[] { "किलोग्राम" }, ["m"] = new[] { "मीटर" }, ["g"] = new[] { "ग्राम" },
            ["l"] = new[] { "लीटर" }, ["L"] = new[] { "लीटर" }, ["ha"] = new[] { "हेक्टेयर" }, ["nm"] = new[] { "नैनोमीटर" },
        },
        // `km²` → वर्ग किलोमीटर, corpus-attested in exactly this slot. `before`, not `compound`.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "वर्ग" },
            Cubed = new[] { "घन" },
            Position = ExponentPosition.Before,
        },
        // BARE EXPONENT — STANDARD MATHEMATICAL REGISTER, not corpus attestations.
        BareExponent = new BareExponentDef
        {
            Squared = "{n} का वर्ग", Cubed = "{n} का घन", Power = "{n} की घात {e}", Negative = "ऋण",
        },
    });

    /** Load hindi.jsonc and build the Hindi phonemizer. `foreign` handles embedded Latin. */
    public static NativeHindiEngine CreateHindi(ForeignPhonemizer? foreign = null) =>
        MakeNativeHindi(
            LoadManifest.Load<HindiDef>("languages/hindi", "hindi.jsonc"),
            PhonologyLoader.LoadSharedPhonology(),
            foreign);

    internal static void RegisterSelf() =>
        Registry.Register("hindi", () => new NativeHindiLanguage(CreateHindi(latin => Registry.ReadAsEnglish(latin))));
}
