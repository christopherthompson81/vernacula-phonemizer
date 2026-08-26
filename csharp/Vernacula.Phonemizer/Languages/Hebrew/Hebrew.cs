/**
 * Hebrew (he) phonemizer — a niqqud→IPA segmental g2p over VOCALIZED (pointed) Hebrew, MODERN ISRAELI:
 * the bgdkpt dagesh split, ⟨ש⟩ shin/sin, the ⟨ו⟩ specials, quiescent letters, patach genuvah. Unvocalized
 * restoration is the Phase-2 neural nakdan (HebrewNeural.cs).
 * Ported from src/languages/hebrew/hebrew.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hebrew;

/** One consonant of the (unvocalized) skeleton and the IPA chunk its points resolved to ("" = silent mater). */
public sealed class HebrewChunk
{
    public required string Cons { get; init; }
    public required string Ipa { get; init; }
}

/** Per-call OOV resolver: word → IPA, or null to fall back to the rule g2p. */
public delegate string? HebrewOovResolver(string word);

public sealed class HebrewPhonemizer : ILanguage
{
    private static HebrewManifest M => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> CONS => M.Consonants;
    private static IReadOnlyDictionary<string, string> HARD => M.DageshHard;
    private static IReadOnlyDictionary<string, string> VOW => M.Vowels;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => M.ClausePunctuation;

