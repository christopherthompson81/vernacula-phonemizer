/**
 * English-native OOV G2P.
 * Ported from src/languages/english/englishG2p.ts — see that file for the corpus evidence.
 */
using System.Text.Json.Serialization;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public sealed class NgramEntry
{
    /** full context total */
    [JsonPropertyName("t")] public double T { get; init; }
    /** pruned top-K [chunk, count] */
    [JsonPropertyName("c")] public List<List<System.Text.Json.JsonElement>> C { get; init; } = new();
}

/** Serialized model: a joint n-gram over grapheme:phone tokens (`en_g2p_ngram.ts --emit`). */
public sealed class EnglishG2pModel
{
    public int Order { get; init; }
    public double Alpha { get; init; }
    public double Evp { get; init; }
    public int EvpOrder { get; init; }
    public Dictionary<string, List<string>> GraphemeChunks { get; init; } = new();
    /** key `${order}|${ctx}` → { t: full context total, c: pruned top-K [chunk, count] }. */
    public Dictionary<string, NgramEntry> Ngram { get; init; } = new();
}

/** ARPABET phonetic-class sets injected into the OOV G2P (from english.jsonc's `g2pClasses`). */
public sealed class G2pClassSets
{
    public required IReadOnlyList<string> VowelLetters { get; init; }
    public required IReadOnlyList<string> Vowels { get; init; }
    public required IReadOnlyList<string> Voiceless { get; init; }
    public required IReadOnlyList<string> Sibilants { get; init; }
    public required IReadOnlyList<string> StopPieces { get; init; }
}

public sealed class Decomposition
{
    public required List<string> Phones { get; init; }
    /** "C" | "M" | "N" */
    public required string Source { get; init; }
}

public interface IEnglishG2p
{
    /** OOV word (lowercase letters) → canonical IPA. */
    string G2p(string word);
    /** Is this a known CMUdict word? A word that is in CMUdict but NOT in the pronunciation lexicon is an
     *  excluded HOMOGRAPH (read/use/close) — the router keeps the POS-gated output rather than
     *  G2P'ing it. Only genuinely-unknown words (!knownWord) should be routed to `G2p`. */
    bool KnownWord(string word);
    /** Diagnostic: the ARPABET decomposition + which path produced it (C/M/N). */
    Decomposition Decompose(string word);
}

public static class EnglishG2pFactory
{
    private const string START = "^";
    private const int BEAM = 12;
    private const int MINPART = 3;

    private static readonly JsRe STRESS_DIGIT = JsRegex.Compile("[0-2]$");
    private static readonly JsRe PRIMARY = JsRegex.Compile("1$");
    private static readonly JsRe FINAL_I = JsRegex.Compile("i$");

    private static string DropStress(string p) => STRESS_DIGIT.Replace(p, "");
    private static List<string> StressDown(IReadOnlyList<string> ph) => ph.Select(p => PRIMARY.Replace(p, "2")).ToList();

    /** Collapse a doubled CONSONANT (bus+sin seam → bʌssɪn → bʌsɪn; CMUdict has no consonant geminates). */
    public static List<string> CollapseGeminates(IReadOnlyList<string> ph, IReadOnlySet<string> vowels)
    {
        var outp = new List<string>();
        foreach (var p in ph)
            if (outp.Count == 0 || outp[^1] != p || vowels.Contains(DropStress(p))) outp.Add(p);
        return outp;
    }

    /** A word has exactly ONE primary stress. */
    public static List<string> EnforceSinglePrimary(IReadOnlyList<string> ph, IReadOnlySet<string> vowels)
    {
        var seen = false;
        var outp = new List<string>(ph.Count);
        foreach (var p in ph)
        {
            if (!PRIMARY.IsMatch(p)) { outp.Add(p); continue; }
            if (seen) { outp.Add(PRIMARY.Replace(p, "2")); continue; }
            seen = true;
            outp.Add(p);
        }
        if (!seen)
        {
            var vi = outp.FindIndex(p => vowels.Contains(DropStress(p)));
            if (vi >= 0) outp[vi] = STRESS_DIGIT.Replace(outp[vi], "1");
        }
        return outp;
    }

    /**
     * Build the engine from a model + the CMUdict ARPABET dict (word → phones, for compound pieces / morph
     * stems) + the `common`-word set (frequency gate for compound pieces).
     */
    public static IEnglishG2p CreateEnglishG2p(
        EnglishG2pModel model,
        IReadOnlyDictionary<string, List<string>> dict,
        IReadOnlySet<string> common,
        Func<IReadOnlyList<string>, string, string> arpabetToIpa,
        G2pClassSets classes) =>
        new EnglishG2pImpl(model, dict, common, arpabetToIpa, classes);

