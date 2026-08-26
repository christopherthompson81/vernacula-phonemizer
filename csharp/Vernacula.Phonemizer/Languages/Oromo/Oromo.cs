/**
 * Native Oromo / Afaan Oromoo (om) text phonemizer — canonical IPA. A shallow near-phonemic Latin (Qubee)
 * orthography → rule-based transliterator, plus the phonetic-stress layer from the Kamisee thesis.
 * Ported from src/languages/oromo/oromo.ts — see that file for the stress rules and their validation.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Oromo;

public sealed class OromoPhonemizer : ILanguage
{
    private static OromoDef DEF => Manifest.DEF;

    private static readonly IReadOnlySet<string> APOSTROPHE =
        new HashSet<string>(DEF.GlottalStopLetters, StringComparer.Ordinal);

    /** Scan a lowercased Oromo word → IPA units (digraphs, gemination, length, glottal stop). */
    private static List<string> Scan(string w)
    {
        var s = Js.CodePoints(Js.ToLowerCase(w));
        var outp = new List<string>();
        for (var i = 0; i < s.Count;)
        {
            var c = s[i];
            if (APOSTROPHE.Contains(c))
            {
                var next = i + 1 < s.Count ? s[i + 1] : null;
                if (i > 0 && next is not null && !APOSTROPHE.Contains(next)) outp.Add("ʔ");
                i++;
                continue;
            }
            // Geminate DIGRAPH: a doubled first letter + a digraph (ddh/cch/nny → [ᶑː]/[t͡ʃː]…).
            if (i + 1 < s.Count && s[i + 1] == c)
            {
                var dg2 = (i + 1 < s.Count ? s[i + 1] : "") + (i + 2 < s.Count ? s[i + 2] : "");
                if (DEF.Digraphs.TryGetValue(dg2, out var g2))
                {
                    outp.Add(g2 + "ː");
                    i += 3;
                    continue;
                }
            }
            var dg = c + (i + 1 < s.Count ? s[i + 1] : "");
            if (DEF.Digraphs.TryGetValue(dg, out var g))
            {
                outp.Add(g);
                i += 2;
                continue;
            }
            // Doubled letter → long vowel (aa→aː) or geminate consonant (bb→bː).
            if (i + 1 < s.Count && s[i + 1] == c)
            {
                var dbl = Single(c);
                if (dbl is not null)
                {
                    outp.Add(dbl + "ː");
                    i += 2;
                    continue;
                }
            }
            var one = Single(c);
            if (one is not null) outp.Add(one);
            i++;
        }
        return outp;
    }

    private static string? Single(string c) =>
        DEF.Vowels.TryGetValue(c, out var v) ? v : DEF.Consonants.TryGetValue(c, out var k) ? k : null;

    private static readonly IReadOnlySet<string> IS_VOWEL =
        new HashSet<string>(DEF.Vowels.Values, StringComparer.Ordinal);
    private static readonly JsRe LENGTH_MARK = JsRegex.Compile("ː", "g");
    private static bool IsVowelUnit(string u) => IS_VOWEL.Contains(LENGTH_MARK.Replace(u, ""));

    /** Nucleus indices into the unit array, with whether each is long. */
    private static List<(int At, bool Long)> Nuclei(List<string> units)
    {
        var outp = new List<(int, bool)>();
        for (var i = 0; i < units.Count; i++)
            if (IsVowelUnit(units[i])) outp.Add((i, units[i].Contains('ː')));
        return outp;
    }

    /** §5.3.1 rule 7 — the focus marker and the short object pronouns are unstressed. */
    private static readonly IReadOnlySet<string> UNSTRESSED_WORDS =
        new HashSet<string>(new[] { "tu", "nu", "na", "si" }, StringComparer.Ordinal);

    /** Index of the syllable carrying primary stress, or -1 to leave the word unmarked. */
    private static int StressIndex(List<string> units, string word)
    {
        if (UNSTRESSED_WORDS.Contains(Js.ToLowerCase(word))) return -1; // rule 7
        var nu = Nuclei(units);
        var n = nu.Count;
        if (n == 0) return -1;
        if (n == 1) return 0; // rule 1

        // The INFINITIVE suffix -uu is extrametrical — see the TS note and its kaikki validation.
        var last = nu[n - 1];
        var endsWithVowel = last.At == units.Count - 1;
        if (endsWithVowel && last.Long && units[last.At].StartsWith("u", StringComparison.Ordinal))
        {
            var head = nu.GetRange(0, n - 1);
            for (var k = head.Count - 1; k >= 0; k--) if (head[k].Long) return k;
            return head.Count - 1;
        }

        if (!endsWithVowel)
        {
            for (var k = 0; k < n - 1; k++) if (nu[k].Long) return k; // rule 5
            return n - 1;
        }
        if (last.Long) return n - 1; // rule 4
        for (var k = n - 2; k >= 0; k--) if (nu[k].Long) return k; // fn16
        return n - 2; // rules 2/3
    }

    /** Insert the primary-stress mark before the nucleus of the selected syllable (fleet convention: kˈiː). */
    private static List<string> ApplyStress(List<string> units, string word)
    {
        var idx = StressIndex(units, word);
        if (idx < 0) return units;
        var at = Nuclei(units)[idx].At;
        var outp = new List<string>(units.GetRange(0, at)) { "ˈ" };
        outp.AddRange(units.GetRange(at, units.Count - at));
        return outp;
    }

    /** One Oromo word → canonical IPA. */
    public static string PhonemizeWord(string word) =>
        string.Concat(ApplyStress(Scan(word), word)).Normalize(NormalizationForm.FormC);

    /** One Oromo word → canonical IPA, WITHOUT the stress layer (the referee eval's segmental signal). */
    public static string PhonemizeWordSegmental(string word) =>
        string.Concat(Scan(word)).Normalize(NormalizationForm.FormC);

    // ⚠ ALL OF LATIN, not just Oromo's own letters — a narrower class ended the token at a diacritic and
    // one word became three (`São Paulo` → *s ˈə ˈo paˈulo*).
    private static readonly JsRe TOKEN =
        JsRegex.Compile("(\\p{Script=Latin}[\\p{Script=Latin}\\p{M}ʼ’']*)|(\\d+)|([.?!,;:])", "gu");
    /** Oromo's OWN inventory — a token outside it carries a letter Qubee does not use, i.e. a foreign name. */
    private static readonly JsRe NATIVE_WORD = JsRegex.Compile("^[A-Za-zʼ’']+$", "u");

    /** The shared SYMBOL tier — percent and currency, BOTH PREFIXED (Oromo is head-initial for measures). */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "si’a" },
        Percent = new[] { "parsantii" },
        PercentPrefix = true,
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "doolaara Ameerikaa" },
            ["$"] = new[] { "doolaara" },
            ["£"] = new[] { "paawundii" },
            ["€"] = new[] { "yuuroo" },
        },
        CurrencyPrefix = true,
    });

    private readonly Func<string, string>? _foreign;
    private OromoPhonemizer(Func<string, string>? foreign) => _foreign = foreign;

    public string Text(string input)
    {
        // ⚠ THE INITIALISM PASS RUNS LAST of the three: after the dotted abbreviations and the era marker
        // have been expanded, and after the symbol tier, whose signs are not letter runs.
        var normalized = Normalize.NormalizeOromoInitialisms(
            Normalize.NormalizeOromoNumerals(SYMBOLS(Normalize.NormalizeOromo(input))));
        return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
            {
                var w = m.Groups[1].Value;
                sink.Emit(NATIVE_WORD.IsMatch(w) || _foreign is null ? PhonemizeWord(w) : _foreign(w));
            }
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (DEF.ClausePunctuation.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Oromo phonemizer. `foreign` reads a non-Qubee Latin word (English, wired in the registry). */
    public static ILanguage CreateOromo(Func<string, string>? foreign = null) => new OromoPhonemizer(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("oromo", () => CreateOromo(Registry.ReadAsEnglish));
}
