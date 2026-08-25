/**
 * Native Javanese / Basa Jawa (jv) text phonemizer — canonical IPA.
 * Ported from src/languages/javanese/javanese.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Javanese;

public sealed class JavaneseMagnitudes
{
    public string[] Thousand { get; init; } = [];
    public string[] Million { get; init; } = [];
    public string[] Billion { get; init; } = [];
}

public sealed class JavaneseNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public string[] Likur { get; init; } = [];
    public string[] Mult { get; init; } = [];
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public JavaneseMagnitudes Magnitudes { get; init; } = new();
    public string HundredOne { get; init; } = "";
    public string Hundred { get; init; } = "";
}

public sealed class JavaneseDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public JavaneseNumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public JavanesePhonotactics Phonotactics { get; init; } = new();
}

public sealed class JavanesePhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

/** A phoneme segment: `V` is the SOURCE vowel letter for a nucleus, "" for a consonant. */
public sealed class Seg
{
    public required string Ph { get; set; }
    public required string V { get; init; }
}

public static class JavanesePhonemizer
{
    public static readonly JavaneseDef DEF = LoadManifest.Load<JavaneseDef>("languages/javanese", "javanese.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static JavaneseNumbersDef NUM => DEF.Numbers;

    private const string VOWEL_LETTERS = "aiueoéèê";
    private static readonly IReadOnlyDictionary<string, string> LAX = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["i"] = "ɪ", ["u"] = "ʊ", ["o"] = "ɔ", // closed-syllable laxing (keyed by SOURCE letter)
    };

    private static readonly JsRe AKSARA_WORD = JsRegex.Compile("[\\u{A980}-\\u{A9CF}]", "u");

    /** Scan a lowercased Javanese word into segments (digraphs first, then single letters). */
    private static List<Seg> Scan(string w)
    {
        var s = Js.CodePoints(w);
        var segs = new List<Seg>();
        for (var i = 0; i < s.Count;)
        {
            var dg = (i < s.Count ? s[i] : "") + (i + 1 < s.Count ? s[i + 1] : "");
            if (DEF.Digraphs.TryGetValue(dg, out var dgPh) && dgPh != "")
            {
                segs.Add(new Seg { Ph = dgPh, V = "" });
                i += 2;
                continue;
            }
            var c = s[i];
            if (VOWEL_LETTERS.Contains(c, StringComparison.Ordinal))
                segs.Add(new Seg { Ph = DEF.Vowels.GetValueOrDefault(c) ?? c, V = c });
            else if (DEF.Consonants.TryGetValue(c, out var consPh))
                segs.Add(new Seg { Ph = consPh, V = "" });
            i++;
        }
        return segs;
    }

    private static bool IsVowelSeg(Seg sg) => sg.V != "";

    /**
     * Consonants between segment i (exclusive) and the next vowel — the coda+onset run. Returns [count,
     * nextVowelIdx].
     */
    private static (int Count, int Next) ConsonantsAfter(IReadOnlyList<Seg> segs, int i)
    {
        var j = i + 1;
        while (j < segs.Count && !IsVowelSeg(segs[j])) j++;
        return (j - i - 1, j);
    }

