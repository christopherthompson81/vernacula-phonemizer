/**
 * Māori (mi) phonemizer — te reo Māori, Eastern Polynesian, Latin script, canonical IPA.
 * Ported from src/languages/maori/maori.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Maori;

public sealed class MaoriDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public MiNumbers Numbers { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public MaoriSymbols Symbols { get; init; } = new();
}

/** Read a Latin run with another language's engine — injected from the registry (English). */
public delegate string ForeignPhonemizer(string latin);

public sealed class MaoriPhonemizer : ILanguage
{
    internal static readonly MaoriDef DEF = LoadManifest.Load<MaoriDef>("languages/maori", "maori.jsonc");
    private static IReadOnlyDictionary<string, string> DIGRAPHS => DEF.Digraphs;
    private static IReadOnlyDictionary<string, string> G => DEF.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static readonly List<string> ORDER = DEF.Digraphs.Keys.OrderByDescending(k => k.Length).ToList();

    /** JS `w.startsWith(key, i)` — bounds first, or CompareOrdinal compares only what is there. */
    private static bool StartsWithAt(string w, string key, int i) =>
        i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0;

    /**
     * Phonemize a single Māori word to canonical IPA — a longest-match scan (the ⟨wh ng⟩ digraphs, then
     * single graphemes).
     */
    public static string PhonemizeWord(string word)
    {
        var w = word.Normalize(NormalizationForm.FormC).ToLowerInvariant();
        var outp = new List<string>();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in ORDER)
            {
                if (!StartsWithAt(w, key, i)) continue;
                outp.Add(DIGRAPHS[key]);
                i += key.Length;
                matched = true;
                break;
            }
            if (matched) continue;
            // Fall-through, reached only after every digraph and single-grapheme rule has declined: a letter
            // with no rule still denotes a sound, so read it generically rather than dropping it.
            var ch = w[i].ToString();
            var ph = G.TryGetValue(ch, out var g) ? g : LatinPhones.LatinPhone(ch, new PhoneOpts { Initial = i == 0 });
            if (ph is not null) outp.Add(ph);
            i += 1;
        }
        return string.Concat(outp);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'ʻ-")})|(\\d+)|([.!?…,;:])", "gu");

    /** This language's OWN inventory. */
    private const string NATIVE_CLASS = "[a-zāēīōūA-ZĀĒĪŌŪ'ʻ-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    /**
     * Can Māori spell this word at all? Decides ROUTING — a different question from `NATIVE_CLASS`, which is
     * the TOKEN class and spans `a-zA-Z`, so testing against it would route nothing. ⚠ Walks the word the way
     * the g2p does (longest digraph first) rather than testing a flat letter set: a flat set has to admit `g`
     * for ⟨ng⟩, and then a standalone `g` slips through and `heritage` reads as Māori.
     */
    private static bool IsNativeWord(string word)
    {
        var w = word.Normalize(NormalizationForm.FormC).ToLowerInvariant();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in ORDER)
            {
                if (!StartsWithAt(w, key, i)) continue;
                i += key.Length;
                matched = true;
                break;
            }
            if (matched) continue;
            var ch = w[i].ToString();
            if (G.ContainsKey(ch) || "'ʻ-".Contains(ch, StringComparison.Ordinal)) { i += 1; continue; }
            return false;
        }
        return true;
    }

    private readonly ForeignPhonemizer? _foreign;

    public MaoriPhonemizer(ForeignPhonemizer? foreign = null) => _foreign = foreign;

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeMaori(input), TOKEN, (m, sink) =>
        {
            // ⚠ A NON-MĀORI WORD IS ROUTED, NOT NATIVISED: Māori is strictly (C)V, and a letter-by-letter
            // substitution has no notion of syllable structure, so it yields phonotactically illegal output
            // (`Xerox` → *kseɾoks*). With no reader injected, the native branch is still the floor.
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(IsNativeWord(m.Groups[1].Value) || _foreign is null
                    ? PhonemizeWord(Nat(m.Groups[1].Value))
                    : _foreign(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' ')) sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /**
     * Build the Māori phonemizer (direct phonemic g2p + macron length + the ⟨wh ng⟩ digraphs + cardinal
     * numbers).
     */
    public static ILanguage CreateMaori(ForeignPhonemizer? foreign = null) => new MaoriPhonemizer(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("maori", () => CreateMaori(latin => Registry.ReadAsEnglish(latin)));
}

public sealed class MaoriSymbols
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, string> RateDenominators { get; init; } = new Dictionary<string, string>();
    public UnitPerSpec UnitPer { get; init; } = null!;
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public MultiplyDef Multiply { get; init; } = null!;
}
