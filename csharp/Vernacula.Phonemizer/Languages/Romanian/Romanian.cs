/**
 * Native Romanian (ro) text phonemizer — canonical IPA.
 * Ported from src/languages/romanian/romanian.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Romanian;

public sealed class RomanianPhonemizer : ILanguage
{
    private const string Dir = "languages/romanian";

    /** Load the optional stress lexicon (word → nucleus position from the end). Absent → rules only. */
    private static Dictionary<string, double> LoadStressLex()
    {
        var raw = LoadTsv.LoadTsvMap(Dir, "romanian-stress.tsv", optional: true);
        var m = new Dictionary<string, double>(StringComparer.Ordinal);
        foreach (var (k, v) in raw)
        {
            var n = Js.Number(v);
            if (double.IsInteger(n) && n >= 1) m[k] = n;
        }
        return m;
    }

    private static RomanianDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private const string VOWEL_LETTERS = "aeiouăâî";
    private const string FRONT = "ei"; // c/g soften before these
    private const string VOWEL_PH = "aeiouəɨ";
    private static readonly IReadOnlySet<string> OBSTRUENT = new HashSet<string>(DEF.Obstruents, StringComparer.Ordinal);
    // ⚠ `undefined` IS THE ONLY THING THESE REFUSE. The TS guards `c !== undefined` and then calls
    // `String.includes`, so an EMPTY string would test TRUE — and `.NET Contains("")` is true as well. Both
    // predicates are only ever handed a real code point or the end-of-word `null`, and the port keeps that
    // shape rather than adding a length guard the TS does not have.
    private static bool IsVowelLetter(string? c) => c is not null && VOWEL_LETTERS.Contains(c, StringComparison.Ordinal);
    private static bool IsFront(string? c) => c is not null && FRONT.Contains(c, StringComparison.Ordinal);

    private static readonly IReadOnlySet<string> INITIAL_JE = new HashSet<string>(new[]
    {
        "este", "ești", "e", "el", "ea", "ei", "ele",
        "eram", "erai", "era", "erați", "erau", "esti",
    }, StringComparer.Ordinal);

    /** Scan a lowercased Romanian word into phonemes (contextual c/g, digraphs, diphthongs, glides). */
    private static List<string> Scan(string word)
    {
        var s = Js.CodePoints(word);
        var n = s.Count;
        var outp = new List<string>();
        bool PrevIsVowel() => outp.Count > 0 && VOWEL_PH.Contains(Last1(outp[^1]), StringComparison.Ordinal);
        bool AfterMutaLiquida() =>
            outp.Count >= 2 && "lr".Contains(outp[^1], StringComparison.Ordinal) && OBSTRUENT.Contains(outp[^2]);

        var i = 0;
        while (i < n)
        {
            var c = s[i];
            var nx = i + 1 < n ? s[i + 1] : null;
            var nn = i + 2 < n ? s[i + 2] : null;

            if (c == "c")
            {
                if (nx == "h") { outp.Add("k"); i += 2; continue; } // ch → k (chem→kem, chiar→kjar via i-glide)
                if (IsFront(nx))
                {
                    outp.Add("t͡ʃ");
                    if (nx == "i" && IsVowelLetter(nn)) i += 2; // ⟨ci⟩+V: silent i, leave the vowel (ciorbă)
                    else i += 1; // else the e/i is a pronounced nucleus (ce, ci, cea via ea-rule)
                    continue;
                }
                outp.Add("k"); i += 1; continue;
            }
            if (c == "g")
            {
                if (nx == "h") { outp.Add("ɡ"); i += 2; continue; } // gh → ɡ
                if (IsFront(nx))
                {
                    outp.Add("d͡ʒ");
                    if (nx == "i" && IsVowelLetter(nn)) i += 2; // ⟨gi⟩+V: silent i
                    else i += 1;
                    continue;
                }
                outp.Add("ɡ"); i += 1; continue;
            }
            if (c == "q")
            {
                outp.Add("k");
                if (nx == "u" && IsVowelLetter(nn)) { outp.Add("w"); i += 2; } else i += 1;
                continue;
            }

            if (IsVowelLetter(c))
            {
                if ((c == "e" || c == "o") && nx == "a")
                {
                    outp.Add(c == "e" ? "e̯" : "o̯");
                    i += 1;
                    continue;
                }
                if (c == "i" && nx == "e" && i + 2 == n && !PrevIsVowel())
                {
                    outp.Add("i");
                    i += 1;
                    continue;
                }
                static bool IsHigh(string? x) => x == "i" || x == "u";
                var onglide = IsVowelLetter(nx) && !IsHigh(nx) && !AfterMutaLiquida();
                if (IsHigh(c) && (PrevIsVowel() || onglide))
                {
                    outp.Add(c == "i" ? "j" : "w");
                    i += 1;
                    continue;
                }
                outp.Add(DEF.Vowels.TryGetValue(c, out var v) ? v : c);
                i += 1;
                continue;
            }

            if (c == "x")
            {
                outp.Add(i == 1 && s[0] == "e" && IsVowelLetter(nx) ? "ɡz" : "ks");
                i += 1;
                continue;
            }
            if (DEF.Consonants.TryGetValue(c, out var ph))
            {
                if (ph.Length > 0) outp.Add(ph);
                i += 1;
                continue;
            }
            i += 1; // unknown → skip
        }
        return outp;
    }

    /** JS `p.slice(-1)` — the LAST code unit, which is what the vowel tests compare. */
    private static string Last1(string p) => p.Length == 0 ? "" : p[^1..];

    private static bool IsVowelPh(string? p) => p is not null && VOWEL_PH.Contains(Last1(p), StringComparison.Ordinal);

    /**
     * Final unstressed ⟨i⟩ after a consonant desyllabifies to palatalisation on that consonant (lupi→lupʲ).
     */
    private static List<string> FinalI(List<string> segs)
    {
        if (segs.Count < 2 || segs[^1] != "i") return segs;
        var nuclei = segs.Count(IsVowelPh);
        if (nuclei < 2) return segs; // monosyllable → keep syllabic i
        var prev = segs[^2];
        var beforePrev = segs.Count >= 3 ? segs[^3] : null;
        if ((prev == "r" || prev == "l") && beforePrev is not null && !IsVowelPh(beforePrev)) return segs;
        var outp = segs.GetRange(0, segs.Count - 2);
        outp.Add(prev + "ʲ");
        return outp;
    }

    /** Predict the stressed nucleus, as a position FROM THE END (1 = final nucleus, 2 = penult, …). */
    private static double StressFromEnd(string word, int nucleiCount)
    {
        if (nucleiCount <= 1) return 1;
        var chars = Js.CodePoints(word);
        // ⚠ `word[word.length - 1] ?? ""` AND `VOWEL_LETTERS.includes("")` IS TRUE — in JS and in .NET alike.
        // An empty word therefore takes the VOWEL arm, not the consonant one. Unreachable (a word with two
        // nuclei is not empty), and the port keeps the JS shape rather than guarding a case the TS does not.
        var last = chars.Count > 0 ? chars[^1] : "";
        if (!VOWEL_LETTERS.Contains(last, StringComparison.Ordinal)) return last == "c" ? 2 : 1;
        if (last == "i")
            return VOWEL_LETTERS.Contains(chars.Count > 1 ? chars[^2] : "", StringComparison.Ordinal) ? 2 : 1;
        return last == "a" ? 1 : 2;
    }

    /** Word → stressed-nucleus position from the END (1=final, 2=penult…), for the rule-miss tail. */
    private static Dictionary<string, double>? STRESS_LEX;
    private static readonly object GATE = new();
    private static Dictionary<string, double> StressLex()
    {
        lock (GATE) return STRESS_LEX ??= LoadStressLex();
    }

    private static string PhonemizeCore(string word, bool useLex)
    {
        var lw = word.ToLowerInvariant();
        var segs = FinalI(Scan(lw));
        if (segs.Count == 0) return "";
        if (INITIAL_JE.Contains(lw)) segs.Insert(0, "j"); // copula/pronoun word-initial e → je (onset of syllable 1)
        var nuclei = new List<int>();
        for (var i = 0; i < segs.Count; i++)
            if (VOWEL_PH.Contains(segs[i], StringComparison.Ordinal) && segs[i].Length == 1) nuclei.Add(i);
        var outp = "";
        if (nuclei.Count > 0)
        {
            var fromEnd = (useLex && StressLex().TryGetValue(lw, out var lex) ? lex : (double?)null)
                ?? StressFromEnd(lw, nuclei.Count);
            var idx = nuclei[(int)Math.Max(0, nuclei.Count - fromEnd)];
            static bool IsNucleus(string? p) => p is not null && p.Length == 1 && VOWEL_PH.Contains(p, StringComparison.Ordinal);
            var onset = idx;
            while (onset > 0 && !IsNucleus(segs[onset - 1])) onset--;
            for (var i = 0; i < segs.Count; i++)
            {
                if (i == onset) outp += "ˈ";
                outp += segs[i];
            }
        }
        else outp = string.Concat(segs);
        return outp.Normalize(NormalizationForm.FormC);
    }

    /** One Romanian word → canonical IPA (with primary stress ˈ); the shipped path, rule plus lexicon. */
    public static string PhonemizeWord(string word) => PhonemizeCore(word, true);

    /** Rule-only path (no stress lexicon). Segments are identical; only the stress mark can differ. */
    public static string PhonemizeWordRules(string word) => PhonemizeCore(word, false);

    private static RomanianNumbersDef NUM => DEF.Numbers;
    private static GenderedDef G => NUM.Gendered;

    /** The GENDER a multiplier has to agree with. */
    private const string F = "f", N = "n", M = "m";

    /** One numeral WORD, in the form the following magnitude noun requires. 2 and 12 feminise for a feminine
     *  or a neuter-plural noun; 1 only for a feminine one. */
    private static string Gendered(string word, string g)
    {
        if (g == M) return word;
        if (word == NUM.Units[2]) return G.TwoFeminine;
        if (word == NUM.Teens[2]) return G.TwelveFeminine;
        if (word == NUM.Units[1] && g == F) return G.OneFeminineFinal;
        return word;
    }

    /** `de` links a numeral to the noun it modifies once the count reaches 20. ⚠ It keys off the final two
     *  digits, so a round hundred/thousand count takes it too (o sută de mii). */
    private static bool NeedsDe(double count) => count % 100 == 0 || count % 100 >= 20;

    /** Romanian words for 0 ≤ n < 100, with the trailing unit agreeing with `g`. */
    private static string Under100(double n, string g)
    {
        if (n < 10) return Gendered(NUM.Units[(int)n], g);
        if (n < 20) return Gendered(NUM.Teens[(int)n - 10], g);
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0 ? NUM.Tens[(int)t] : $"{NUM.Tens[(int)t]} {NUM.And} {Gendered(NUM.Units[(int)u], g)}";
    }

    /** Romanian words for 0 ≤ n < 1000. The HUNDREDS multiplier always agrees with sută/sute, which are feminine
     *  regardless of what follows (o sută, două sute); `g` governs only the trailing sub-hundred remainder.
     *  `stem` drops the feminine article on a bare hundred, for the ordinal (al sutălea, not *al o sutălea). */
    private static string Under1000(double n, string g, bool stem = false)
    {
        if (n < 100) return Under100(n, g);
        double h = Math.Floor(n / 100), rest = n % 100;
        var head =
            h == 1
                ? stem ? NUM.Hundred : $"{G.OneFeminine} {NUM.Hundred}"
                : $"{Gendered(NUM.Units[(int)h], F)} {NUM.Hundreds}";
        return rest == 0 ? head : $"{head} {Under100(rest, g)}";
    }

    /** A magnitude group: the agreeing multiplier + `de` where required + the magnitude noun. */
    private static string MagnitudeGroup(double count, string g, string sg, string pl, bool stem)
    {
        if (count == 1) return stem ? sg : $"{(g == F ? G.OneFeminine : G.OneMasculine)} {sg}";
        var head = Under1000(count, g, stem);
        return NeedsDe(count) && !stem ? $"{head} {NUM.Of} {pl}" : $"{head} {pl}";
    }

    /**
     * Romanian cardinal for a non-negative integer (up to the millions), with the magnitude nouns and their
     * multipliers in agreement (două mii, o sută de mii, un milion, două milioane).
     */
    public static string NumberWords(double n, bool stem = false)
    {
        if (n == 0) return NUM.Units[0];
        if (n >= 1e12)
            return string.Join(" ", Js.CodePoints(Js.NumberToString(n)).Select(d => (Core.Numbers.DigitWord(NUM.Units, d) ?? d)));
        var parts = new List<string>();
        double bil = Math.Floor(n / 1_000_000_000),
            mil = Math.Floor(n % 1_000_000_000 / 1_000_000),
            th = Math.Floor(n % 1_000_000 / 1000),
            rest = n % 1000;
        if (bil > 0) parts.Add(MagnitudeGroup(bil, N, NUM.Billion, NUM.Billions, stem));
        if (mil > 0) parts.Add(MagnitudeGroup(mil, N, NUM.Million, NUM.Millions, stem));
        if (th > 0) parts.Add(MagnitudeGroup(th, F, NUM.Thousand, NUM.Thousands, stem));
        if (rest > 0) parts.Add(Under1000(rest, M, stem));
        return string.Join(" ", parts);
    }

    /**
     * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim,
     * so nothing about the orthography is invented here.
     */
    private const string NATIVE_CLASS = "[a-zA-ZăâîșțA-ZĂÂÎȘȚ]";
    /** NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. */
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    // ⚠ ALL OF LATIN, not just this language's own letters — a class narrowed to NATIVE_CLASS ends the token
    // at an out-of-inventory diacritic, and the rest of the word starts over as a separate token.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.?!,;:])", "gu");

    public string Text(string rawInput)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeRomanian(rawInput), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                // ⚠ ABOVE 2^53 the double has already lost the low digits, so a composed numeral would be
                // confidently wrong; the reading falls through to digit-at-a-time instead.
                var num = Js.Number(m.Groups[2].Value);
                if (double.IsInteger(num) && Math.Abs(num) <= 9007199254740991d)
                {
                    foreach (var w in NumberWords(num).Split(' ')) sink.Emit(PhonemizeWord(w));
                }
                else
                {
                    foreach (var d in m.Groups[2].Value)
                        foreach (var w in NumberWords(Js.Number(d.ToString())).Split(' ')) sink.Emit(PhonemizeWord(w));
                }
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Romanian phonemizer. */
    public static ILanguage CreateRomanian() => new RomanianPhonemizer();

    internal static void RegisterSelf()
    {
        Registry.Register("romanian", CreateRomanian);
        Registry.RegisterRomanPolicy("ro", RomanOrdinals.ROMAN_POLICY);
    }
}
