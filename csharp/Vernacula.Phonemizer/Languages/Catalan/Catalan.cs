/**
 * Catalan (ca) phonemizer — General Eastern/Central Catalan, canonical IPA: rule g2p → 2R stress →
 * unstressed vowel reduction → spirantization → nasal assimilation → final devoicing + final-r deletion.
 * Ported from src/languages/catalan/catalan.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Catalan;

public sealed class CatalanPhonemizer : ILanguage
{
    // Lexical stressed mid-vowel HEIGHT (open/close is not spelling-derivable — dona/dóna, os/ós).
    private static Dictionary<string, string>? MID_VOWELS;
    private static Dictionary<string, string> MidVowels() =>
        MID_VOWELS ??= LoadTsv.LoadTsvMap("languages/catalan", "mid-vowels.tsv", optional: true);

    // Words whose intervocalic ⟨bl⟩/⟨gl⟩ GEMINATES rather than spirantizes.
    private static Dictionary<string, string>? GEMINATE;
    private static bool Geminates(string word) =>
        (GEMINATE ??= LoadTsv.LoadTsvMap("languages/catalan", "bl-gl-geminate.tsv", optional: true)).ContainsKey(word);

    private static readonly IReadOnlySet<string> NASALS =
        new HashSet<string>(Manifest.MANIFEST.Nasals, StringComparer.Ordinal);
    private static IReadOnlyDictionary<string, string> STOP_TO_FRIC => Manifest.MANIFEST.Spirantize;
    private static IReadOnlyDictionary<string, string> FINAL_DEVOICE => Manifest.MANIFEST.FinalDevoice;
    private static readonly IReadOnlySet<string> PALATALS =
        new HashSet<string>(Manifest.MANIFEST.Palatals, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> FUNCTION_WORDS =
        new HashSet<string>(Manifest.MANIFEST.FunctionWords, StringComparer.Ordinal);

    /**
     * ⚠ SPIRANTIZATION IS POST-LEXICAL — it does not stop at the word edge, and `Spirantize` cannot see past
     * one. ⚠ THE SIBILANT IS A LOOKAHEAD, NOT A CAPTURE: consuming it would take the character the NEXT word
     * needs as its own left context.
     */
    private static readonly JsRe CROSS_WORD_STOP = JsRegex.Compile("([^\\s])(\\s+)([bdɡ])(?=([^\\s]?))", "gu");
    private static readonly JsRe LETTERISH = JsRegex.Compile("[\\p{L}\\p{M}ˈˌ]", "u");

    // ⚠ Reported to the trace (#1150): runs on the ASSEMBLED string, so a token's Emitted is not what ships.
    private static string SpirantizeAcrossWords(string ipa)
    {
        var traced = SpirantizeAcrossWordsCore(ipa);
        Core.Trace.NoteRewrite("spirantize-across-words", ipa, traced);
        return traced;
    }

    private static string SpirantizeAcrossWordsCore(string ipa) => CROSS_WORD_STOP.Replace(ipa, m =>
    {
        var prev = m.Groups[1].Value;
        var gap = m.Groups[2].Value;
        var stop = m.Groups[3].Value;
        var next = m.Groups[4].Value;
        if (NASALS.Contains(prev)) return m.Value;
        if (stop == "d" && (prev == "ɫ" || prev == "ʎ")) return m.Value;                 // homorganic, /d/ only
        if (next == "z" || next == "s" || next == "ʃ" || next == "ʒ") return m.Value;    // before a sibilant
        if (!LETTERISH.IsMatch(prev)) return m.Value;                                    // after a pause
        return prev + gap + (STOP_TO_FRIC.TryGetValue(stop, out var f) ? f : stop);
    });

    private static readonly JsRe FINAL_VOWEL = JsRegex.Compile("[aeiouàèéíòóúüï]$");
    private static readonly JsRe FINAL_VOWEL_S = JsRegex.Compile("[aeiouàèéíòóúüï]s$");
    private static readonly JsRe FINAL_EN_IN = JsRegex.Compile("[ei]n$");

    /** Index of the stressed nucleus: written accent, else the Catalan 2R rule. */
    private static int StressedNucleus(string word, IReadOnlyList<Seg> segs)
    {
        var nuclei = new List<int>();
        for (var i = 0; i < segs.Count; i++) if (segs[i].Nucleus) nuclei.Add(i);
        if (nuclei.Count == 0) return -1;
        foreach (var i in nuclei) if (segs[i].Accent) return i;
        if (nuclei.Count == 1) return nuclei[0];
        // A word whose FINAL syllable is a falling diphthong is OXYTONE — check the seg after the LAST
        // nucleus, not the last seg, so a coda consonant does not mask the diphthong.
        var lastNuc = nuclei[^1];
        var afterLastNuc = lastNuc + 1 < segs.Count ? segs[lastNuc + 1] : null;
        if (afterLastNuc is not null && !afterLastNuc.Nucleus && (afterLastNuc.Ph == "j" || afterLastNuc.Ph == "w"))
            return lastNuc;
        var w = Js.ToLowerCase(word);
        var penult = FINAL_VOWEL.IsMatch(w) || FINAL_VOWEL_S.IsMatch(w) || FINAL_EN_IN.IsMatch(w);
        return penult ? nuclei[^2] : nuclei[^1];
    }

    /** Reduce every UNSTRESSED nucleus to its Central-Catalan reduced vowel (a/e→ə, o→u; i/u unchanged). */
    private static void Reduce(List<Seg> segs, int stress)
    {
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            if (s.Nucleus && i != stress && s.Reduced is not null) s.Ph = s.Reduced;
        }
    }

    // Obstruent voicing pairs for regressive assimilation.
    private static readonly IReadOnlyDictionary<string, string> DEVOICE = new Dictionary<string, string>
    {
        ["b"] = "p", ["d"] = "t", ["ɡ"] = "k", ["z"] = "s", ["v"] = "f", ["ʒ"] = "ʃ", ["d͡ʒ"] = "t͡ʃ", ["d͡z"] = "t͡s",
    };
    private static readonly IReadOnlyDictionary<string, string> VOICE = new Dictionary<string, string>
    {
        ["p"] = "b", ["t"] = "d", ["k"] = "ɡ", ["s"] = "z", ["f"] = "v", ["ʃ"] = "ʒ", ["t͡ʃ"] = "d͡ʒ", ["t͡s"] = "d͡z",
    };

    /** Regressive voicing assimilation, right-to-left so it propagates through a cluster (abst → apst). */
    private static void VoicingAssim(List<Seg> segs)
    {
        for (var i = segs.Count - 2; i >= 0; i--)
        {
            string a = segs[i].Ph, b = segs[i + 1].Ph;
            if (VOICE.ContainsKey(b) && DEVOICE.TryGetValue(a, out var dv)) segs[i].Ph = dv;
            else if (DEVOICE.ContainsKey(b) && VOICE.TryGetValue(a, out var vc)) segs[i].Ph = vc;
        }
    }

    /** Intervocalic ⟨bl⟩/⟨gl⟩ geminate the stop; the geminate blocks spirantization. */
    private static void GeminateBlGl(List<Seg> segs)
    {
        for (var i = 1; i < segs.Count - 1; i++)
        {
            var ph = segs[i].Ph;
            if ((ph == "b" || ph == "ɡ") && segs[i - 1].Nucleus && segs[i + 1].Ph == "ɫ") segs[i].Ph = ph + "ː";
        }
    }

    /** b/d/ɡ → β/ð/ɣ except utterance-initial, after a nasal, or after a lateral. */
    private static void Spirantize(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count; i++)
        {
            if (!STOP_TO_FRIC.TryGetValue(segs[i].Ph, out var fric)) continue;
            var prev = i > 0 ? segs[i - 1].Ph : "";
            var nextPh = i + 1 < segs.Count ? segs[i + 1].Ph : "";
            var afterLateral = prev == "ɫ" || prev == "ʎ" || prev == "ɫː";
            var beforeSibilant = nextPh == "z" || nextPh == "s" || nextPh == "ʃ" || nextPh == "ʒ";
            var stop = i == 0 || NASALS.Contains(prev) || (afterLateral && segs[i].Ph == "d") || beforeSibilant;
            if (!stop) segs[i].Ph = fric;
        }
    }

    /** Coda /n/ place assimilation to the following consonant. */
    private static void NasalAssim(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count - 1; i++)
        {
            if (segs[i].Ph != "n") continue;
            var nx = segs[i + 1].Ph;
            if (PALATALS.Contains(nx)) segs[i].Ph = "ɲ";
            else if (nx == "k" || nx == "ɡ" || nx == "ɣ") segs[i].Ph = "ŋ";
            else if (nx == "p" || nx == "b" || nx == "m" || nx == "β" || nx == "f") segs[i].Ph = "m";
        }
    }

    // Final coda-cluster simplification: a word-final stop drops after a homorganic nasal / lateral.
    private static readonly IReadOnlyDictionary<string, string[]> CLUSTER_DROP = new Dictionary<string, string[]>
    {
        ["n"] = new[] { "t", "d" }, ["ɲ"] = new[] { "t", "d" }, ["ŋ"] = new[] { "k", "ɡ" },
        ["ɫ"] = new[] { "t", "d" }, ["l"] = new[] { "t", "d" }, ["m"] = new[] { "p", "b" },
    };
    // ⟨r⟩ is here but NOT in CLUSTER_DROP — word-final -rt KEEPS its stop (fort), only -rts drops it.
    private static readonly IReadOnlyDictionary<string, string[]> CLUSTER_DROP_S =
        new Dictionary<string, string[]>(CLUSTER_DROP.ToDictionary(kv => kv.Key, kv => kv.Value))
        {
            ["r"] = new[] { "t", "d" }, ["ɾ"] = new[] { "t", "d" },
        };

    /** Central word-final processes: final-r deletion, coda-cluster simplification, then final devoicing. */
    private static void FinalPass(List<Seg> segs, int nucleiCount)
    {
        if (segs.Count == 0) return;
        var last = segs[^1];
        if ((last.Ph == "ɾ" || last.Ph == "r") && nucleiCount >= 2)
        {
            var prev = segs.Count >= 2 ? segs[^2] : null;
            if (prev is not null && prev.Nucleus) { segs.RemoveAt(segs.Count - 1); FinalPass(segs, nucleiCount); return; }
        }
        if (last.Ph == "s" && segs.Count >= 3)
        {
            string stopPh = segs[^2].Ph, sonPh = segs[^3].Ph;
            if (CLUSTER_DROP_S.TryGetValue(sonPh, out var dropsS) && dropsS.Contains(stopPh))
            {
                segs.RemoveAt(segs.Count - 2);
                FinalPass(segs, nucleiCount);
                return;
            }
        }
        if (segs.Count >= 2)
        {
            var prev = segs[^2].Ph;
            if (CLUSTER_DROP.TryGetValue(prev, out var drops) && drops.Contains(last.Ph))
            {
                segs.RemoveAt(segs.Count - 1);
                FinalPass(segs, nucleiCount);
                return;
            }
        }
        var newLast = segs[^1];
        if (FINAL_DEVOICE.TryGetValue(newLast.Ph, out var dev) && !newLast.Nucleus) newLast.Ph = dev;
    }

    /** Phonemize a single Catalan word to canonical IPA (with a stress mark). `unstressed` treats the word as
     *  a PROCLITIC — no stress mark AND no stressed nucleus, so reduction covers every syllable. */
    public static string PhonemizeWord(string word, bool unstressed = false)
    {
        var segs = G2p.ToSegments(word);
        if (segs.Count == 0) return "";
        var stress = unstressed ? -1 : StressedNucleus(word, segs);
        Reduce(segs, stress);
        if (stress >= 0)
        {
            var flag = MidVowels().GetValueOrDefault(Js.ToLowerCase(word));
            if (flag == "e" && segs[stress].Ph == "ɛ") segs[stress].Ph = "e";
            else if (flag == "o" && segs[stress].Ph == "ɔ") segs[stress].Ph = "o";
        }
        NasalAssim(segs); // BEFORE FinalPass so n→ŋ feeds the coda-cluster drop (banc → baŋ)
        VoicingAssim(segs);
        FinalPass(segs, segs.Count(s => s.Nucleus));
        if (Geminates(Js.ToLowerCase(word))) GeminateBlGl(segs);
        Spirantize(segs); // last: after voicing/nasal context is settled
        var outp = new StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress && stress >= 0) outp.Append('ˈ');
            outp.Append(segs[i].Ph);
        }
        return outp.ToString();
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // Catalan letters incl. accents + ç + the l·l middot; numbers: dot = thousands, comma = decimal.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "·")})|(\\d+(?:(?<!(?<!\\d)0)\\.\\d+)*(?:,\\d+)?)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token this class rejects carries a letter Catalan does not use. */
    private const string NATIVE_CLASS = "[a-zàèéíòóúüïç·]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private static readonly JsRe THOUSAND_DOTS = JsRegex.Compile("\\.", "g");

    private static string NumberTokenToWords(string tok)
    {
        var bits = tok.Split(',');
        var intRaw = bits[0];
        string? frac = bits.Length > 1 ? bits[1] : null;
        var plain = THOUSAND_DOTS.Replace(intRaw, "");
        var words = Numbers.NumberToWords(Js.Number(plain), plain);
        if (frac is not null)
            words += $" {Manifest.MANIFEST.Numbers.DecimalConnector} "
                + string.Join(" ", Js.CodePoints(frac).Select(d => Numbers.NumberToWords(Js.Number(d))));
        return words;
    }

    // Function words that resist REDUCTION even though they are de-stressed; they lose the stress MARK only.
    private static readonly IReadOnlySet<string> KEEP_VOWEL =
        new HashSet<string>(new[] { "o", "no", "com" }, StringComparer.Ordinal);

    /** Phonemize one running-text word; an unstressed monosyllabic function word is both de-stressed AND
     *  vowel-reduced (el → əɫ, not ɛɫ), except the KEEP_VOWEL words. */
    private static string WordIpa(string word)
    {
        var lower = Js.ToLowerCase(word);
        if (!FUNCTION_WORDS.Contains(lower)) return PhonemizeWord(word);
        if (KEEP_VOWEL.Contains(lower)) return Js.ReplaceFirst(PhonemizeWord(word), "ˈ", "");
        return PhonemizeWord(word, true);
    }

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // The word is Catalan's OWN, harvested from its existing `×` rule; declaring it here is what makes
        // ASCII `x` read like `×`. One word, so `by` is omitted and defaults to it.
        Multiply = new MultiplyDef { Times = "per" },
        Percent = new[] { "per cent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "euro", "euros" },
            ["$"] = new[] { "dòlar", "dòlars" },
            ["£"] = new[] { "lliura", "lliures" },
            ["¥"] = new[] { "ien", "iens" },
        },
        // ⚠ INSERTION ORDER IS LOAD-BEARING: the tier sorts the keys by LENGTH DESCENDING with a STABLE
        // sort, so ties (km/cm/mm/kg vs h/s/m) resolve in the order written here, as in the TS object.
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "quilòmetre", "quilòmetres" },
            ["cm"] = new[] { "centímetre", "centímetres" },
            ["mm"] = new[] { "mil·límetre", "mil·límetres" },
            ["kg"] = new[] { "quilogram", "quilograms" },
            ["h"] = new[] { "hora", "hores" },
            ["s"] = new[] { "segon", "segons" },
            ["m"] = new[] { "metre", "metres" },
        },
        UnitPer = "per", // 120 km/h → cent vint quilòmetres per hora
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "quadrat", "quadrats" },
            Cubed = new[] { "cúbic", "cúbics" },
        },
        Magnitudes = new[] { "milions", "milió" },
        MagnitudeConnective = "de", // cinc milions DE dòlars
    });

    public string Text(string input)
    {
        // Normalize FIRST, then the shared symbol tier — normalize's ordinal/clock/era steps need the number
        // and its suffix still adjacent, which the tier would break.
        return SpirantizeAcrossWords(Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeCatalan(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(WordIpa(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                sink.Emit(string.Join(" ", NumberTokenToWords(m.Groups[2].Value).Split(' ').Select(WordIpa)));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        }));
    }

    /** Build the Catalan phonemizer (fully rule-based; no data files beyond the manifest and the two TSVs). */
    public static ILanguage CreateCatalan() => new CatalanPhonemizer();

    internal static void RegisterSelf()
    {
        Registry.Register("catalan", CreateCatalan);
        Registry.RegisterRomanPolicy("ca", RomanOrdinals.ROMAN_POLICY);
    }
}
