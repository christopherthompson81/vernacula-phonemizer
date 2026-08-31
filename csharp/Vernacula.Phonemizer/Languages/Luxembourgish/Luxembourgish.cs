/**
 * Luxembourgish (lb) phonemizer — Lëtzebuergesch, West Germanic (Moselle Franconian), Latin script,
 * canonical IPA. A greedy longest-match grapheme scan (the diphthongs + digraphs, length-desc) plus
 * German-style code rules the table can't express: the diphthongs ⟨ei ai⟩→ai̯, ⟨au⟩→æu̯, ⟨ou⟩→əu̯,
 * ⟨w⟩→v, ⟨v⟩→f, ⟨z⟩→t͡s, ⟨ch⟩→χ, initial ⟨st sp⟩→ʃt/ʃp, single ⟨s⟩→z as an onset, short ⟨e⟩→[æ]
 * stressed / [ə] reduced, geminate collapse, final + regressive devoicing, final ⟨g⟩→[χ]/[k],
 * ⟨n⟩→[ŋ] before a velar, intervocalic g-spirantization. PRIMARY STRESS is emitted — the first
 * nucleus, or the second past an unstressed ⟨ge/be/ver/er/ze⟩ prefix; vowel length is folded/deferred.
 * Ported from src/languages/luxembourgish/luxembourgish.ts — see that file for the corpus evidence
 * and the measured stress-placement accuracy.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Luxembourgish;

public static class LuxembourgishPhonemizer
{
    private static LuxDef DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> DIGRAPHS => DEF.Digraphs;
    private static IReadOnlyDictionary<string, string> G => DEF.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    /** One scan token: the IPA phones for a grapheme + flags marking a single ⟨s⟩ (may voice to [z])
     *  or a single ⟨e⟩ (realized [æ] when stressed, [ə] when not), plus the STRESSED nucleus itself. */
    private sealed class Tok
    {
        public string Ph = "";
        public bool SVar;
        public bool EVar;
        public bool Stress;
    }

    private static List<string> CoreChars(string ph) =>
        Js.CodePoints(Js.Normalize(ph, NormalizationForm.FormD))
            .Where(c =>
            {
                var x = Js.CodePointAt0(c);
                return !(x >= 0x300 && x <= 0x36f) && x != 0x2d0;
            })
            .ToList();

    private static bool StartsWithVowel(string ph)
    {
        var a = CoreChars(ph);
        return a.Count > 0 && Ipa.IPA_VOWEL.Contains(a[0]);
    }

    private static bool EndsWithVowel(string ph)
    {
        var a = CoreChars(ph);
        return a.Count > 0 && Ipa.IPA_VOWEL.Contains(a[^1]);
    }

    /** Scan a lowercased Luxembourgish word into phone tokens (longest-match digraphs, then single
     *  graphemes). */
    private static List<Tok> Scan(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var toks = new List<Tok>();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in Manifest.ORDER)
            {
                // JS `w.startsWith(key, i)` is a UTF-16 code-unit comparison, which ordinal is.
                if (i + key.Length > w.Length || string.CompareOrdinal(w, i, key, 0, key.Length) != 0) continue;
                toks.Add(new Tok { Ph = DIGRAPHS[key] });
                i += key.Length;
                matched = true;
                break;
            }
            if (matched) continue;
            var c = w[i].ToString();
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            // Consulted AFTER every digraph and single-letter rule, so it cannot override this language.
            var ph = G.TryGetValue(c, out var g) ? g : LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
            if (ph is not null) toks.Add(new Tok { Ph = ph, SVar = c == "s", EVar = c == "e" });
            i += 1;
        }
        return toks;
    }

    // Unstressed one-syllable prefixes: the stress falls on the FOLLOWING syllable. A heuristic — it
    // can't tell a real prefix from a root that happens to start the same way (Becher, Bensin, Zebra),
    // so those get their stress mislocated. ⚠ ⟨ver⟩ IS EXEMPT FROM THE CONSONANT GUARD, and that is
    // measured too: ⟨ver⟩ before a vowel is the prefix essentially always, and the other five prefixes
    // keep the guard, where the collision is real and constant.
    private static readonly JsRe UNSTRESSED_PREFIX =
        JsRegex.Compile("^(ge|be|er|zer|ze)[^aeiouyäëéô]|^ver", "u");

    /**
     * PLACE THE STRESS, and realize short ⟨e⟩ off it. These are ONE decision, which is why they are one
     * function: ⟨e⟩ is [æ] in the STRESSED syllable and reduces to schwa [ə] elsewhere.
     *
     * ⚠ THE MARK RIDES THE TOKEN, not an index: Degeminate splices tokens out downstream and would shift
     * any index saved here. It only ever removes a non-vowel duplicate, so the stressed nucleus survives.
     */
    private static void RealizeE(string word, List<Tok> toks)
    {
        var vowelIdx = new List<int>();
        for (var i = 0; i < toks.Count; i++)
            if (StartsWithVowel(toks[i].Ph)) vowelIdx.Add(i);
        var stressOrdinal = UNSTRESSED_PREFIX.IsMatch(Js.ToLowerCase(word)) && vowelIdx.Count > 1 ? 1 : 0;
        var stressTok = vowelIdx.Count > 0 ? vowelIdx[stressOrdinal] : -1;
        for (var i = 0; i < toks.Count; i++)
            if (toks[i].EVar) toks[i].Ph = i == stressTok ? "æ" : "ə";
        if (stressTok >= 0) toks[stressTok].Stress = true;
    }

    /** ⟨s⟩ → [z] as a voiced ONSET: word-initial before a vowel, or intervocalic. ⟨ss⟩ (already [s]
     *  from the digraph) and coda ⟨s⟩ stay [s]. */
    private static void VoiceS(List<Tok> toks)
    {
        for (var i = 0; i < toks.Count; i++)
        {
            var t = toks[i];
            if (!t.SVar) continue;
            var nextVowel = i + 1 < toks.Count && StartsWithVowel(toks[i + 1].Ph);
            var prevVowel = i > 0 && EndsWithVowel(toks[i - 1].Ph);
            if (nextVowel && (i == 0 || prevVowel)) t.Ph = "z";
        }
    }

    /** Initial ⟨st sp⟩ → [ʃt ʃp] (the German rule): a word-initial [s] before [t]/[p] becomes [ʃ]. */
    private static void InitialSCluster(List<Tok> toks)
    {
        if (toks.Count >= 2 && toks[0].Ph == "s" && (toks[1].Ph is "t" or "p")) toks[0].Ph = "ʃ";
    }

    /** Geminate collapse: a doubled consonant letter surfaces as a single phone — no phonemic length
     *  contrast in the coda. */
    private static void Degeminate(List<Tok> toks)
    {
        for (var i = toks.Count - 1; i > 0; i--)
        {
            var p = toks[i].Ph;
            if (p == toks[i - 1].Ph && !StartsWithVowel(p)) toks.RemoveAt(i);
        }
    }

    /** ⟨n⟩ → [ŋ] before a velar [k]/[ɡ] (and the ⟨-ng⟩ that scans as n+ɡ). */
    private static void VelarNasal(List<Tok> toks)
    {
        for (var i = 0; i < toks.Count - 1; i++)
            if (toks[i].Ph == "n" && (toks[i + 1].Ph is "k" or "ɡ")) toks[i].Ph = "ŋ";
    }

    /** INTERVOCALIC g-spirantization: a single ⟨g⟩ [ɡ] between two vowels → the voiced uvular
     *  fricative [ʁ]. */
    private static void SpirantizeG(List<Tok> toks)
    {
        for (var i = 1; i < toks.Count - 1; i++)
            if (toks[i].Ph == "ɡ" && EndsWithVowel(toks[i - 1].Ph) && StartsWithVowel(toks[i + 1].Ph)) toks[i].Ph = "ʁ";
    }

    // obstruent → its voiceless pair
    private static readonly Dictionary<string, string> DEVOICE = new(StringComparer.Ordinal)
    {
        ["b"] = "p", ["d"] = "t", ["ɡ"] = "k", ["z"] = "s", ["v"] = "f",
    };

    /** DEVOICING: word-final + regressive before a voiceless obstruent. Word-final ⟨g⟩ is special:
     *  [χ] after a vowel but [k] after a consonant. */
    private static void ApplyDevoicing(List<Tok> toks)
    {
        var last = toks.Count - 1;
        for (var i = 0; i <= last; i++)
        {
            var t = toks[i];
            if (!DEVOICE.ContainsKey(t.Ph)) continue;
            var wordFinal = i == last;
            var beforeVoiceless = i < last && Manifest.VOICELESS_OBSTR.Contains(toks[i + 1].Ph);
            if (!wordFinal && !beforeVoiceless) continue;
            if (t.Ph == "ɡ" && wordFinal) t.Ph = i > 0 && EndsWithVowel(toks[i - 1].Ph) ? "χ" : "k";
            else t.Ph = DEVOICE[t.Ph];
        }
    }

    /** Phonemize a single Luxembourgish word to canonical IPA (segmental + primary stress; vowel
     *  length folded/deferred). */
    public static string PhonemizeWord(string word)
    {
        var toks = Scan(word);
        RealizeE(word, toks);
        VoiceS(toks);
        InitialSCluster(toks);
        Degeminate(toks);
        VelarNasal(toks);
        SpirantizeG(toks);
        ApplyDevoicing(toks);
        // The mark goes before the NUCLEUS, not the onset — the repo convention. The flagged token IS
        // the nucleus, so this is a prefix on that token rather than a scan for one.
        return string.Concat(toks.Select(t => (t.Stress ? "ˈ" : "") + t.Ph));
    }

    // A word (Luxembourgish Latin letters incl. é ë ä + the loan vowels) / number / punctuation token.
    // The ASCII hyphen is inside the WORD class (`Typ-1-Diabetes`, `COVID-19`); the EN DASH is
    // punctuation, and had to be in both this class and `clausePunctuation` or it is silently discarded.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'-")})|(\\d+)|([.!?…,;:–])", "gu");

    /** This language's OWN inventory. ⚠ à á â ô û ü ö and their capitals ARE DELIBERATELY ABSENT: the
     *  g2p has no rule for them, and drops them outright — listing them here would promise a reading
     *  that does not exist. */
    private const string NATIVE_CLASS = "[a-zéëäA-ZÉËÄ'-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    /** The shared symbol tier. Every noun here is invariant in the plural, so no `countForm` override. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — the word is this language's OWN, so declaring it HERE is what makes ASCII `x`
        // read like `×`. One word, so `by` is omitted and defaults to it.
        Multiply = new MultiplyDef { Times = "mol" },
        Percent = new[] { "Prozent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "Dollar" }, ["€"] = new[] { "Euro" }, ["¥"] = new[] { "Yen" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "Kilometer" }, ["m"] = new[] { "Meter" }, ["cm"] = new[] { "Zentimeter" },
            ["mm"] = new[] { "Millimeter" }, ["kg"] = new[] { "Kilogramm" },
        },
        Magnitudes = new[] { "Milliounen", "Millioune", "Millioun", "Milliarden", "Milliard" },
        UnitPer = new UnitPerSpec
        {
            ByDenominator = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["h"] = "an der", ["s"] = "pro",
            },
        },
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["h"] = "Stonn", ["s"] = "Sekonn",
        },
        // An UNDECLARED exponent leaves the unit entirely raw — so `km²` needs these. Luxembourgish
        // fuses the measure word German-style: Quadratkilometer, Kubikmeter.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "Quadrat" }, Cubed = new[] { "Kubik" }, Position = ExponentPosition.Compound,
        },
    });

    // The first letter after a number's token — the Eifeler Regel's follower test.
    private static readonly JsRe AHEAD_LETTER = JsRegex.Compile("^[\\s]*([\\p{L}\\p{M}])", "u");
    private static readonly JsRe EN_END = JsRegex.Compile("en$", "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // ORDER: the Luxembourgish rewrites (de-grouping, era, abbreviations, ORDINALS, sports
            // times, clock, decimals, ranges, degrees, signs, fractions) → the shared symbol tier. The
            // ordinals and the clock must precede the number tokenizer; the tier runs last because it
            // needs a NUMBER adjacent to its unit, and both decimal rules leave their operands as digits
            // so that adjacency survives.
            var normalized = SYMBOLS(Normalize.NormalizeLuxembourgish(input));
            return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // ⚠ THE TOKEN STRING IS PASSED AS `raw` (#1080): the digit-at-a-time fallback cannot
                    // recover the digits from the double it exists to bypass. This arm is a bare `\d+`,
                    // so the token IS the digit string.
                    var digits = m.Groups[2].Value;
                    var words = Numbers.NumberToWords(Js.Number(digits), digits).Split(' ');
                    // ⚠ THE EIFELER REGEL APPLIES ACROSS THE NUMBER'S RIGHT EDGE TOO: the language says
                    // *siwe Kilometer*, not *siwen Kilometer*.
                    var rest = normalized[(m.Index + m.Value.Length)..];
                    var after = AHEAD_LETTER.Match(rest);
                    var last = words.Length - 1;
                    // ⚠ The follower must be a LETTER — before a pause the ⟨n⟩ is RETAINED. Trimming
                    // whitespace alone hands the rule a `.`, which is outside the keeper set, so the
                    // sandhi fires across a sentence boundary.
                    if (after.Success && EN_END.IsMatch(words[last]))
                        words[last] = Numbers.ApplyEifelerRegel(words[last], after.Groups[1].Value);
                    foreach (var wd in words)
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk)) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Luxembourgish phonemizer (grapheme g2p + diphthongs + German-style rules; length
     *  folded/deferred). */
    public static ILanguage CreateLuxembourgish() => new Engine();

    internal static void RegisterSelf() => Registry.Register("luxembourgish", () => CreateLuxembourgish());
}
