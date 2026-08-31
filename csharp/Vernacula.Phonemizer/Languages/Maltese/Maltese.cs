/**
 * Maltese (mt) phonemizer — Malti, the only Semitic language in the Latin alphabet, canonical IPA. Maltese
 * orthography is fairly phonemic, so this is a greedy grapheme scan (the ⟨ie għ⟩ digraphs plus the
 * silent-letter rules) + final devoicing + regressive voicing assimilation + ⟨n⟩→m before a labial.
 *   · ⟨q⟩→ʔ (glottal stop), ⟨ċ⟩→t͡ʃ, ⟨ġ⟩→d͡ʒ, ⟨ħ⟩→ħ, ⟨x⟩→ʃ, ⟨z⟩→t͡s vs ⟨ż⟩→z.
 *   · ⟨għ⟩ is SILENT (historically /ʕ ɣ/; it lengthens or pharyngealizes an adjacent vowel — folded), but
 *     surfaces as [ħ] WORD-FINAL (biegħ → bɪːħ).
 *   · ⟨h⟩ is SILENT word-medially (lengthening the adjacent vowel: deheb→dɛːp) but → [ħ] WORD-FINAL (fih→fiːħ).
 *   · ⟨ie⟩ → the long [ɪː] (folded to ɪ). Adjacent identical vowels — from a dropped silent ⟨h/għ⟩ — collapse.
 * Vowel LENGTH (stress-conditioned, about half the referee) and stress (unwritten) are folded and deferred.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Maltese;

public sealed class MaltesePhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> G => Manifest.DEF.Graphemes;
    private static IReadOnlyDictionary<string, string> DEVOICE => Manifest.DEF.Voicing.Devoice;
    private static IReadOnlyDictionary<string, string> VOICE => Manifest.DEF.Voicing.Voice;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.DEF.ClausePunctuation;
    private static MalteseNumbers NUM => Manifest.DEF.Numbers;
    private static readonly IReadOnlySet<string> VOWELS = Ipa.IPA_VOWEL;
    private static readonly IReadOnlySet<string> VOICELESS = new HashSet<string>(
        Manifest.DEF.Voicing.Devoice.Values.Concat(new[] { "t͡s", "ʃ", "ħ", "ʔ", "f", "k", "p", "t", "s" }),
        StringComparer.Ordinal);

    /**
     * Scan a lowercased Maltese word into IPA phoneme tokens (the ⟨ie għ⟩ digraphs plus the ⟨h⟩ rule).
     * ⚠ CODE POINTS — the TS spells this `[...word.toLowerCase()]`.
     */
    private static List<string> Scan(string word)
    {
        var w = Js.CodePoints(Js.ToLowerCase(word));
        var toks = new List<string>();
        for (var i = 0; i < w.Count; i++)
        {
            var c = w[i];
            var two = c + (i + 1 < w.Count ? w[i + 1] : "");
            // ⟨għ⟩: [ħ] word-final (biegħ→bɪːħ), else silent.
            if (two == "għ") { if (i + 2 >= w.Count) toks.Add("ħ"); i += 1; continue; }
            if (two == "ie") { toks.Add("ɪ"); i += 1; continue; } // ⟨ie⟩ → long [ɪː], the ː folded
            if (c == "h") { if (i == w.Count - 1) toks.Add("ħ"); continue; } // [ħ] word-final, else silent
            if (G.TryGetValue(c, out var ph)) toks.Add(ph);
        }
        return toks;
    }

    /** Collapse two adjacent identical vowels (from a dropped silent ⟨h/għ⟩) into one — deheb→dɛ(h)ɛb→dɛb.
     *  Maltese does not write geminate short vowels, so an adjacent pair is a silent-letter artifact. */
    private static void CollapseVowels(List<string> toks)
    {
        for (var i = toks.Count - 1; i > 0; i--)
            if (toks[i] == toks[i - 1] && VOWELS.Contains(toks[i])) toks.RemoveAt(i);
    }

    /** Word-final geminate DEGEMINATION: a doubled consonant collapses word-finally (Ħadd→ħat, att→at) — but
     *  a MEDIAL geminate is kept (attard→attart, qattus→ʔattus). */
    private static void DegeminateFinal(List<string> toks)
    {
        var n = toks.Count;
        if (n >= 2 && toks[n - 1] == toks[n - 2] && !VOWELS.Contains(toks[n - 1])) toks.RemoveAt(n - 1);
    }

    /** A geminated AFFRICATE surfaces as its STOP plus the affricate (⟨ġġ⟩→[dd͡ʒ], ⟨ċċ⟩→[tt͡ʃ], ⟨zz⟩→[tt͡s]). */
    private static readonly IReadOnlyDictionary<string, string> AFFRICATE_STOP =
        new Dictionary<string, string>(StringComparer.Ordinal)
            { ["d͡ʒ"] = "d", ["t͡ʃ"] = "t", ["t͡s"] = "t" };

    private static void GeminateAffricate(List<string> toks)
    {
        for (var i = 0; i < toks.Count - 1; i++)
            if (AFFRICATE_STOP.TryGetValue(toks[i], out var stop) && toks[i] == toks[i + 1]) toks[i] = stop;
    }

    /** ⟨n⟩ → m before a labial (b/p/m): ġenb→d͡ʒɛmp. */
    private static void LabialNasal(List<string> toks)
    {
        for (var i = 0; i < toks.Count - 1; i++)
            if (toks[i] == "n" && (toks[i + 1] == "b" || toks[i + 1] == "p" || toks[i + 1] == "m"))
                toks[i] = "m";
    }

    /** Regressive voicing assimilation over obstruent clusters plus word-final devoicing (ħobż→ħɔps). */
    private static void ApplyVoicing(List<string> toks)
    {
        var last = toks.Count - 1;
        if (last >= 0 && DEVOICE.TryGetValue(toks[last], out var dv)) toks[last] = dv; // word-final devoicing
        for (var k = toks.Count - 2; k >= 0; k--)
        {
            var b = toks[k];
            var nb = toks[k + 1];
            if (DEVOICE.TryGetValue(b, out var d2) && VOICELESS.Contains(nb)) toks[k] = d2;
            else if (VOICE.TryGetValue(b, out var v2) && DEVOICE.ContainsKey(nb)) toks[k] = v2;
        }
    }

    /** Phonemize a single Maltese word to canonical IPA (segmental; length and stress folded/deferred). */
    public static string PhonemizeWord(string word)
    {
        var toks = Scan(word);
        CollapseVowels(toks);
        DegeminateFinal(toks);
        GeminateAffricate(toks);
        LabialNasal(toks);
        ApplyVoicing(toks);
        return string.Concat(toks);
    }

    /** A word (Maltese Latin letters incl. ċ ġ ħ ż, and the apostrophe) / number / punctuation token. */
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.HostWordRun(new[] { "Latin" }, "'")})|(\\d+)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — a foreign name.
     *
     * ⚠ ⟨à ò⟩ JOIN ⟨è ì ù⟩ HERE FOR TRUTH, NOT FOR BEHAVIOUR (#1140). The note that used to sit here said the
     * opposite — that they were "deliberately absent" because the g2p "drops them outright" — and both
     * halves were false: `maltese.jsonc` declares all five grave vowels and this class carried only three.
     * Measured before changing it, the graves read the SAME QUALITY as their plain counterparts, so the fold
     * was reaching the right answer by the wrong route and listing them moves no output at all. Listed
     * anyway, because the class is a claim about the g2p and the claim was false.
     */
    private const string NATIVE_CLASS = "[a-zċġħżàèìòùA-ZĊĠĦŻÀÈÌÒÙ']";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    public string Text(string input) =>
        // ⚠ TEXT NORMALIZATION FIRST — Normalize.cs rewrites grouping commas, decimal points, %, currency
        // signs, units, exponents, °C/°F, the minus, `&` and the Q.K./W.K. era markers into Maltese WORDS,
        // and it carries the shared symbol tier with them. Everything it emits is plain text, so it reaches
        // the g2p through the tokenizer below like any other word; nothing here writes a spelling into the
        // phoneme sink.
        Clauses.AssembleClauses(Normalize.NormalizeMaltese(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
            {
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            }
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                // ≤12 digits stays inside the attested range (< 10¹²); longer reads the raw digit string so
                // the Number() conversion cannot lose precision or go exponential.
                var tok = m.Groups[2].Value;
                var words = tok.Length <= 12
                    ? Numbers.NumberToWords(Js.Number(tok), NUM)
                    : Numbers.ReadDigits(tok, NUM);
                // "tnax-il" is one WORD whose hyphen the grapheme scan simply skips (→ ħdaxil), which is the
                // correct Maltese pronunciation of the linker; it is not a token boundary.
                foreach (var wd in words.Split(' ')) sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });

    /** Build the Maltese phonemizer (grapheme g2p + silent-letter rules + devoicing). */
    public static ILanguage CreateMaltese() => new MaltesePhonemizer();

    internal static void RegisterSelf() => Registry.Register("maltese", CreateMaltese);
}
