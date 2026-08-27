/**
 * Serbian (sr, српски) phonemizer — South Slavic, DUAL SCRIPT (Cyrillic + Gaj's Latin), fully phonemic. A
 * digraph-aware left-to-right scan plus the lexical pitch accent from stress.tsv, with accent-transitions.tsv
 * as the OOV tier. Croatian and Bosnian reuse `PhonemizeWord` and `ForeignLetters` from here.
 * Ported from src/languages/serbian/serbian.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Serbian;

/** word → the stressed nucleus ordinal + its contour. `--` is a REAL value: the position is known but the
 *  spelling has two recorded contours, so the lexicon withholds the tone on purpose. */
public sealed class Accent
{
    public double At { get; init; }
    public string Tone { get; init; } = "";
}

internal sealed class Transition
{
    public double Shift { get; init; }
    public string Tone { get; init; } = "";
    public double Agree { get; init; }
    public double Support { get; init; }
}

public sealed class SerbianPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> DIGRAPHS => Manifest.MANIFEST.Digraphs;
    private static IReadOnlyDictionary<string, string> LETTERS => Manifest.MANIFEST.Letters;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private static Dictionary<string, Accent>? STRESS;
    private static readonly object StressGate = new();

    private static Dictionary<string, Accent> StressDict()
    {
        lock (StressGate)
        {
            return STRESS ??= LoadTsv.LoadTsvMap<Accent>("languages/serbian", "stress.tsv", (v, _) =>
            {
                var f = v.Split('\t');
                var t = f.Length > 1 ? f[1] : null;
                var at = Js.Number(f[0]);
                return double.IsInteger(at) && (t == "SR" || t == "LR" || t == "SF" || t == "LF" || t == "--")
                    ? new Accent { At = at, Tone = t! }
                    : null;
            }, optional: true);
        }
    }

    private static Dictionary<string, Transition>? TRANS;
    private static readonly object TransGate = new();

    private static Dictionary<string, Transition> Transitions()
    {
        lock (TransGate)
        {
            return TRANS ??= LoadTsv.LoadTsvMap<Transition>("languages/serbian", "accent-transitions.tsv", (v, _) =>
            {
                var f = v.Split('\t');
                var shift = Js.Number(f[0]);
                return double.IsInteger(shift) && f.Length > 1
                    ? new Transition
                    {
                        Shift = shift,
                        Tone = f[1],
                        Agree = Js.Number(f.Length > 2 ? f[2] : ""),
                        Support = Js.Number(f.Length > 3 ? f[3] : ""),
                    }
                    : null;
            }, optional: true);
        }
    }

    private const int TONE_AGREEMENT = 90;
    private const int MIN_SUPPORT = 5;
    private const int MAX_CUT = 3;

    /** Derive an OOV word's accent from the longest stem that IS in the lexicon, plus the ending's transition. */
    private static Accent? DeriveAccent(string w)
    {
        var lex = StressDict();
        for (var c = 1; c <= MAX_CUT; c++)
        {
            if (w.Length - c < 3) break;
            if (!lex.TryGetValue(w[..^c], out var stem)) continue;
            if (!Transitions().TryGetValue($"{w[(w.Length - c)..]}|{stem.Tone}", out var tr)) return null;
            var tone = stem.Tone == "--" || tr.Agree < TONE_AGREEMENT || tr.Support < MIN_SUPPORT ? "--" : tr.Tone;
            return new Accent { At = Math.Max(0, stem.At + tr.Shift), Tone = tone };
        }
        return null;
    }

    /** Whether the lexicon knows this word's accent — absence is ambiguous in the OUTPUT, so an eval needs
     *  to be able to ask. */
    public static bool AccentLexiconHas(string word) => StressDict().ContainsKey(Js.ToLowerCase(word));

    private static readonly IReadOnlyDictionary<string, string> TONE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["SR"] = "˩˥", ["LR"] = "˩˥", ["SF"] = "˥˩", ["LF"] = "˥˩", ["--"] = "",
    };
    private static readonly IReadOnlySet<string> LONG = new HashSet<string>(new[] { "LR", "LF" }, StringComparer.Ordinal);

    private static readonly IReadOnlySet<string> CLITIC = new HashSet<string>(new[]
    {
        "sam", "si", "je", "smo", "ste", "su", "ću", "ćeš", "će", "ćemo", "ćete", "bih", "bi", "bismo", "biste",
        "me", "te", "ga", "mu", "joj", "ih", "im", "se", "li", "ne",
        "i", "a", "ni", "da", "u", "na", "o", "po", "za", "od", "do", "iz", "s", "sa", "k", "ka", "uz", "niz",
        "сам", "си", "је", "смо", "сте", "су", "ћу", "ћеш", "ће", "ћемо", "ћете", "бих", "би", "бисмо", "бисте",
        "ме", "те", "га", "му", "јој", "их", "им", "се", "ли", "не",
        "и", "а", "ни", "да", "у", "на", "о", "по", "за", "од", "до", "из", "с", "са", "к", "ка", "уз", "низ",
    }, StringComparer.Ordinal);

    /** Derived from the manifest rather than restated: a vowel letter is one whose IPA value is a vowel. */
    internal static readonly IReadOnlySet<string> VOWEL_LETTER =
        new HashSet<string>(LETTERS.Where(kv => "aeiou".Contains(kv.Value, StringComparison.Ordinal)).Select(kv => kv.Key),
            StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> RHOTIC_LETTER =
        new HashSet<string>(new[] { "r", "р" }, StringComparer.Ordinal);

    private static bool IsNucleus(string w, int i)
    {
        var c = w[i].ToString();
        if (VOWEL_LETTER.Contains(c)) return true;
        if (!RHOTIC_LETTER.Contains(c)) return false;
        return !VOWEL_LETTER.Contains(i > 0 ? w[i - 1].ToString() : "")
            && !VOWEL_LETTER.Contains(i + 1 < w.Length ? w[i + 1].ToString() : "");
    }

    /** Phonemize a single Serbo-Croatian word (either script) to canonical IPA, with primary stress and its
     *  contour. ⚠ hr and bs call THIS — it must stay byte-identical for all three. */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word);
        var isLetterRun = word.Length >= 2 && !Js.CodePoints(word).Any(ch => VOWEL_LETTER.Contains(Js.ToLowerCase(ch)));
        var outp = new System.Text.StringBuilder();
        var prevLetter = ""; // the last single letter this scan emitted; a digraph resets it
        var nuclei = new List<(int Start, int End)>();
        for (var i = 0; i < w.Length;)
        {
            var two = i + 2 <= w.Length ? w[i..(i + 2)] : w[i..];
            if (DIGRAPHS.TryGetValue(two, out var dg) && dg.Length > 0)
            {
                outp.Append(dg);
                prevLetter = "";
                i += 2;
                continue;
            }
            var c = w[i].ToString();
            // ⚠ `!== undefined`, NOT truthiness — the digraph test above IS truthy in the TS and this one is not.
            var known = LETTERS.TryGetValue(c, out var ipa);
            if (!isLetterRun && c == prevLetter && !VOWEL_LETTER.Contains(c) && known)
            {
                i++;
                continue;
            }
            if (known)
            {
                var start = outp.Length;
                outp.Append(ipa!);
                prevLetter = c;
                if (IsNucleus(w, i)) nuclei.Add((start, outp.Length));
            }
            else
            {
                // ⚠ AN UNKNOWN CHARACTER BREAKS THE ADJACENCY, or the letters either side of a hyphen look
                // doubled and the second is deleted.
                prevLetter = "";
            }
            i++;
        }
        var res = outp.ToString();
        if (nuclei.Count == 0) return res;
        if (CLITIC.Contains(w)) return res;
        var acc = StressDict().TryGetValue(w, out var lex) ? lex : DeriveAccent(w);
        var k = (int)Math.Min(acc?.At ?? 0, nuclei.Count - 1);
        var n = nuclei[k];
        var mark = nuclei.Count > 1 ? "ˈ" : ""; // a monosyllable takes no ˈ — but it DOES take its tone
        var tail = acc is null ? "" : (LONG.Contains(acc.Tone) ? "ː" : "") + TONE[acc.Tone];
        if (mark.Length == 0 && tail.Length == 0) return res;
        return res[..n.Start] + mark + res[n.Start..n.End] + tail + res[n.End..];
    }

    // A word (Serbian Cyrillic + Latin incl. diacritics) / number / punctuation token.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.HostWordRun(new[] { "Latin" }, "а-шђјљњћџ")})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token this rejects carries a letter the language does not use.
     *  ⚠ `й` is excluded deliberately; see the TS. */
    private const string NATIVE_CLASS = "[а-ик-шђјљњћџa-zčćšžđ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeSerbian(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(ForeignLetters(m.Groups[1].Value))));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Serbian phonemizer. */
    public static ILanguage CreateSerbian() => new SerbianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("serbian", CreateSerbian);

    // ⚠ `xx` IS ONE CLUSTER — expanding each ⟨x⟩ independently gives `Exxon` → *ekskson*.
    private static readonly JsRe FOREIGN_LETTER = JsRegex.Compile("qu|xx|th|[qwxy]", "giu");
    private static readonly JsRe NATIVE_TH_PREFIX = JsRegex.Compile("^(?:pret|pot|ot|nat)$", "iu");
    private static readonly JsRe VOWEL_BEFORE_Y = JsRegex.Compile("[aeiouAEIOU]", "u");

    /** ⟨q w x y th⟩ — the letters Gaj's Latin does not have, spelled to their adapted readings. A SPELLING
     *  fold, applied per word before the nativiser by hr, bs and sr alike. */
    public static string ForeignLetters(string w)
    {
        var subject = w;
        return FOREIGN_LETTER.Replace(w, m =>
        {
            var lower = Js.ToLowerCase(m.Value);
            var at = m.Index;
            if (lower == "qu") return "kv";
            if (lower == "q") return "k";
            if (lower == "w") return "v";
            if (lower == "x" || lower == "xx") return "ks";
            if (lower == "th") return NATIVE_TH_PREFIX.IsMatch(subject[..(at + 1)]) ? m.Value : "t";
            return VOWEL_BEFORE_Y.IsMatch(at > 0 ? subject[at - 1].ToString() : "") ? "j" : "i";
        });
    }
}