    /** Apply the shared Javanese phonology to a segment list (from EITHER the Latin scan or the Aksara Jawa scan):
     *  final-⟨k⟩→ʔ, closed-syllable laxing, the a→ɔ harmony, penult stress. Returns canonical IPA. */
    public static string ApplyPhonology(List<Seg> segs)
    {
        if (segs.Count == 0) return "";

        var last = segs[^1];
        if (last.Ph == "k") last.Ph = "ʔ";

        for (var i = 0; i < segs.Count - 1; i++)
            if (segs[i].Ph == "n" && (segs[i + 1].Ph == "t͡ʃ" || segs[i + 1].Ph == "d͡ʒ"))
                segs[i].Ph = "ɲ";

        for (var i = 0; i < segs.Count; i++)
        {
            var sg = segs[i];
            if (!LAX.TryGetValue(sg.V, out var lax)) continue;
            var (cons, next) = ConsonantsAfter(segs, i);
            var closed = next >= segs.Count ? cons >= 1 : cons >= 2;
            if (closed) sg.Ph = lax;
        }

        var vowelIdx = segs.Select((sg, i) => IsVowelSeg(sg) ? i : -1).Where(i => i >= 0).ToList();
        if (vowelIdx.Count > 0 &&
            segs[vowelIdx[^1]].V == "a" &&
            vowelIdx[^1] == segs.Count - 1) // final syllable open
        {
            var lastV = vowelIdx[^1];
            segs[lastV].Ph = "ɔ";
            if (vowelIdx.Count >= 2)
            {
                var penult = vowelIdx[^2];
                if (segs[penult].V == "a" && lastV - penult == 2) segs[penult].Ph = "ɔ";
            }
        }

        var stress = vowelIdx.Count >= 2 ? vowelIdx[^2] : (vowelIdx.Count > 0 ? vowelIdx[0] : -1);
        var outp = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) outp += "ˈ";
            outp += segs[i].Ph;
        }
        return outp.Normalize(System.Text.NormalizationForm.FormC);
    }

    /**
     * One Javanese word → canonical IPA, RULE-ENGINE ONLY (no cross-script lexicon). Routes by script: Aksara
     * Jawa → the abugida scanner, else the Latin g2p — both feed the shared phonology.
     */
    public static string PhonemizeWordRules(string word) =>
        ApplyPhonology(AKSARA_WORD.IsMatch(word) ? Aksara.ScanAksara(word) : Scan(word.ToLowerInvariant()));

    private static Dictionary<string, string>? LEXICON;
    private static readonly object GATE = new();
    private static Dictionary<string, string> Lexicon()
    {
        lock (GATE) return LEXICON ??= LoadTsv.LoadTsvMap("languages/javanese", "javanese-lexicon.tsv", optional: true);
    }

    /**
     * SHIPPED Javanese word → canonical IPA. For Latin input a cross-script ⟨e⟩ lexicon override applies (pepet
     * vs taling, unrecoverable from Latin); Aksara input and everything else fall through to the rule engine.
     */
    public static string PhonemizeWord(string word)
    {
        if (!AKSARA_WORD.IsMatch(word) && Lexicon().TryGetValue(word.ToLowerInvariant(), out var hit)) return hit;
        return PhonemizeWordRules(word);
    }

    /** n in [1,99] → ngoko spelling. */
    private static string BelowHundred(double n)
    {
        if (n < 10) return NUM.Units[(int)n];
        if (n < 20) return NUM.Teens[(int)n - 10];
        if (n >= 21 && n <= 29) return NUM.Likur[(int)n - 20];
        double t = Math.Floor(n / 10), u = n % 10;
        return u > 0
            ? $"{NUM.Tens[Js.NumberToString(t)]} {NUM.Units[(int)u]}"
            : NUM.Tens[Js.NumberToString(t)];
    }

    /** n in [1,999] → spelling (1→satus; 2–9→[mult] atus). */
    private static string BelowThousand(double n)
    {
        double h = Math.Floor(n / 100), r = n % 100;
        if (h == 0) return BelowHundred(n);
        var hw = h == 1 ? NUM.HundredOne : $"{NUM.Mult[(int)h]} {NUM.Hundred}";
        return r > 0 ? $"{hw} {BelowHundred(r)}" : hw;
    }

    /**
     * `[count] <magnitude>`: 1 fuses to the suppletive word, 2–9 use the combining multiplier, ≥10 a full
     * count.
     */
    private static string Magnitude(double count, string[] pair)
    {
        var fused = pair[0];
        var word = pair[1];
        if (count == 1) return fused;
        if (count <= 9) return $"{NUM.Mult[(int)count]} {word}";
        return $"{BelowThousand(count)} {word}";
    }

    /** Non-negative integer → standard Javanese ngoko numeral spelling. */
    private static string NumberToText(double n)
    {
        if (n == 0) return NUM.Units[0];
        var parts = new List<string>();
        if (n >= 1_000_000_000)
        {
            parts.Add(Magnitude(Math.Floor(n / 1_000_000_000), NUM.Magnitudes.Billion));
            n %= 1_000_000_000;
        }
        if (n >= 1_000_000)
        {
            parts.Add(Magnitude(Math.Floor(n / 1_000_000), NUM.Magnitudes.Million));
            n %= 1_000_000;
        }
        if (n >= 1_000)
        {
            parts.Add(Magnitude(Math.Floor(n / 1_000), NUM.Magnitudes.Thousand));
            n %= 1_000;
        }
        if (n > 0) parts.Add(BelowThousand(n));
        return string.Join(" ", parts);
    }

    private static readonly string LATIN_RUN = HostWord.HostWordRun(new[] { "Latin" });
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({LATIN_RUN})|([\\u{{A980}}-\\u{{A9C0}}]+)|([\\u{{A9D0}}-\\u{{A9D9}}]+)|(\\d+)|([\\u{{A9C1}}-\\u{{A9CE}}\\u{{A9DE}}\\u{{A9DF}}])|([.?!,;:])",
        "gu");

    /** This language's OWN inventory. */
    private const string NATIVE_CLASS = "[a-zA-ZéèêÉÈÊ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    /**
     * Speak an integer: emit each ngoko numeral word separately (so word-final laxing / a→ɔ apply per word).
     */
    private static void EmitNumber(double n, ClauseSink sink, string? digits = null)
    {
        // `n` is a JS `number` here as in the TS: past 2^53 the low digits are already gone, so composing a
        // numeral would be confidently wrong. Fall back to digit-at-a-time, reading `digits` — the ORIGINAL
        // spelling — when the caller has it, or the tail reads as zeros.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
        {
            foreach (var d in Js.CodePoints(digits ?? Js.NumberToString(n)))
            {
                if (string.CompareOrdinal(d, "0") < 0 || string.CompareOrdinal(d, "9") > 0) continue;
                foreach (var wd in NumberToText(Js.Number(d)).Split(' ')) sink.Emit(PhonemizeWordRules(wd));
            }
            return;
        }
        // Number words deliberately bypass the content lexicon (PhonemizeWordRules, not PhonemizeWord): the
        // ngoko spellings collide with taling homographs.
        foreach (var wd in NumberToText(n).Split(' '))
            sink.Emit(PhonemizeWordRules(wd));
    }

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            input = Normalize.NormalizeJavanese(input);
            return Clauses.AssembleClauses(input, TOKEN, (m, sink) =>
            {
                // Only the LATIN group is nativised. Group 2 is the Aksara Jawa run — this language's own
                // script, where there is no inventory question to ask.
                if ((m.Groups[1].Success && m.Groups[1].Value.Length > 0) || (m.Groups[2].Success && m.Groups[2].Value.Length > 0))
                    sink.Emit(PhonemizeWord(m.Groups[1].Success ? Nat(m.Groups[1].Value) : m.Groups[2].Value));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    // The ASCII transliteration is handed over as well as converted, so an above-2^53 run
                    // degrades to ITS OWN digits and not to the double's rounded ones.
                    var ascii = string.Concat(Js.CodePoints(m.Groups[3].Value).Select(Aksara.AksaraDigit));
                    EmitNumber(Js.Number(ascii), sink, ascii);
                }
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0) EmitNumber(Js.Number(m.Groups[4].Value), sink, m.Groups[4].Value);
                else if (m.Groups[5].Success && m.Groups[5].Value.Length > 0)
                {
                    var mk = Aksara.AksaraPada(m.Groups[5].Value);
                    if (mk is not null) sink.Pause(mk);
                }
                else if (m.Groups[6].Success && m.Groups[6].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[6].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Javanese phonemizer (no data files beyond the manifest — the engine is rule-based). */
    public static ILanguage CreateJavanese() => new Engine();

    internal static void RegisterSelf() => Registry.Register("javanese", CreateJavanese);
}
