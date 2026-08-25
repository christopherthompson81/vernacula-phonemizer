/**
 * Native Uzbek / oʻzbekcha (uz) text phonemizer — canonical IPA. Turkic, modern LATIN orthography, and the
 * Turkic outlier that LOST vowel harmony, so the g2p is a flat left-to-right scan with fixed letter values:
 * the digraphs sh/ch/ng, the comma-letters oʻ/gʻ, the tutuq belgisi → [ʔ], and final-syllable stress.
 * Ported from src/languages/uzbek/uzbek.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Uzbek;

public static class UzbekPhonemizer
{
    private static UzbekDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    /** Any apostrophe variant used for the comma-letters oʻ/gʻ OR the tutuq belgisi → one canonical mark. */
    private static readonly JsRe APOS = JsRegex.Compile("['’‘`ʻʼ′]", "gu");
    private const string APOS_C = "ʻ";
    private static readonly IReadOnlySet<string> VOWEL_IPA = Ipa.IPA_VOWEL;

    /** One Uzbek (Latin) word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var s = APOS.Replace(Js.ToLowerCase(word).Normalize(NormalizationForm.FormC), APOS_C);
        var chars = Js.CodePoints(s);
        var outp = new List<string>();
        for (var i = 0; i < chars.Count;)
        {
            // Digraphs first — GUARD: don't let a greedy "ng" swallow the g of a following gʻ.
            var two = chars[i] + (i + 1 < chars.Count ? chars[i + 1] : "");
            if (DEF.Digraphs.TryGetValue(two, out var dg)
                && !(two == "ng" && i + 2 < chars.Count && chars[i + 2] == APOS_C))
            {
                outp.Add(dg);
                i += 2;
                continue;
            }
            var c = chars[i];
            if (c == APOS_C)
            {
                outp.Add(DEF.Glottal); // a comma not consumed by an oʻ/gʻ digraph is the tutuq belgisi
                i++;
                continue;
            }
            if (DEF.Vowels.TryGetValue(c, out var v)) outp.Add(v);
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            else if (DEF.Consonants.TryGetValue(c, out var k)) outp.Add(k);
            else
            {
                var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
                if (p is not null) outp.Add(p);
            }
            i++;
        }
        var x = string.Concat(outp);
        // Final-syllable (weak) stress: mark the LAST vowel nucleus. ⚠ The index is the CODE-POINT ordinal
        // used as a STRING index, exactly as the TS spread-and-slice does.
        var at = -1;
        var ordinal = 0;
        foreach (var cp in Js.CodePoints(x))
        {
            if (VOWEL_IPA.Contains(cp)) at = ordinal;
            ordinal++;
        }
        if (at >= 0) x = x[..at] + "ˈ" + x[at..];
        return x.Normalize(NormalizationForm.FormC);
    }

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // ⚠ ABOVE 2^53 the float has already lost the low digits, so the composed numeral would be
        // confidently wrong — read it digit-at-a-time instead. See Core/Numbers.cs `SpellDigits`.
        if (!IsSafeInteger(n)) return Core.Numbers.SpellDigits(digits, DEF.Numbers, PhonemizeWord);
        return Core.Numbers.RenderNumber(n, DEF.Numbers, PhonemizeWord, Numbers.TurkicNumberWords);
    }

    /** The decimal-comma word (manifest `numbers.decimalWord`) as IPA — read between integer and fraction. */
    private static readonly string DECIMAL_IPA = PhonemizeWord(DEF.Numbers.DecimalWord!);

    /** Symbol normalization — percent POSTPOSED, rates prefixed, squared units a prefix adjective. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "karra" },
        Percent = new[] { "foiz" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dollar" },
            ["¥"] = new[] { "iyena" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometr" },
            ["mm"] = new[] { "millimetr" },
            ["sm"] = new[] { "santimetr" },
            ["m"] = new[] { "metr" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kvadrat" },
            Cubed = new[] { "kubo" },
            Position = new ExponentPositionSpec { Squared = "before", Cubed = "compound" },
        },
    });

    private static readonly JsRe TOKEN = JsRegex.Compile(
        "(" + HostWord.HostWordRun(new[] { "Latin" }, "ʻ'’‘`ʼ′") + @")|(\d+(?:,\d+)?)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token this class REJECTS carries a letter Uzbek does not use. */
    private const string NATIVE_CLASS = "[a-zʻ'’‘`ʼ′]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/rate/clock steps need
            // the number and its suffix still adjacent, which the tier would break.
            return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeUzbek(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var bits = m.Groups[2].Value.Split(',');
                    foreach (var wd in Number(bits[0]).Split(' ')) sink.Emit(wd);
                    if (bits.Length > 1)
                    {
                        // The decimal comma reads "vergul" and goes through the g2p like any other number
                        // word — emitting the SPELLING here leaked "vergul" into the IPA.
                        sink.Emit(DECIMAL_IPA);
                        foreach (var d in Js.CodePoints(bits[1]))
                            foreach (var wd in Number(d).Split(' ')) sink.Emit(wd);
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Uzbek phonemizer. */
    public static ILanguage CreateUzbek() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("uzbek", CreateUzbek);
        Registry.RegisterRomanPolicy("uz", RomanOrdinals.ROMAN_POLICY);
    }
}
