/**
 * Māori (mi) phonemizer — te reo Māori, Eastern Polynesian, Latin script, canonical IPA. One of
 * the simplest orthographies in the fleet: a near-1:1 phonemic grapheme map + the macron = LENGTH + two digraphs
 * (⟨wh⟩→[ɸ], ⟨ng⟩→[ŋ]). Strict CV syllables — no codas, no clusters, no glide formation, so a plain longest-match
 * scan suffices. Stress (mora-based, unwritten) is not emitted. Cardinal numbers: numbers.ts (the modern tekau mā series).
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

    /** Phonemize a single Māori word to canonical IPA — a longest-match scan (the ⟨wh ng⟩ digraphs, then single graphemes). */
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
            // ⚠ NOT SILENTLY: a letter this g2p has no rule for still denotes a sound, and dropping it deletes
            // content the writer typed. `latinPhone` is consulted HERE, after every digraph and single-letter rule
            // has been tried, so it can never override a reading this language has an opinion about.
            var ch = w[i].ToString();
            var ph = G.TryGetValue(ch, out var g) ? g : LatinPhones.LatinPhone(ch, new PhoneOpts { Initial = i == 0 });
            if (ph is not null) outp.Add(ph);
            i += 1;
        }
        return string.Concat(outp);
    }

    // A word (Māori Latin letters incl. the macron vowels ā ē ī ō ū) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'ʻ-")})|(\\d+)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
     * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters.
     */
    private const string NATIVE_CLASS = "[a-zāēīōūA-ZĀĒĪŌŪ'ʻ-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    /**
     * Can Māori spell this word at all? Decides ROUTING, and it is a different question from `NATIVE_CLASS`.
     *
     * ⚠ `NATIVE_CLASS` IS THE TOKEN CLASS, NOT THE ALPHABET — it spans `a-zA-Z`, because that is what the tokenizer
     * needs in order to claim a word at all. Using it to decide routing routes NOTHING: `Safari` is entirely ASCII,
     * so it tests as native and never reaches the reader.
     *
     * ⚠ IT WALKS THE WORD THE WAY THE G2P DOES — longest digraph first, then a single grapheme — rather than testing
     * membership in a flat letter set. A flat set has to admit `g` for the sake of ⟨ng⟩, and then a standalone `g`
     * slips through: `heritage` tested as Māori-spellable and was read *heɾitaɡ* instead of being routed.
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
            // ⚠ A NON-MĀORI WORD IS ROUTED, NOT NATIVISED. Māori is strictly (C)V — no codas, no clusters — and a
            // letter-by-letter substitution cannot repair either, because it has no notion of syllable structure.
            // Giving each missing letter a phone stopped the DELETION (`Safari` had been reading *aaɾi*) and left the
            // reading phonotactically illegal: `Xerox` → *kseɾoks*. Real Māori nativisation inserts an echo vowel and
            // resolves every cluster — Christmas → Kirihimete — which is per-language loan phonology, not a letter
            // table. Until that exists, an English reading is the honest answer for a word Māori cannot spell.
            //
            // The floor stays underneath: `nat` still applies on the native branch, and `latinPhone` still backs the
            // g2p, for the case where no reader is injected (direct engine use, or a test).
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(IsNativeWord(m.Groups[1].Value) || _foreign is null
                    ? PhonemizeWord(Nat(m.Groups[1].Value))
                    : _foreign(m.Groups[1].Value));
            // Cardinal numbers (numbers.ts) — emitted one word at a time, as for ordinary text.
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' ')) sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Māori phonemizer (direct phonemic g2p + macron length + the ⟨wh ng⟩ digraphs + cardinal numbers). */
    public static ILanguage CreateMaori(ForeignPhonemizer? foreign = null) => new MaoriPhonemizer(foreign);

    // TS: createMaori(readAsEnglish) — the registry threads its English reader in.
    internal static void RegisterSelf() =>
        Registry.Register("maori", () => CreateMaori(latin => Registry.ReadAsEnglish(latin)));
}