    private sealed class EnglishG2pImpl : IEnglishG2p
    {
        private readonly EnglishG2pModel _model;
        private readonly IReadOnlyDictionary<string, List<string>> _dict;
        private readonly IReadOnlySet<string> _common;
        private readonly Func<IReadOnlyList<string>, string, string> _arpabetToIpa;
        private readonly Dictionary<string, List<string>> _gchunks;
        private readonly IReadOnlySet<string> VOWEL_LETTER, VOWEL, VOICELESS, SIBILANT, STOP_PIECE;
        private readonly List<(string Suf, Func<string, List<string>> Stems, Func<List<string>, List<string>> Allo)> SUFFIXES;

        internal EnglishG2pImpl(EnglishG2pModel model, IReadOnlyDictionary<string, List<string>> dict,
            IReadOnlySet<string> common, Func<IReadOnlyList<string>, string, string> arpabetToIpa, G2pClassSets classes)
        {
            _model = model;
            _dict = dict;
            _common = common;
            _arpabetToIpa = arpabetToIpa;
            _gchunks = new Dictionary<string, List<string>>(model.GraphemeChunks, StringComparer.Ordinal);
            VOWEL_LETTER = new HashSet<string>(classes.VowelLetters, StringComparer.Ordinal);
            VOWEL = new HashSet<string>(classes.Vowels, StringComparer.Ordinal);
            VOICELESS = new HashSet<string>(classes.Voiceless, StringComparer.Ordinal);
            SIBILANT = new HashSet<string>(classes.Sibilants, StringComparer.Ordinal);
            STOP_PIECE = new HashSet<string>(classes.StopPieces, StringComparer.Ordinal);

            List<string> AllomorphS(List<string> stem)
            {
                var f = DropStress(stem.Count > 0 ? stem[^1] : "");
                return SIBILANT.Contains(f) ? new List<string> { "IH0", "Z" }
                    : VOICELESS.Contains(f) ? new List<string> { "S" }
                    : new List<string> { "Z" };
            }
            List<string> AllomorphED(List<string> stem)
            {
                var f = DropStress(stem.Count > 0 ? stem[^1] : "");
                return f == "T" || f == "D" ? new List<string> { "IH0", "D" }
                    : VOICELESS.Contains(f) ? new List<string> { "T" }
                    : new List<string> { "D" };
            }
            static string Slice(string w, int drop) => w.Length >= drop ? w[..^drop] : "";
            SUFFIXES = new()
            {
                ("ies", w => new() { Slice(w, 3) + "y" }, _ => new() { "IY0", "Z" }),
                ("ied", w => new() { Slice(w, 3) + "y" }, _ => new() { "D" }),
                ("sses", w => new() { Slice(w, 2) }, AllomorphS),
                ("ing", w => new() { Slice(w, 3), Slice(w, 3) + "e", Slice(w, 4) }, _ => new() { "IH0", "NG" }),
                ("ings", w => new() { Slice(w, 4), Slice(w, 4) + "e" }, _ => new() { "IH0", "NG", "Z" }),
                ("edly", w => new() { Slice(w, 4), Slice(w, 4) + "e" }, _ => new() { "IH0", "D", "L", "IY0" }),
                ("ness", w => new() { Slice(w, 4), FINAL_I.Replace(Slice(w, 4), "y") }, _ => new() { "N", "AH0", "S" }),
                ("less", w => new() { Slice(w, 4) }, _ => new() { "L", "AH0", "S" }),
                ("ment", w => new() { Slice(w, 4) }, _ => new() { "M", "AH0", "N", "T" }),
                ("ful", w => new() { Slice(w, 3) }, _ => new() { "F", "AH0", "L" }),
                ("est", w => new() { Slice(w, 3), Slice(w, 3) + "e", FINAL_I.Replace(Slice(w, 3), "y") }, _ => new() { "IH0", "S", "T" }),
                ("ers", w => new() { Slice(w, 3), Slice(w, 3) + "e", Slice(w, 4) }, _ => new() { "ER0", "Z" }),
                ("er", w => new() { Slice(w, 2), Slice(w, 2) + "e", Slice(w, 3), FINAL_I.Replace(Slice(w, 2), "y") }, _ => new() { "ER0" }),
                ("ly", w => new() { Slice(w, 2), FINAL_I.Replace(Slice(w, 2), "y"), Slice(w, 2) + "le" }, _ => new() { "L", "IY0" }),
                ("ed", w => new() { Slice(w, 2), Slice(w, 1), Slice(w, 3) }, AllomorphED),
                ("es", w => new() { Slice(w, 2), Slice(w, 1) }, AllomorphS),
                ("s", w => new() { Slice(w, 1) }, AllomorphS),
            };
        }

        private (double Score, int Order) ScoreTokAt(IReadOnlyList<string> hist, string tok)
        {
            for (var o = _model.Order - 1; o >= 0; o--)
            {
                var ctx = o == 0 ? "" : string.Join(" ", hist.Skip(hist.Count - o));
                if (_model.Ngram.TryGetValue($"{o}|{ctx}", out var e))
                {
                    foreach (var pair in e.C)
                    {
                        if (pair[0].GetString() != tok) continue;
                        return (Math.Log(pair[1].GetDouble() / e.T) + (_model.Order - 1 - o) * Math.Log(_model.Alpha), o);
                    }
                }
            }
            return (Math.Log(1e-7), -1);
        }

