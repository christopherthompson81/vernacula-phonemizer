/**
 * Dutch (nl) phonemizer — Northern Standard Dutch, canonical IPA.
 * Ported from src/languages/dutch/dutch.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Dutch;

public sealed class DutchPhonemizer : ILanguage
{
    // ⚠ BOTH BUILT FROM THE MANIFEST. The first duplicated `morphology.prefixUnstressed`, which was already
    // in dutch.jsonc. Alternation order is free here because no member is a prefix of another — if one ever
    // is, this must sort longest-first. See src/languages/dutch/dutch.ts.
    private static JsRe Alt(IReadOnlyList<string> xs) => JsRegex.Compile($"^({string.Join("|", xs)})", "u");
    private static readonly JsRe UNSTRESSED_PREFIX = Alt(Manifest.MANIFEST.Morphology.PrefixUnstressed);
    private static readonly JsRe SCHWA_PREFIX = Alt(Manifest.MANIFEST.Morphology.PrefixSchwa);
    // A be-/ge-/te- spelling whose ⟨e⟩ the scanner joins with the next letter (⟨ee⟩, ⟨ei⟩, ⟨eu⟩) is not a prefix:
    // been·houwer must not shift, nor have its digraph overwritten with schwa (#1524). See src/languages/dutch/dutch.ts.
    private static readonly JsRe DIGRAPH_PREFIX = JsRegex.Compile(
        $"^(?:{string.Join("|", Manifest.MANIFEST.Morphology.PrefixUnstressed.Where(p => p.EndsWith('e')))})[eiu]", "u");

    // The reduced (schwa) readings of the high-frequency function words. Now data; dutch.jsonc records why
    // the numeral/article "een" is deliberately absent.
    private static IReadOnlyDictionary<string, string> FUNCTION_WORDS => Manifest.MANIFEST.FunctionWords;

    // A prefix shift may land on a reduced STEM ⟨e⟩ (#1550): the scanner reduced it before stress was placed, so
    // ver·tel·len kept the stress on the prefix. Not when only an ending follows the last-nucleus ⟨e⟩ (ge·ven,
    // be·ter, te·gen), and not after a longer STRESSED prefix (tegen, terug). See src/languages/dutch/dutch.ts.
    private static readonly string[] ENDING_AFTER_E = { "n", "r", "l", "m", "" };
    private static readonly JsRe STRESSED_PREFIX_START = JsRegex.Compile(
        $"^(?:{string.Join("|", Manifest.MANIFEST.Morphology.PrefixStressed.Where(p => Manifest.MANIFEST.Morphology.PrefixUnstressed.Any(u => p.StartsWith(u, StringComparison.Ordinal) && p.Length > u.Length)))})", "u");
    private static bool StemVowelE(string lower, int at, bool last)
    {
        if (lower[at] != 'e' || STRESSED_PREFIX_START.IsMatch(lower)) return false;
        return !last || !ENDING_AFTER_E.Contains(lower[(at + 1)..]);
    }

    /** Place primary stress and reduce an unstressed prefix's vowel. */
    /** Words that START with a prefix spelling but are not prefixed (tennis, hertog); see nl-not-prefixed.txt. */
    private static HashSet<string>? NOT_PREFIXED;
    private static readonly object NOT_PREFIXED_GATE = new();
    private static HashSet<string> NotPrefixedWords()
    {
        lock (NOT_PREFIXED_GATE)
        {
            if (NOT_PREFIXED is not null) return NOT_PREFIXED;
            var set = new HashSet<string>(StringComparer.Ordinal);
            try
            {
                foreach (var line in LoadTsv.LoadLines("languages/dutch", "nl-not-prefixed.txt", optional: true))
                {
                    var w = line.Trim().ToLowerInvariant();
                    if (w.Length > 0 && !w.StartsWith('#')) set.Add(w);
                }
            }
            catch { /* no list → every prefix spelling shifts, as before */ }
            return NOT_PREFIXED = set;
        }
    }

    private static int PlaceStress(List<Seg> segs, string word, bool notPrefixed = false)
    {
        var nuclei = new List<int>();
        for (var k = 0; k < segs.Count; k++) if (segs[k].Vowel) nuclei.Add(k);
        if (nuclei.Count == 0) return -1;
        var lower = word.ToLowerInvariant();
        if (!notPrefixed && nuclei.Count > 1 && UNSTRESSED_PREFIX.IsMatch(lower) && !DIGRAPH_PREFIX.IsMatch(lower))
        {
            var second = segs[nuclei[1]];
            var stemE = second.Ph == "ə" && StemVowelE(lower, second.S, nuclei.Count == 2);
            if (second.Ph != "ə" || stemE)
            {
                if (stemE) second.Ph = G2p.FullVowel(lower, second.S);
                if (SCHWA_PREFIX.IsMatch(lower)) segs[nuclei[0]].Ph = "ə"; // ge-/be-/ver-/te- vowel → schwa
                return nuclei[1];
            }
        }
        foreach (var k in nuclei) if (segs[k].Ph != "ə") return k;
        return nuclei[0];
    }

    /** Phonemize a single stress group (a stem plus its own prefixes/suffixes) — the existing g2p handles its internal
     *  prefix reduction (ge-/be-/ver-/te-) and suffix schwa (-ig/-lijk/-isch). */
    private static string PhonemizeChunk(string word, bool notPrefixed = false)
    {
        var segs = G2p.ToSegments(word);
        if (segs.Count == 0) return "";
        var stress = PlaceStress(segs, word, notPrefixed);
        var outp = "";
        for (var k = 0; k < segs.Count; k++)
        {
            if (k == stress) outp += "ˈ";
            outp += segs[k].Ph;
        }
        return outp;
    }

    /** Merge a decomposition into stem-headed STRESS GROUPS: a prefix attaches to the following element, a suffix to
     *  the preceding, and a second stem starts a new group. So only COMPOUND (stem·stem) boundaries survive —
     *  the g2p already reduces each group's own prefix/suffix internally, and an over-stripped affix simply
     *  rejoins its stem. */
    private static List<string> StressGroups(List<string> parts, List<Kind> kinds)
    {
        var groups = new List<string>();
        var cur = "";
        var hasStem = false;
        for (var i = 0; i < parts.Count; i++)
        {
            if (kinds[i] == Kind.Stem && hasStem) { groups.Add(cur); cur = ""; hasStem = false; }
            cur += parts[i];
            if (kinds[i] == Kind.Stem) hasStem = true;
        }
        if (cur.Length > 0) groups.Add(cur);
        return groups;
    }

    /** Phonemize a single Dutch word to canonical IPA (with a stress mark). A compound is split at its stem·stem
     *  boundaries and each element phonemized independently, so each keeps its own stressed vowel and
     *  devoices at its own boundary (stad·huis → ˈstɑtˈɦœys); a non-compound takes the direct path. */
    public static string PhonemizeWord(string word)
    {
        if (FUNCTION_WORDS.TryGetValue(word.ToLowerInvariant(), out var reduced)) return reduced;
        var w = word.ToLowerInvariant();
        // A prefix SPELLING that is not a prefix (nl-not-prefixed.txt, #1551): no shift in the first chunk.
        var notPrefixed = NotPrefixedWords().Contains(w);
        if (Morphology.IsLexicalWord(w)) return PhonemizeChunk(word, notPrefixed);
        var d = Morphology.Decompose(w);
        if (d.Parts.Count > 1)
        {
            var groups = StressGroups(d.Parts, d.Kinds);
            if (groups.Count > 1) return JoinChunks(groups.Select((g, i) => PhonemizeChunk(g, notPrefixed && i == 0)).ToList());
        }
        return PhonemizeChunk(word, notPrefixed);
    }

    private static readonly IReadOnlySet<string> CONS_IPA =
        new HashSet<string>(Manifest.MANIFEST.ConsonantPhones, StringComparer.Ordinal);

    /** Join compound chunks, DEGEMINATING at each seam: Dutch collapses a doubled consonant across a compound boundary
     *  (voedings+stof → vudɪŋstɔf, knoop+punt → knoːpʏnt, gras+spriet → ɣraspriːt). The next chunk's leading
     *  stress mark is skipped when comparing the seam consonant. */
    private static string JoinChunks(List<string> chunks)
    {
        var outp = chunks.Count > 0 ? chunks[0] : "";
        for (var i = 1; i < chunks.Count; i++)
        {
            var g = chunks[i];
            // JS indexes a string out of range as `undefined`; both reads below can do that on an empty chunk.
            var onset = g.StartsWith("ˈ", StringComparison.Ordinal)
                ? (g.Length > 1 ? g[1].ToString() : null)
                : (g.Length > 0 ? g[0].ToString() : null); // first phoneme (skip a leading stress mark)
            var coda = outp.Length > 0 ? outp[^1].ToString() : null;
            if (coda is not null && onset == coda && CONS_IPA.Contains(coda)) outp = outp[..^1]; // drop the duplicated coda
            outp += g;
        }
        return outp;
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN = JsRegex.Compile(
        "(['’]?[a-zà-ÿ]+(?:['’][a-zà-ÿ]+)*)|([1-9]\\d{0,2}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?)|([.!?…,;:])", "giu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        RateDenominators = Manifest.MANIFEST.SymbolTier.RateDenominators,
        UnitPer = Manifest.MANIFEST.SymbolTier.UnitPer,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        Magnitudes = Manifest.MANIFEST.SymbolTier.Magnitudes,
        Multiply = Manifest.MANIFEST.SymbolTier.Multiply,
    });

    public string Text(string input)
    {
        var normalized = SYMBOLS(Normalize.NormalizeDutchInitialisms(Normalize.NormalizeDutch(input)));
        return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var bits = DOTS.Replace(m.Groups[2].Value, "").Split(',');
                var intPart = bits[0];
                string? frac = bits.Length > 1 ? bits[1] : null;
                foreach (var wd in Numbers.NumberToWords(Js.Number(intPart), intPart).Split(' ')) sink.Emit(PhonemizeWord(wd));
                if (frac is not null)
                {
                    sink.Emit(PhonemizeWord(Manifest.MANIFEST.Numbers.DecimalWord));
                    foreach (var d in frac)
                        foreach (var wd in Numbers.NumberToWords(Js.Number(d.ToString()), d.ToString()).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                }
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Dutch phonemizer. */
    public static ILanguage CreateDutch() => new DutchPhonemizer();

    internal static void RegisterSelf() => Registry.Register("dutch", CreateDutch);
}
