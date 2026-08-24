/**
 * Pure averaged-perceptron POS tagger.
 * Ported from src/languages/english/posTagger.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

/** Coarse POS expectations consumed by the dictionary homograph gating (`$verb`/`$noun`/`$past`). */
public sealed class PosExpectation
{
    public required bool Verb { get; init; }
    public required bool Noun { get; init; }
    public required bool Past { get; init; }
}

/** Serialized model artifact format (emitted by `tools/english/en_pos_train.ts`). */
public sealed class PosModel
{
    public double Scale { get; init; }
    public List<string> Classes { get; init; } = new();
    public Dictionary<string, int> Tagdict { get; init; } = new();
    public Dictionary<string, Dictionary<string, double>> Weights { get; init; } = new(); // feature -> classIdx -> intWeight
}

public static class Pos
{
    public const string START = "-START-";
    public const string END = "-END-";

    private static readonly JsRe ALL_DIGITS = JsRegex.Compile("^[0-9]+$");

    /** Normalize a token the way the trainer did: years, numbers, digit-bearing tokens. */
    public static string NormalizeToken(string word)
    {
        if (word.Length == 4 && ALL_DIGITS.IsMatch(word)) return "!YEAR";
        var first = word.Length > 0 ? word[0] : (char?)null;
        if (first is >= '0' and <= '9') return "!DIGITS";
        return word.ToLowerInvariant();
    }

    /** Honnibal/Collins feature set. */
    public static Dictionary<string, double> ExtractFeatures(int i, string word, IReadOnlyList<string> context, string prev, string prev2)
    {
        var feats = new Dictionary<string, double>(StringComparer.Ordinal);
        void Add(params string[] parts) => feats[string.Join(" ", parts)] = 1;
        var c = i + 2; // index into padded context (always in-bounds: two START + two END pads)
        string At(int k) => k >= 0 && k < context.Count ? context[k] : "";
        static string Suffix(string w) => w.Length <= 3 ? w : w[^3..]; // JS w.slice(-3)
        Add("bias");
        Add("i suffix", Suffix(word));
        Add("i pref1", word.Length > 0 ? word[0].ToString() : "");
        Add("i-1 tag", prev);
        Add("i-2 tag", prev2);
        Add("i tag+i-2 tag", prev, prev2);
        Add("i word", At(c));
        Add("i-1 tag+i word", prev, At(c));
        Add("i-1 word", At(c - 1));
        Add("i-1 suffix", Suffix(At(c - 1)));
        Add("i-2 word", At(c - 2));
        Add("i+1 word", At(c + 1));
        Add("i+1 suffix", Suffix(At(c + 1)));
        Add("i+2 word", At(c + 2));
        return feats;
    }

    /** Map a Penn-Treebank tag to `PosExpectation`. */
    public static PosExpectation PosExpectationOf(string tag) => new()
    {
        Verb = tag == "MD" || tag.StartsWith("VB", StringComparison.Ordinal),
        Noun = tag.StartsWith("NN", StringComparison.Ordinal),
        Past = tag == "VBD" || tag == "VBN",
    };

    /**
     * Tags that head an object noun phrase: a determiner (`the`/`a`/`this`/…) or an object pronoun
     * (`it`/`them`/…) or a possessive (`your`/`his`/…).
     */
    public static bool HeadsObjectPhrase(string tag) =>
        tag == "DT" || tag == "PDT" || tag == "WDT" || tag == "PRP$" || tag == "PRP";

    /**
     * UPOS tags that are NOMINAL — they take FINAL stress in nominal-final-stress languages (Persian
     * nouns/adjectives).
     */
    public static bool IsNominalTag(string tag) =>
        tag == "NOUN" || tag == "PROPN" || tag == "ADJ" || tag == "NUM";

    /** UPOS tags that are VERBAL (Persian verb prefix-stress). */
    public static bool IsVerbalUpos(string tag) => tag == "VERB" || tag == "AUX";
}

/** Greedy left-to-right averaged-perceptron tagger. */
public sealed class PosTagger
{
    private readonly List<string> _classes;
    private readonly Dictionary<string, int> _tagdict;
    private readonly Dictionary<string, Dictionary<string, double>> _weights;

    public PosTagger(PosModel model)
    {
        _classes = model.Classes;
        _tagdict = model.Tagdict;
        _weights = model.Weights;
    }

    private string Predict(Dictionary<string, double> features)
    {
        var scores = new double[_classes.Count];
        foreach (var (feat, val) in features)
        {
            if (!_weights.TryGetValue(feat, out var w)) continue;
            foreach (var (idx, weight) in w)
            {
                var ci = int.Parse(idx, System.Globalization.CultureInfo.InvariantCulture);
                scores[ci] += weight * val;
            }
        }
        var best = 0;
        var bestScore = scores.Length > 0 ? scores[0] : 0;
        for (var k = 1; k < scores.Length; k++)
        {
            // ⚠ Deterministic argmax: a strict `>` breaks ties toward the lexicographically smaller class,
            // matching the trainer's sorted `classes`.
            var s = scores[k];
            if (s > bestScore) { bestScore = s; best = k; }
        }
        return best < _classes.Count ? _classes[best] : "NN";
    }

    /** Tag a whole sentence's words; returns one PTB tag per word. */
    public List<string> Tag(IReadOnlyList<string> words)
    {
        var norm = words.Select(Pos.NormalizeToken).ToList();
        var context = new List<string> { Pos.START, Pos.START };
        context.AddRange(norm);
        context.Add(Pos.END);
        context.Add(Pos.END);
        var tags = new List<string>();
        var prev = Pos.START;
        var prev2 = Pos.START;
        for (var i = 0; i < norm.Count; i++)
        {
            var word = norm[i];
            var tag = _tagdict.TryGetValue(word, out var cached)
                ? (cached < _classes.Count ? _classes[cached] : "NN")
                : Predict(Pos.ExtractFeatures(i, word, context, prev, prev2));
            tags.Add(tag);
            prev2 = prev;
            prev = tag;
        }
        return tags;
    }
}
