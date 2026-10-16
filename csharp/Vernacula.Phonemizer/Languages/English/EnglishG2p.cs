/**
 * English-native OOV G2P.
 * Ported from src/languages/english/englishG2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

/**
 * The model as `g2p-model.bin` stores it (<see cref="G2pModelBinary"/>): a joint n-gram over grapheme:phone
 * tokens, with the tokens as ids. Context `i` has order `CtxOrder[i]`, its tokens in the LAST that many of its four
 * `CtxTok` slots (the rest `Pad`), total `Total[i]`, and candidates `Cand`/`Count[RowStart[i] .. RowStart[i + 1]]`.
 */
public sealed class EnglishG2pModel
{
    public const ushort Pad = 0xFFFF;
    public required int Order { get; init; }
    public required double Alpha { get; init; }
    public required double Evp { get; init; }
    public required int EvpOrder { get; init; }
    public required Dictionary<string, List<string>> GraphemeChunks { get; init; }
    public required List<string> Tokens { get; init; }
    public required byte[] CtxOrder { get; init; }
    public required ushort[] CtxTok { get; init; }
    public required uint[] Total { get; init; }
    public required uint[] RowStart { get; init; }
    public required ushort[] Cand { get; init; }
    public required uint[] Count { get; init; }
}

/** ARPABET phonetic-class sets injected into the OOV G2P (from english.jsonc's `g2pClasses`). */
public sealed class G2pClassSets
{
    public required IReadOnlyList<string> VowelLetters { get; init; }
    public required IReadOnlyList<string> Vowels { get; init; }
    public required IReadOnlyList<string> Voiceless { get; init; }
    public required IReadOnlyList<string> Sibilants { get; init; }
    public required IReadOnlyList<string> StopPieces { get; init; }

    /// <summary>First pieces after which the STEM keeps the primary — see english.jsonc for the measurement.</summary>
    public required IReadOnlyList<string> StemStressPrefixes { get; init; }

    /// <summary>Letters whose NAME is not spelled by the letter (`a` → `ay`, `i` → `eye`) — lets the
    /// splitter recognise a dictionary row that is an INITIALISM rather than a word.</summary>
    public required IReadOnlyDictionary<string, string> LetterNameExceptions { get; init; }
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
    /** A derivational form read from its DICTIONARY STEM (`castable` = `cast` + -able), or null when the word
     *  has no such suffix or its stem is unknown. The resolver prefers it to the neural tagger (#1504). */
    string? Derived(string word);
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