        private sealed record BeamItem(List<string> Hist, List<string> Phones, double Score);

        private List<string> NgramDecode(string w)
        {
            var beam = new List<BeamItem>
            {
                new(new List<string> { START, START, START, START }, new List<string>(), 0),
            };
            for (var i = 0; i < w.Length; i++)
            {
                var c = w[i].ToString();
                var raw = _gchunks.TryGetValue(c, out var g) ? g : new List<string> { "" };
                var emptyPenalized = VOWEL_LETTER.Contains(c) && !(c == "e" && i == w.Length - 1);
                var sibLetter = "sxzc".Contains(c, StringComparison.Ordinal);
                var filtered = sibLetter ? raw : raw.Where(ch =>
                {
                    if (ch.Length == 0) return true;
                    var last = ch.Split(' ')[^1];
                    return last != "S" && last != "Z";
                }).ToList();
                var chunks = filtered.Count > 0 ? filtered : raw;
                var next = new List<BeamItem>();
                foreach (var h in beam)
                {
                    foreach (var chunk in chunks)
                    {
                        var (lp, ord) = ScoreTokAt(h.Hist, $"{c}:{chunk}");
                        var s = h.Score + lp;
                        if (chunk == "" && emptyPenalized && ord < _model.EvpOrder) s -= _model.Evp;
                        var hist = new List<string>(h.Hist) { $"{c}:{chunk}" };
                        var phones = chunk.Length > 0
                            ? new List<string>(h.Phones).Concat(chunk.Split(' ')).ToList()
                            : new List<string>(h.Phones);
                        next.Add(new BeamItem(hist, phones, s));
                    }
                }
                // ⚠ STABLE, like JS Array.prototype.sort — equal-scoring beam items must keep insertion order
                // or the surviving hypothesis can differ from Node's on a tie.
                beam = next.OrderByDescending(x => x.Score).Take(BEAM).ToList();
            }
            return beam[0].Phones;
        }

        private List<string>? MorphDecode(string w)
        {
            foreach (var (suf, stems, allo) in SUFFIXES)
            {
                if (!w.EndsWith(suf, StringComparison.Ordinal) || w.Length <= suf.Length + 1) continue;
                foreach (var stem in stems(w))
                {
                    if (stem.Length < 2) continue;
                    if (!_dict.TryGetValue(stem, out var sp)) continue;
                    return sp.Concat(allo(sp)).ToList();
                }
            }
            return null;
        }

        private sealed record SplitState(List<List<string>> Parts, int NParts, double MinLen, double Score);

        private List<string>? CompoundSplit(string w)
        {
            var n = w.Length;
            var best = new SplitState?[n + 1];
            best[0] = new SplitState(new List<List<string>>(), 0, double.PositiveInfinity, 0);
            for (var i = 0; i < n; i++)
            {
                if (best[i] is null) continue;
                for (var j = i + MINPART; j <= n; j++)
                {
                    var piece = w[i..j];
                    if (STOP_PIECE.Contains(piece)) continue;
                    if (_common.Count > 0 && !_common.Contains(piece) && !(j == n && j - i >= 5)) continue;
                    List<string>? phones = _dict.TryGetValue(piece, out var dp) ? dp : null;
                    if (phones is null && j == n && j - i >= 5)
                    {
                        var mp = MorphDecode(piece);
                        if (mp is not null) phones = mp;
                    }
                    if (phones is null) continue;
                    var b = best[i]!;
                    var cand = new SplitState(
                        new List<List<string>>(b.Parts) { phones },
                        b.NParts + 1,
                        Math.Min(b.MinLen, j - i),
                        b.Score + (double)(j - i) * (j - i));
                    var cur = best[j];
                    if (cur is null || cand.MinLen > cur.MinLen || (cand.MinLen == cur.MinLen && cand.Score > cur.Score))
                        best[j] = cand;
                }
            }
            var full = best[n];
            if (full is null || full.NParts < 2) return null;
            return full.Parts.SelectMany((p, idx) => idx == 0 ? p : StressDown(p)).ToList();
        }

        public Decomposition Decompose(string w)
        {
            var c = CompoundSplit(w);
            if (c is not null)
                return new Decomposition { Phones = EnforceSinglePrimary(CollapseGeminates(c, VOWEL), VOWEL), Source = "C" };
            var m = MorphDecode(w);
            if (m is not null)
                return new Decomposition { Phones = EnforceSinglePrimary(CollapseGeminates(m, VOWEL), VOWEL), Source = "M" };
            return new Decomposition
            {
                Phones = EnforceSinglePrimary(CollapseGeminates(NgramDecode(w), VOWEL), VOWEL),
                Source = "N",
            };
        }

        public bool KnownWord(string word) => _dict.ContainsKey(word);

        public string G2p(string word)
        {
            var d = Decompose(word);
            return _arpabetToIpa(d.Phones, d.Source == "N" ? word : "");
        }
    }
}