    private const string DAGESH = "ּ"; // dagesh / mappiq / shuruk-dot
    private const string SIN = "ׂ";
    private const string SHEVA = "ְ";
    private const string HOLAM = "ֹ";
    private const string PATACH = "ַ";
    private static IReadOnlyDictionary<string, string> GERESH_DIGRAPH => M.GereshDigraphs;
    private const string GERESH = "'׳’";
    private static readonly JsRe POINT = JsRegex.Compile("[֑-ׇ'׳’]", "u");
    private static readonly IReadOnlySet<string> FINAL_GUTTURAL =
        new HashSet<string>(M.FurtivePatachGutturals, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> PROCLITIC =
        new HashSet<string>(M.Proclitics, StringComparer.Ordinal);

    /**
     * Scan a VOCALIZED (pointed) Hebrew word into per-consonant chunks: each skeleton consonant paired with
     * the IPA its points resolved to. `PhonemizeWord` joins the ipa parts; the Tagger data-gen uses the
     * (cons → ipa) alignment as its training tags.
     */
    public static List<HebrewChunk> PhonemizeAligned(string word)
    {
        var cps = Js.CodePoints(word.Normalize(NormalizationForm.FormC));
        var chunks = new List<HebrewChunk>();
        var k = 0;
        var prevVowel = ""; // last vowel emitted — decides whether a bare ⟨י⟩ is a silent mater or a [j] glide
        while (k < cps.Count)
        {
            var c = cps[k];
            if (!CONS.ContainsKey(c)) { k += 1; continue; } // stray mark / maqaf / punctuation
            var j = k + 1;
            var marks = new List<string>();
            while (j < cps.Count && POINT.IsMatch(cps[j])) { marks.Add(cps[j]); j += 1; }
            bool Has(string m) => marks.Contains(m, StringComparer.Ordinal);
            var geresh = marks.Any(m => GERESH.Contains(m, StringComparison.Ordinal));
            var vowel = marks.FirstOrDefault(m => VOW.ContainsKey(m));
            var atEnd = j >= cps.Count;
            var sheva = Has(SHEVA);
            var jj = j;
            void Emit(string ipa, string v)
            {
                chunks.Add(new HebrewChunk { Cons = c, Ipa = ipa });
                prevVowel = v;
                k = jj;
            }

            var prevIpa = chunks.Count > 0 ? chunks[^1].Ipa : "";
            var prevIsCons = prevIpa.StartsWith(c == "ו" ? "v" : "j", StringComparison.Ordinal);
            if ((c == "ו" || c == "י") && chunks.Count > 0 && chunks[^1].Cons == c && prevIsCons && !Has(DAGESH))
            {
                var v2 = vowel is not null ? VOW[vowel] : "";
                chunks.Add(new HebrewChunk { Cons = c, Ipa = v2 });
                if (v2.Length > 0) prevVowel = v2;
                k = j;
                continue;
            }
            if (c == "ו")
            {
                if (Has(DAGESH) && vowel is null) { Emit("u", "u"); continue; }
                if (Has(HOLAM)) { Emit("o", "o"); continue; }
                var vv = vowel is not null ? VOW[vowel] : (chunks.Count == 0 && sheva ? "e" : "");
                Emit("v" + vv, vv); continue;
            }
            if (c == "י" && vowel is null && !sheva && !Has(DAGESH))
            {
                if (prevVowel == "i" || prevVowel == "e")
                {
                    chunks.Add(new HebrewChunk { Cons = c, Ipa = "" }); k = j; continue; // silent mater
                }
                Emit("j", ""); continue;
            }
            if (c == "א" && vowel is null && !sheva && chunks.Count > 0)
            {
                chunks.Add(new HebrewChunk { Cons = c, Ipa = "" }); k = j; continue;
            }
            if (c == "ה" && atEnd && vowel is null) { chunks.Add(new HebrewChunk { Cons = c, Ipa = "" }); k = j; continue; }
            if (c == "ע" && atEnd && vowel is null) { chunks.Add(new HebrewChunk { Cons = c, Ipa = "" }); k = j; continue; }

            var ci = CONS[c];
            if (Has(DAGESH) && HARD.TryGetValue(c, out var hard)) ci = hard;
            if (c == "ש") ci = Has(SIN) ? "s" : "ʃ";
            if (geresh && GERESH_DIGRAPH.TryGetValue(c, out var dig)) ci = dig;

            if (atEnd && chunks.Count > 0 && FINAL_GUTTURAL.Contains(c) && vowel == PATACH)
            {
                Emit("a" + (c == "ע" ? "" : ci), ""); continue;
            }

            var v3 = vowel is not null ? VOW[vowel] : (chunks.Count == 0 && sheva && PROCLITIC.Contains(c) ? "e" : "");
            Emit(ci + v3, v3);
        }
        return chunks;
    }

    /** Phonemize one vocalized (pointed) Hebrew word to Modern Israeli IPA (segmental; stress not emitted). */
    public static string PhonemizeWord(string word) =>
        string.Concat(PhonemizeAligned(word).Select(c => c.Ipa));

    internal static readonly JsRe TOKEN =
        JsRegex.Compile("([א-ת][֑-ׇ־'׳’]*(?:[א-ת][֑-ׇ'׳’]*)*)|(\\d+(?:\\.\\d+)?)|([.!?…,;:׃])", "gu");

    /** The Hebrew-block punctuation TOKEN admits INSIDE a word — maqaf, paseq, sof pasuq, nun hafukha. */
    public static readonly JsRe WORD_PUNCT = JsRegex.Compile("[\\u05BE\\u05C0\\u05C3\\u05C6]", "u");

    /** A pointed token → IPA, split at any joiner first. */
    public static string ReadVocalized(string w) =>
        string.Join(" ", WORD_PUNCT.Re.Split(w).Where(p => p.Length > 0).Select(PhonemizeWord).Where(p => p.Length > 0));

    public string Text(string input) => Text(input, null);

    public string Text(string input, HebrewOovResolver? oovOverride) =>
        Clauses.AssembleClauses(Normalize.NormalizeHebrew(input), TOKEN, (m, sink) =>
        {
            // ⚠ SPLIT AT A JOINER FIRST — `PhonemizeWord` scans a token as ONE word and TOKEN admits the
            // maqaf inside one. The OOV override still sees the whole token.
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(oovOverride?.Invoke(m.Groups[1].Value) ?? ReadVocalized(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(Numbers.NumberToIpa(m.Groups[2].Value));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk)) sink.Pause(mk);
            }
        });

    /** Build the Hebrew phonemizer (the niqqud→IPA rule g2p). */
    public static HebrewPhonemizer CreateHebrew() => new();

    internal static void RegisterSelf() => Registry.Register("hebrew", () => CreateHebrew());
}