    /**
     * A predictor emits a digit per position with no global constraint, so it can return ZERO `1`s for a
     * short or odd word; PROMOTE the first vowel so every content word carries a tonic.
     *
     * ⚠ THE DEMOTION HALF MOVED TO `EnglishArpabet.SinglePrimary`. It was only reachable from the OOV paths
     * — the DICTIONARY path does not come through here — so 372 words were emitted with more than one primary
     * mark. It MOVED rather than being copied, because a demotion in both places made the same ARPABET read
     * two ways depending on which path delivered it (`AA1 R CH B IH1 SH AH0 P` → `ˈɑːɹt͡ʃbɪʃəp` via the
     * predictor, `ˌɑːɹt͡ʃbˈɪʃəp` via the dictionary), which is the seam the curation gate exists to catch.
     */
    public static List<string> EnforceSinglePrimary(IReadOnlyList<string> ph, IReadOnlySet<string> vowels)
    {
        var outp = new List<string>(ph);
        if (!outp.Exists(PRIMARY.IsMatch))
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
        /// <summary>
        /// ⚠ TOKENS ARE IDS. A context is the number <c>((((o·B + a)·B + b)·B + c)·B + d)</c> over its four slots,
        /// <c>B</c> = tokens + 1 with the last digit standing for an empty slot, so no context string is ever built.
        /// A token the model never saw is <c>Unseen</c>: any context holding it misses, and it is never a candidate,
        /// exactly what the string lookup did for it.
        /// </summary>
        private const int Unseen = -1;
        private readonly Dictionary<string, int> _tokenId;
        private readonly long _base;
        private readonly Dictionary<long, int> _ctxIndex;
        /// <summary>
        /// ⚠ EACH CONTEXT'S CANDIDATES AS A LOOKUP, built on first use. A linear scan of the candidates (984 in the
        /// empty context) was 22.9 s of Min Nan's 26.7 s golden run, whose Latin runs reach this decoder through the
        /// English reader (docs/investigations/nan/nan_csharp_perf_investigation.md). The first occurrence of a
        /// token wins, as the TypeScript's <c>find</c> did. ⚠ LAZILY: a run touches a small fraction of 61,846.
        /// </summary>
        private readonly System.Collections.Concurrent.ConcurrentDictionary<int, Dictionary<int, double>> _ngramCounts = new();
        private readonly IReadOnlySet<string> VOWEL_LETTER, VOWEL, VOICELESS, SIBILANT, STOP_PIECE, STEM_STRESS_PREFIX;
        private readonly IReadOnlyDictionary<string, string> LETTER_NAME_EXCEPTIONS;
        private readonly List<(string Suf, Func<string, List<string>> Stems, Func<List<string>, List<string>> Allo)> SUFFIXES;

        internal EnglishG2pImpl(EnglishG2pModel model, IReadOnlyDictionary<string, List<string>> dict,
            IReadOnlySet<string> common, Func<IReadOnlyList<string>, string, string> arpabetToIpa, G2pClassSets classes)
        {
            _model = model;
            _dict = dict;
            _common = common;
            _arpabetToIpa = arpabetToIpa;
            _gchunks = new Dictionary<string, List<string>>(model.GraphemeChunks, StringComparer.Ordinal);
            _tokenId = new Dictionary<string, int>(model.Tokens.Count, StringComparer.Ordinal);
            for (var i = 0; i < model.Tokens.Count; i++) _tokenId.TryAdd(model.Tokens[i], i);
            _base = model.Tokens.Count + 1;
            _ctxIndex = new Dictionary<long, int>(model.CtxOrder.Length);
            for (var i = 0; i < model.CtxOrder.Length; i++)
                _ctxIndex[CtxKey(model.CtxOrder[i], model.CtxTok.AsSpan(i * 4, 4))] = i;
            VOWEL_LETTER = new HashSet<string>(classes.VowelLetters, StringComparer.Ordinal);
            VOWEL = new HashSet<string>(classes.Vowels, StringComparer.Ordinal);
            VOICELESS = new HashSet<string>(classes.Voiceless, StringComparer.Ordinal);
            SIBILANT = new HashSet<string>(classes.Sibilants, StringComparer.Ordinal);
            STOP_PIECE = new HashSet<string>(classes.StopPieces, StringComparer.Ordinal);
            STEM_STRESS_PREFIX = new HashSet<string>(classes.StemStressPrefixes, StringComparer.Ordinal);
            LETTER_NAME_EXCEPTIONS = classes.LetterNameExceptions;

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
                // -able/-ible prefer the stem WITHOUT ⟨e⟩ (#1504); see the TS twin for the measurement.
                ("able", w =>
                {
                    // `-iable` tries the ⟨y⟩ stem FIRST: `reli` is a dictionary row too (see the TS twin).
                    var stems = new List<string>();
                    if (w.Length >= 5 && w[^5] == 'i') stems.Add(Slice(w, 5) + "y");
                    stems.Add(Slice(w, 4));
                    stems.Add(Slice(w, 4) + "e");
                    if (w.Length >= 6 && w[^5] == w[^6]) stems.Add(Slice(w, 5));
                    return stems;
                }, _ => new() { "AH0", "B", "AH0", "L" }),
                ("ible", w => new() { Slice(w, 4), Slice(w, 4) + "e" }, _ => new() { "AH0", "B", "AH0", "L" }),
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

        private long CtxKey(int o, ReadOnlySpan<ushort> slots)
        {
            long k = o;
            foreach (var t in slots) k = k * _base + (t == EnglishG2pModel.Pad ? _base - 1 : t);
            return k;
        }

        private Dictionary<int, double> Counts(int i) =>
            _ngramCounts.GetOrAdd(i, _ =>
            {
                var count = new Dictionary<int, double>();
                for (var k = (int)_model.RowStart[i]; k < (int)_model.RowStart[i + 1]; k++)
                    count.TryAdd(_model.Cand[k], _model.Count[k]);
                return count;
            });

        /// <summary>
        /// The n-gram contexts of <paramref name="hist"/>, longest first: element <c>Order - 1 - o</c> is the order-o
        /// context, or null where the model has none. ⚠ RESOLVED ONCE PER HYPOTHESIS, not once per candidate chunk:
        /// they depend only on the history. <paramref name="hist"/> needs only its last <c>Order - 1</c> tokens.
        /// </summary>
        private (double Total, Dictionary<int, double> Counts)?[] Contexts(int[] hist)
        {
            var out_ = new (double, Dictionary<int, double>)?[_model.Order];
            Span<ushort> slots = stackalloc ushort[4];
            for (var o = _model.Order - 1; o >= 0; o--)
            {
                var seen = true;
                for (var j = 0; j < 4; j++)
                {
                    var t = j < 4 - o ? EnglishG2pModel.Pad : hist[hist.Length - 4 + j];
                    if (t == Unseen) { seen = false; break; }
                    slots[j] = (ushort)t;
                }
                if (seen && _ctxIndex.TryGetValue(CtxKey(o, slots), out var i))
                    out_[_model.Order - 1 - o] = (_model.Total[i], Counts(i));
            }
            return out_;
        }

        /// <summary>The highest-order context that has <paramref name="tok"/>, backed off by alpha per order skipped.</summary>
        private (double Score, int Order) ScoreTokAt((double Total, Dictionary<int, double> Counts)?[] contexts, int tok)
        {
            for (var o = _model.Order - 1; o >= 0; o--)
            {
                if (contexts[_model.Order - 1 - o] is var (total, counts) && counts.TryGetValue(tok, out var n))
                    return (Math.Log(n / total) + (_model.Order - 1 - o) * Math.Log(_model.Alpha), o);
            }
            return (Math.Log(1e-7), -1);
        }

        /// <summary>A hypothesis. ⚠ <c>Hist</c> keeps only the last <c>Order - 1</c> tokens (all `ScoreTokAt` reads),
        /// and <c>Phones</c> is a chain back to the start, materialised once at the end: copying both lists for
        /// every candidate chunk at every letter made the decoder quadratic in word length and GC-bound.</summary>
        private sealed record BeamItem(int[] Hist, PhoneChain? Phones, double Score);

        private sealed record PhoneChain(string[] Chunk, PhoneChain? Prev);

        private static List<string> Materialise(PhoneChain? p)
        {
            var parts = new List<string[]>();
            for (; p != null; p = p.Prev) parts.Add(p.Chunk);
            var out_ = new List<string>();
            for (var i = parts.Count - 1; i >= 0; i--) out_.AddRange(parts[i]);
            return out_;
        }

        private List<string> NgramDecode(string w)
        {
            var beam = new List<BeamItem>
            {
                new(Window([StartId, StartId, StartId, StartId]), null, 0),
            };
            for (var i = 0; i < w.Length; i++)
            {
                var c = w[i].ToString();
                var raw = _gchunks.TryGetValue(c, out var g) ? g : new List<string> { "" };
                var emptyPenalized = VOWEL_LETTER.Contains(c) && !(c == "e" && i == w.Length - 1);
                // ⚠ A silent WORD-FINAL consonant letter costs HALF the vowel penalty, regardless of the order found
                // (#1265) — mirrors englishG2p.ts, where the measurement is recorded. Not `y`, not a doubled letter.
                var finalConsonant = i == w.Length - 1 && w[i] >= 'a' && w[i] <= 'z' && !VOWEL_LETTER.Contains(c) && w[i] != 'y'
                    && !(i > 0 && w[i - 1] == w[i]);
                var sibLetter = "sxzc".Contains(c, StringComparison.Ordinal);
                var filtered = sibLetter ? raw : raw.Where(ch =>
                {
                    if (ch.Length == 0) return true;
                    var last = ch.Split(' ')[^1];
                    return last != "S" && last != "Z";
                }).ToList();
                var chunks = filtered.Count > 0 ? filtered : raw;
                // Per letter, not per hypothesis: each chunk's joint token and its phones.
                var toks = chunks.Select(ch => _tokenId.TryGetValue($"{c}:{ch}", out var id) ? id : Unseen).ToArray();
                var pieces = chunks.Select(ch => ch.Length > 0 ? ch.Split(' ') : null).ToArray();
                // Scored first, built only if it survives: (score, hypothesis, chunk) in insertion order.
                var next = new List<(double Score, BeamItem H, int K)>(beam.Count * chunks.Count);
                foreach (var h in beam)
                {
                    var contexts = Contexts(h.Hist);
                    for (var k = 0; k < chunks.Count; k++)
                    {
                        var chunk = chunks[k];
                        var (lp, ord) = ScoreTokAt(contexts, toks[k]);
                        var s = h.Score + lp;
                        if (chunk == "" && emptyPenalized && ord < _model.EvpOrder) s -= _model.Evp;
                        if (chunk == "" && finalConsonant) s -= _model.Evp / 2;
                        next.Add((s, h, k));
                    }
                }
                // ⚠ STABLE, like JS Array.prototype.sort — equal-scoring beam items must keep insertion order
                // or the surviving hypothesis can differ from Node's on a tie.
                beam = next.OrderByDescending(x => x.Score).Take(BEAM)
                    .Select(x => new BeamItem(
                        Window([.. x.H.Hist, toks[x.K]]),
                        pieces[x.K] is { } ps ? new PhoneChain(ps, x.H.Phones) : x.H.Phones,
                        x.Score))
                    .ToList();
            }
            return Materialise(beam[0].Phones);
        }

        /// <summary>The last <c>Order - 1</c> tokens of <paramref name="hist"/>.</summary>
        private int StartId => _tokenId.TryGetValue(START, out var id) ? id : Unseen;

        private int[] Window(int[] hist)
        {
            var k = Math.Max(_model.Order - 1, 0);
            return hist.Length <= k ? hist : hist[^k..];
        }

        /// <summary>
        /// ⚠ THE JOIN IS NOT A CONCATENATION for an `-ire` stem. CMUdict writes word-final `-ire` as
        /// `… AY ER` — correct, a syllabic ɚ — and that stays before a CONSONANT allomorph
        /// (`misfires` AY1 ER0 Z). Before a VOWEL-initial one the rhotic resyllabifies as that syllable's
        /// onset (`firing` F AY1 R IH0 NG), and pasting the stem on unchanged reproduces the defect #1289
        /// fixed in the dict — but on an OPEN class: `misfiring`, `umpiring`, `attiring` are all unlisted.
        ///
        /// ⚠ THE CONDITION IS THE STEM'S SPELLING, NOT THE PRECEDING VOWEL. Over every attested
        /// stem/derivative pair in the dict a `-ire` spelling scores 15:2; a plain ER-before-vowel rule
        /// would be WRONG, since `water` + `ing` is W AO1 T ER0 IH0 NG and 429 such pairs keep the `ER`.
        ///
        /// ⚠ AN `ER`-INITIAL ALLOMORPH IS NOT EXEMPT, AND THE EVIDENCE IS THIN. Strictly, `enquirer`
        /// resyllabifies where `acquirer`/`acquirers` do not — 1 against 2, a MINORITY. It is dropped on
        /// two grounds independent of that tally: the dict's surface shape for `-irer` is `AY1 R ER0`
        /// (`enquirer`, `inquirer`, `admirer`) against a DOUBLED rhotic nucleus in `acquirer` (3:2), and
        /// `acquirer`/`acquirers` are dict-resident so the OOV path never reaches them. Cost: 3 dict rows
        /// move, a held-out net of −1, all on words production answers from the dict.</summary>
        /// <remarks>See docs/investigations/en/en_oov_curation_gap_investigation.md (#1295).
        /// See docs/investigations/en/en_oov_curation_gap_investigation.md (#1295).
        /// </summary>
        private List<string> JoinMorph(string stem, List<string> sp, List<string> suffix)
        {
            var last = sp.Count > 0 ? sp[^1] : null;
            if (last is null
                || !stem.EndsWith("ire", StringComparison.Ordinal)
                || DropStress(last) != "ER"
                || suffix.Count == 0
                || !VOWEL.Contains(DropStress(suffix[0])))
            {
                return sp.Concat(suffix).ToList();
            }
            return sp.Take(sp.Count - 1).Append("R").Concat(suffix).ToList();
        }

        /// <summary>
        /// <paramref name="asPiece"/> exists because the initialism guard belongs to the PIECE site, not
        /// to this method: rejecting a letter-name stem outright also blocks the CORRECT decode of an
        /// initialism's plural (`mphs` → "em-pee-aitch-ESS"), and mis-fires on an ordinary row that
        /// coincides with its letter names (`ok` is `OW1 K EY1`, so `oks` became "oaks").
        /// </summary>
        private List<string>? MorphDecode(string w, bool asPiece = false)
        {
            foreach (var (suf, stems, allo) in SUFFIXES)
            {
                if (!w.EndsWith(suf, StringComparison.Ordinal) || w.Length <= suf.Length + 1) continue;
                if (asPiece && DERIVATIONAL_ONLY.Contains(suf)) continue;
                foreach (var stem in stems(w))
                {
                    if (stem.Length < 2) continue;
                    // `ach`+`er` is not how `acher` is read — but `mph`+`s` IS how `mphs` is read. The
                    // exemption is the PLURAL SUFFIX, not a property of the stem: gating on "the stem has
                    // no vowel" breaks 14 genuine initialism plurals to save one row. See the TS twin.
                    if (IsLetterNameRow(stem) && (asPiece || !PLURAL_SUFFIX.Contains(suf))) continue;
                    if (!_dict.TryGetValue(stem, out var sp)) continue;
                    return JoinMorph(stem, sp, allo(sp));
                }
            }
            return null;
        }

        /// <summary>
        /// <c>Head</c> is the FIRST PIECE'S SPELLING, carried because the stress policy in
        /// <see cref="CompoundSplit"/> needs it and the phones cannot supply it: <c>dis</c> and
        /// <c>diss</c> decode alike, and a prefix is a fact about the morphology, not about the phones.
        /// </summary>
        private sealed record SplitState(List<List<string>> Parts, string Head, int NParts, double MinLen, double Score);

        private List<string>? LetterPhones(char l)
        {
            var key = LETTER_NAME_EXCEPTIONS.TryGetValue(l.ToString(), out var n) ? n : l.ToString();
            return _dict.TryGetValue(key, out var p) ? p : null;
        }

        /// <summary>
        /// 210 rows of the dictionary are an INITIALISM spelled out, not a word (`abs` = EY1 B IY1 EH1 S).
        /// Correct as whole words, catastrophic as PIECES of a longer one — see the TS twin for the
        /// measurement. Derived from the dictionary rather than listed, and deliberately NOT memoized:
        /// a cache keyed on a word is a cache keyed on `_dict`, which the hold-out tests mutate.
        /// </summary>
        /// <summary>Suffixes MorphDecode serves only to a WHOLE word, never to CompoundSplit's final piece
        /// (#1504): a stem+able piece lets the splitter compose `in|credible` with the stress on `in`.</summary>
        private static readonly HashSet<string> DERIVATIONAL_ONLY = new(StringComparer.Ordinal) { "able", "ible" };
        private static bool EndsDerivational(string w) => DERIVATIONAL_ONLY.Any(s => w.EndsWith(s, StringComparison.Ordinal));
        /// <summary>The inflections an INITIALISM genuinely takes — see MorphDecode.</summary>
        private static readonly HashSet<string> PLURAL_SUFFIX = new(StringComparer.Ordinal) { "s", "es", "sses" };

        private bool IsLetterNameRow(string piece)
        {
            if (piece.Length < 2 || !_dict.TryGetValue(piece, out var phones)) return false;
            var want = new List<string>();
            foreach (var l in piece)
            {
                var lp = LetterPhones(l);
                if (lp is null) return false;
                want.AddRange(lp);
            }
            if (want.Count != phones.Count) return false;
            for (var i = 0; i < want.Count; i++)
                if (DropStress(want[i]) != DropStress(phones[i])) return false;
            return true;
        }

        private static bool HasNucleusIn(IReadOnlyList<string> ph, IReadOnlySet<string> vowels)
        {
            foreach (var p in ph) if (vowels.Contains(DropStress(p))) return true;
            return false;
        }

        /// <summary>The last THREE letters are the same — `hmmmm`, `shhh`, `zzz`. A doubled final letter
        /// is ordinary English (`hdd` and `cnn` are initialisms); a tripled one is elongation.</summary>
        private static bool HasVowelLetter(string w)
        {
            foreach (var c in w) if ("aeiouy".Contains(c)) return true;
            return false;
        }

        private static bool IsElongation(string w) =>
            w.Length >= 3 && w[^1] == w[^2] && w[^2] == w[^3];

        private List<string>? SpellOutPhones(string w)
        {
            var outp = new List<string>();
            foreach (var l in w)
            {
                var lp = LetterPhones(l);
                if (lp is null) return null;
                outp.AddRange(lp);
            }
            return outp.Count > 0 ? outp : null;
        }


        private List<string>? CompoundSplit(string w)
        {
            var n = w.Length;
            var best = new SplitState?[n + 1];
            best[0] = new SplitState(new List<List<string>>(), "", 0, double.PositiveInfinity, 0);
            for (var i = 0; i < n; i++)
            {
                if (best[i] is null) continue;
                for (var j = i + MINPART; j <= n; j++)
                {
                    var piece = w[i..j];
                    if (STOP_PIECE.Contains(piece)) continue;
                    if (_common.Count > 0 && !_common.Contains(piece) && !(j == n && j - i >= 5)) continue;
                    // An initialism row is not a piece — see IsLetterNameRow. Tested BEFORE the
                    // morphDecode fallback, so `acher` cannot smuggle `ach` in through the suffix table.
                    List<string>? phones = !IsLetterNameRow(piece) && _dict.TryGetValue(piece, out var dp) ? dp : null;
                    if (phones is null && j == n && j - i >= 5)
                    {
                        var mp = MorphDecode(piece, true);
                        if (mp is not null) phones = mp;
                    }
                    if (phones is null) continue;
                    var b = best[i]!;
                    var cand = new SplitState(
                        new List<List<string>>(b.Parts) { phones },
                        i == 0 ? piece : b.Head,
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
            // This was unconditional fore-stress. It now consults `stemStressPrefixes`, which is right on
            // 84.0% of the 13,661 words the path decodes against 78.8% before — see the TS twin's comment
            // and english.jsonc for the measurement and for why the list is not the morpheme-boundary table.
            // The STEM is piece 1, not the last piece — see the TS twin. `Count - 1` is the same thing
            // only for a two-piece split, and on a three-piece one it stressed the final fragment.
            if (STEM_STRESS_PREFIX.Contains(full.Head))
                return full.Parts.SelectMany((p, idx) => idx == 1 ? p : StressDown(p)).ToList();
            return full.Parts.SelectMany((p, idx) => idx == 0 ? p : StressDown(p)).ToList();
        }

        public Decomposition Decompose(string w)
        {
            // A derivational suffix outranks the compound split (#1504): `able` is a common word, so the
            // splitter read `accept|able` with the full vowel of the word *able*. See the TS twin.
            var derived = EndsDerivational(w) ? MorphDecode(w) : null;
            var c = derived is null ? CompoundSplit(w) : null;
            if (c is not null)
                return new Decomposition { Phones = EnforceSinglePrimary(CollapseGeminates(c, VOWEL), VOWEL), Source = "C" };
            var m = derived ?? MorphDecode(w);
            if (m is not null)
                return new Decomposition { Phones = EnforceSinglePrimary(CollapseGeminates(m, VOWEL), VOWEL), Source = "M" };
            var ng = EnforceSinglePrimary(CollapseGeminates(NgramDecode(w), VOWEL), VOWEL);
            // A reading with no vowel nucleus is not a pronunciation — see the TS twin. `blt` came out
            // `B L T`. Nothing correct is at risk: every vowelless English word is a recorded interjection
            // and a recorded word never reaches the OOV path.
            if (w.Length >= 2 && !HasNucleusIn(ng, VOWEL) && !IsElongation(w))
            {
                // A trailing `s` on an initialism is the PLURAL, not the letter ESS — `blts` must agree
                // with `blt's`, which the clitic strip reaches first.
                var plural = w.EndsWith('s') && w.Length >= 4 && !HasVowelLetter(w[..^1]);
                var spelled = SpellOutPhones(plural ? w[..^1] : w);
                if (spelled is not null)
                {
                    if (plural) spelled.Add("Z");
                    return new Decomposition { Phones = EnforceSinglePrimary(spelled, VOWEL), Source = "N" };
                }
            }
            return new Decomposition { Phones = ng, Source = "N" };
        }

        public bool KnownWord(string word) => _dict.ContainsKey(word);

        public string? Derived(string word)
        {
            if (!EndsDerivational(word)) return null;
            var m = MorphDecode(word);
            return m is null ? null : _arpabetToIpa(EnforceSinglePrimary(CollapseGeminates(m, VOWEL), VOWEL), word);
        }

        public string G2p(string word)
        {
            var d = Decompose(word);
            // ⚠ Only the COMPOUND path withholds the word — a morph decomposition's suffix is real by
            // construction. See src/languages/english/englishG2p.ts.
            return _arpabetToIpa(d.Phones, d.Source == "C" ? "" : word);
        }
    }
}
