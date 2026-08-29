/**
 * Native Belarusian / беларуская (be) text phonemizer — canonical IPA.
 * Ported from src/languages/belarusian/belarusian.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Belarusian;

public sealed class BelarusianPhonemizer : ILanguage
{
    private static BelarusianDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private const string SOFT = "ь";
    private static readonly IReadOnlySet<string> PALATALIZERS = new HashSet<string>(DEF.Palatalizers, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> VOWEL_LETTERS = new HashSet<string>(DEF.VowelLetters, StringComparer.Ordinal);
    private static bool IsCons(string c) => DEF.Consonants.ContainsKey(c);

    /** Palatalise a hard-consonant IPA: dark ɫ → lʲ (loses velarisation), everything else appends ʲ. */
    private static string Palatalise(string ipa) => ipa == "ɫ" ? "lʲ" : ipa + "ʲ";

    // Regressive-palatalisation triggers (a palatalised coronal or labial or soft l — NOT a velar), compiled
    // once (the TS hoists them to module scope too).
    private const string PALC = "(?:t͡s|d͡z|[tdsznbpvfml])ʲ";
    private static readonly JsRe DARKL_SOFT = JsRegex.Compile($"ɫ(?={PALC}|lʲ)", "gu");
    private static readonly JsRe SIB_SOFT = JsRegex.Compile($"(t͡s|d͡z|[sz])(?={PALC})", "gu");
    private static readonly JsRe N_SOFT = JsRegex.Compile("n(?=(?:t͡s|d͡z)ʲ)", "gu");
    private static readonly JsRe GEM_AFF = JsRegex.Compile("(t͡ʂ|t͡s|d͡ʐ|d͡z)(ʲ?)\\1\\2", "gu");
    private static readonly JsRe GEM_PAL_PAIR = JsRegex.Compile("([bvɣɡdʐznɫlmnprstfxʂ])ʲ\\1ʲ", "gu");
    private static readonly JsRe GEM_PLAIN_PAL = JsRegex.Compile("([bvɣɡdʐznɫlmnprstfxʂ])\\1ʲ", "gu");
    private static readonly JsRe GEM_PLAIN = JsRegex.Compile("([bvɣɡdʐznɫlmprstfxʂ])\\1(?!ʲ)", "gu");

    /**
     * Regressive voicing assimilation + word-final devoicing over the phoneme list (right-to-left). ⟨в⟩=v
     * does not TRIGGER voicing on a preceding obstruent (Slavic), but is itself a target
     * (final/pre-voiceless в→f is absent from the table — Belarusian /v/ vocalises, it never devoices).
     */
    private static void ApplyVoicing(List<string> outp)
    {
        var toVoiceless = DEF.Voicing.ToVoiceless;
        var toVoiced = DEF.Voicing.ToVoiced;
        for (var i = outp.Count - 1; i >= 0; i--)
        {
            var p = outp[i];
            var soft = p.EndsWith("ʲ", StringComparison.Ordinal) ? "ʲ" : "";
            var baseP = soft == "ʲ" ? p[..^1] : p;
            if (!toVoiceless.ContainsKey(baseP) && !toVoiced.ContainsKey(baseP)) continue; // not an obstruent
            string? target = null;
            if (i + 1 >= outp.Count)
            {
                target = "voiceless"; // word-final devoicing
            }
            else
            {
                var nx = outp[i + 1];
                var nsoft = nx.EndsWith("ʲ", StringComparison.Ordinal) ? "ʲ" : "";
                var nbase = nsoft == "ʲ" ? nx[..^1] : nx;
                if ((toVoiceless.ContainsKey(nbase) || toVoiced.ContainsKey(nbase)) && nbase != "v")
                    target = toVoiceless.ContainsKey(nbase) ? "voiced" : "voiceless";
                // before a sonorant / vowel / в: keep base voicing
            }
            if (target == "voiceless" && toVoiceless.TryGetValue(baseP, out var vo)) outp[i] = vo + soft;
            else if (target == "voiced" && toVoiced.TryGetValue(baseP, out var vc)) outp[i] = vc + soft;
        }
    }

    /** One Belarusian word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var s = word.ToLowerInvariant();
        var chars = Js.CodePoints(s);
        var outp = new List<string>();
        for (var i = 0; i < chars.Count;)
        {
            var c = chars[i];
            var nxt = i + 1 < chars.Count ? chars[i + 1] : "";
            // ⟨дз⟩→d͡z, ⟨дж⟩→d͡ʐ affricate digraphs (palatalise before ь/і/iotated: дзень→d͡zʲenʲ)
            if (c == "д" && (nxt == "з" || nxt == "ж"))
            {
                var after = i + 2 < chars.Count ? chars[i + 2] : "";
                var aff = nxt == "з" ? "d͡z" : "d͡ʐ";
                if (PALATALIZERS.Contains(after) && nxt == "з") aff = Palatalise(aff); // only дз softens (дж is always hard)
                outp.Add(aff);
                i += 2;
                if (after == SOFT) i++; // consume the soft sign
                continue;
            }
            // ⟨ў⟩ → [u̯] after a vowel (воўк→vou̯k), else [w] (ўзяць→wzʲatsʲ)
            if (c == "ў")
            {
                outp.Add(i > 0 && VOWEL_LETTERS.Contains(chars[i - 1]) ? "u̯" : "w");
                i++;
                continue;
            }
            if (IsCons(c))
            {
                var ipa = DEF.Consonants[c];
                if (PALATALIZERS.Contains(nxt)) ipa = Palatalise(ipa); // palatalise before ь / і / an iotated vowel
                outp.Add(ipa);
                i++;
                if (nxt == SOFT) i++; // consume the soft sign (palatalisation already applied)
                continue;
            }
            if (DEF.Iotated.TryGetValue(c, out var iot))
            {
                var prev = i > 0 ? chars[i - 1] : "";
                // bare vowel ONLY when directly after a PALATALISABLE consonant (which it palatalised);
                // otherwise (word-initial / after a vowel / apostrophe / ў / й) → [j]+V. й is a glide, not a palataliser.
                if (!IsCons(prev) || prev == "й")
                {
                    outp.Add("j");
                    outp.Add(iot);
                }
                else outp.Add(iot);
                i++;
                continue;
            }
            if (DEF.Vowels.TryGetValue(c, out var v))
            {
                outp.Add(v);
                i++;
                continue;
            }
            if (c == SOFT)
            {
                var last = outp.Count > 0 ? outp[^1] : null;
                if (!string.IsNullOrEmpty(last) && !last.EndsWith("ʲ", StringComparison.Ordinal)) outp[^1] = Palatalise(last);
                i++;
                continue;
            }
            i++; // apostrophe (breaks C+iotated adjacency → [j]V) and unknowns → skip
        }
        ApplyVoicing(outp);
        var x = string.Concat(outp);
        // REGRESSIVE PALATALISATION, then ⟨н⟩ before a palatalised AFFRICATE, then the geminate folds — in
        // the TS order, which the golden depends on (see the TS for the referee's inconsistent targets).
        x = DARKL_SOFT.Replace(x, "lʲ");
        x = SIB_SOFT.Replace(x, "$1ʲ");
        x = N_SOFT.Replace(x, "nʲ");
        x = GEM_AFF.Replace(x, "$1$2ː");
        x = GEM_PLAIN.Replace(GEM_PLAIN_PAL.Replace(GEM_PAL_PAIR.Replace(x, "$1ʲː"), "$1ʲː"), "$1ː");
        return x.Normalize(NormalizationForm.FormC);
    }

    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // The 2^53-1 bound reproduces JS `Number.isSafeInteger`: past it the double has lost the low digits,
        // so the numeral is spelled out digit-at-a-time rather than composed.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
            return Core.Numbers.SpellDigits(digits, DEF.Numbers, PhonemizeWord);
        // East-Slavic composer: the magnitude nouns AGREE with their multiplier (дзве тысячы, пяць тысяч)
        return Core.Numbers.RenderNumber(n, DEF.Numbers, PhonemizeWord, Ukrainian.Numbers.eastSlavicNumberWords);
    }

    /**
     * SYMBOL NORMALIZATION — Belarusian. The one-letter unit keys `г`/`с`/`т` are deliberately NOT declared
     * (each is a different word in this corpus — see the TS header for the counted facts), and the metre is
     * claimed in Normalize.cs instead, with an explicit guard.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "працэнт", "працэнты", "працэнтаў", "працэнта" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["€"] = new[] { "еўра" }, // indeclinable
            ["$"] = new[] { "долар", "долары", "долараў", "долара" },
            ["£"] = new[] { "фунт", "фунты", "фунтаў", "фунта" },
            ["₽"] = new[] { "рубель", "рублі", "рублёў", "рубля" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["км"] = new[] { "кіламетр", "кіламетры", "кіламетраў", "кіламетра" },
            ["см"] = new[] { "сантыметр", "сантыметры", "сантыметраў", "сантыметра" },
            ["мм"] = new[] { "міліметр", "міліметры", "міліметраў", "міліметра" },
            ["кг"] = new[] { "кілаграм", "кілаграмы", "кілаграмаў", "кілаграма" },
            ["га"] = new[] { "гектар", "гектары", "гектараў", "гектара" },
            ["ггц"] = new[] { "гігагерц", "гігагерцы", "гігагерцаў", "гігагерца" },
            // LATIN aliases — the engine's TOKEN matches Cyrillic only, so a foreign-sourced `120 km` loses
            // the unit entirely rather than merely mispronouncing it.
            ["km"] = new[] { "кіламетр", "кіламетры", "кіламетраў", "кіламетра" },
            ["cm"] = new[] { "сантыметр", "сантыметры", "сантыметраў", "сантыметра" },
            ["mm"] = new[] { "міліметр", "міліметры", "міліметраў", "міліметра" },
            ["kg"] = new[] { "кілаграм", "кілаграмы", "кілаграмаў", "кілаграма" },
        },
        UnitPer = "на",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["гадз"] = "гадзіну", ["год"] = "гадзіну", ["h"] = "гадзіну", ["s"] = "секунду",
        },
        // The measure adjective goes BEFORE the noun as a separate agreeing word — квадратных кіламетраў —
        // the East-Slavic shape, not Swedish's fused compound.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "квадратны", "квадратныя", "квадратных", "квадратнага" },
            Cubed = new[] { "кубічны", "кубічныя", "кубічных", "кубічнага" },
            Position = ExponentPosition.Before,
        },
        // A BARE power — `5²`, with no unit noun for the exponent to modify. ⚠ ONLY `squared` IS DECLARED,
        // and the asymmetry is the evidence (see the TS header).
        BareExponent = new BareExponentDef { Squared = "{n} у квадраце" },
        // The multiplication article reads the notation aloud and gives the SHORT register
        // («два на тры ёсць шэсць»); every `×` in this corpus is a dimension, so one word serves and `by`
        // defaults to it.
        Multiply = new MultiplyDef { Times = "на" },
        Ampersand = "і",
        // Inflected forms too, because running text writes the one its numeral governs (2 мільёны, 5 мільёнаў).
        Magnitudes = new[]
        {
            "тысячы", "тысяч", "мільён", "мільёна", "мільёны", "мільёнаў",
            "мільярд", "мільярда", "мільярды", "мільярдаў",
        },
        // A DECIMAL governs the GENITIVE SINGULAR — 2,4 працэнта — a fourth form, because the 2–4 slot here
        // is the nominative plural (два працэнты) and so cannot serve. Same shape as Ukrainian.
        CountForm = n => double.IsInteger(n) ? NormalizeSymbols.SlavicCountForm(n) : 3,
    });

    private const string CYRILLIC = "\\u0400-\\u04FF";
    private static readonly JsRe TOKEN = JsRegex.Compile($"([{CYRILLIC}'’ʼ]+)|(\\d+(?:,\\d+)?)|([.?!,;:…—])", "gu");

    public string Text(string input)
    {
        // normalize.ts FIRST (its ordinal, clock, era, year and range steps need the number and its suffix
        // still adjacent, which the tier would break), then the INITIALISM pass, then the shared symbol
        // tier — the initialism pass must not see a `$` glued to a caps run, and the tier matches a unit
        // only when a NUMBER is adjacent, which is why the degree and clock rules run before it.
        var normalized = SYMBOLS(Normalize.NormalizeBelarusianInitialisms(Normalize.NormalizeBelarusian(input)));
        return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                // ⚠ THE NUMBER TOKEN SPANS THE DECIMAL COMMA — without it the comma is clause punctuation and
                // `5,3 %` reads as a phrase break inside a quantity.
                var bits = m.Groups[2].Value.Split(',');
                var intPart = bits[0];
                string? frac = bits.Length > 1 ? bits[1] : null;
                sink.Emit(Number(intPart));
                if (frac is not null)
                {
                    sink.Emit(PhonemizeWord(DEF.Numbers.DecimalConnector));
                    foreach (var dg in frac) sink.Emit(Number(dg.ToString()));
                }
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Belarusian phonemizer. */
    public static ILanguage CreateBelarusian() => new BelarusianPhonemizer();

    internal static void RegisterSelf()
    {
        Registry.Register("belarusian", CreateBelarusian);
        Registry.RegisterRomanPolicy("be", RomanOrdinals.ROMAN_POLICY);
    }
}
