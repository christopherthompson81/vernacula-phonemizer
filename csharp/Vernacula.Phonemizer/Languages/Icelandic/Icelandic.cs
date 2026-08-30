/**
 * Icelandic (is) phonemizer — íslenska, North Germanic (Insular), Latin script + ⟨þ ð æ ö⟩, canonical IPA.
 * One of the deepest orthographies in the fleet: a greedy longest-match grapheme scan (vowel digraphs +
 * the epenthetic-stop / devoiced-sonorant clusters) + code rules — no voicing contrast (⟨b d g⟩/⟨p t k⟩
 * neutralize to [p t k]), ⟨k g gj kj⟩ → the palatal [c] before a front vowel, the intervocalic ⟨g⟩ →
 * [ɣ]/[j]/[x], the epenthetic clusters ⟨ll⟩→[tl] ⟨rl⟩→[rtl] ⟨rn⟩→[rtn] and the context-dependent ⟨nn⟩,
 * preaspiration, the pre-velar-nasal diphthongization, the ⟨í⟩ hiatus glide, the ⟨f⟩ realization, and
 * PRIMARY STRESS fixed on the first syllable. The grapheme values, the four letter classes, the ordinals
 * and the number words live in icelandic.jsonc.
 * Ported from src/languages/icelandic/icelandic.ts — see that file for the corpus evidence and the
 * referee measurements.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Icelandic;

public static class IcelandicPhonemizer
{
    /** One scan token: the IPA phones for a grapheme + flags (⟨g⟩-origin → intervocalic spirantization;
     *  a high-front vowel → the glide rule; FORTIS ⟨p t k⟩ → preaspiration). */
    private sealed class Tok
    {
        public string Ph = "";
        public bool GVar;
        public bool HiatusGlide;
        public bool Fortis;
    }

    private static IReadOnlyDictionary<string, string> DIGRAPHS => Manifest.MANIFEST.Digraphs;
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    // ⚠ DELIBERATELY NOT core/ipa.ts's shared class — the ONE engine that keeps its own vowel list. It omits
    // plain ⟨e⟩, and since the digraphs ⟨ei ey⟩ scan to the two-character value "ei", startsWithVowel("ei")
    // is false and the hiatus glide never fires before a diphthong.
    private static readonly IReadOnlySet<string> VOWEL_PH =
        new HashSet<string>("aɛɪiɔouʏœøy".Select(c => c.ToString()), StringComparer.Ordinal);

    // ⚠ NOT VOWEL_PH, AND THE DIFFERENCE IS THE ONE CHARACTER ⟨e⟩. VOWEL_PH asks "can the hiatus glide
    // land next to this phone" (⟨e⟩ omitted so the ⟨ei ey⟩ diphthong does not attract a glide); this asks
    // "is this character a syllable NUCLEUS", and the ⟨ei⟩ diphthong plainly is one — ein must be ˈein,
    // not stress-less.
    private static readonly IReadOnlySet<string> NUCLEUS_CH = new HashSet<string>(VOWEL_PH) { "e" };

    private static readonly IReadOnlySet<string> FRONT_PH =
        new HashSet<string>("ɛɪijy".Select(c => c.ToString()), StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> STOPS =
        new HashSet<string>(new[] { "p", "t", "k" }, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> VOICELESS_PH =
        new HashSet<string>("ptksθfhc".Select(c => c.ToString()), StringComparer.Ordinal);

    // Before the velar nasal (⟨ng nk⟩), a short vowel DIPHTHONGIZES (bang→pauŋk, gengur→ceiŋkʏr,
    // ungur→uːŋkʏr).
    private static readonly IReadOnlyDictionary<string, string> PRENASAL_V =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["a"] = "au", ["ɛ"] = "ei", ["ɔ"] = "ou", ["œ"] = "øy", ["ɪ"] = "i", ["ʏ"] = "u",
        };

    /** Scan a lowercased Icelandic word into phone tokens: longest-match digraphs (incl. the sonorant
     *  clusters), the geminate stops, and the ⟨k g⟩→[c] palatalization + the context-dependent ⟨nn⟩. */
    private static List<Tok> Scan(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var toks = new List<Tok>();
        var i = 0;
        while (i < w.Length)
        {
            var c = w[i].ToString();
            var next = i + 1 < w.Length ? w[i + 1].ToString() : "";
            // Context-dependent ⟨nn⟩: [tn] after a long/accented vowel or a diphthong, else a plain [n].
            if (c == "n" && next == "n")
            {
                var from = Math.Max(0, i - 2);
                var prev2 = w.Substring(from, i - from);
                var prev = i - 1 >= 0 ? w[i - 1].ToString() : "";
                var afterLong = Manifest.LONG_NUCLEUS.Contains(prev) || prev2 is "au" or "ei" or "ey";
                toks.Add(new Tok { Ph = afterLong ? "tn" : "n" });
                i += 2;
                continue;
            }
            var prevVowel = toks.Count > 0 && EndsWithVowel(toks[^1].Ph);
            // Geminate stops: fortis ⟨pp tt kk⟩ PREASPIRATE to [h]+stop; lenis ⟨bb dd gg⟩ collapse to a bare
            // stop (⟨kk gg⟩→[c] palatal before a front V — the trigger ⟨j⟩ is absorbed: drekkja→trɛhca).
            if (c == next && (STOPS.Contains(c) || c is "b" or "d" or "g"))
            {
                var fortis = STOPS.Contains(c);
                var afterPair = i + 2 < w.Length ? w[i + 2].ToString() : "";
                var consumed = 2;
                var gemPh = G[c];
                if ((c == "k" || c == "g") && Manifest.FRONT_V.Contains(afterPair))
                {
                    gemPh = "c";
                    if (afterPair == "j") consumed = 3;
                }
                if (fortis) toks.Add(new Tok { Ph = "h" });
                toks.Add(new Tok { Ph = gemPh, Fortis = fortis });
                i += consumed;
                continue;
            }
            // Other doubled consonants collapse to a single phone (Sviss→svɪs, the length folds).
            if (c == next && Manifest.OTHER_DOUBLE.Contains(c))
            {
                toks.Add(new Tok { Ph = G[c] });
                i += 2;
                continue;
            }
            var matched = false;
            foreach (var key in Manifest.ORDER)
            {
                if (w.AsSpan(i).StartsWith(key, StringComparison.Ordinal))
                {
                    toks.Add(new Tok { Ph = DIGRAPHS[key] });
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;
            // ⟨k g⟩ → PALATAL [c] before a front vowel or ⟨j⟩ (the ⟨j⟩ absorbed); an INTERVOCALIC ⟨g⟩ before
            // a front vowel is the approximant [j] instead (deigja→teija, Logi→lɔjɪ vs gelda→cɛlta).
            if ((c == "k" || c == "g") && Manifest.FRONT_V.Contains(next))
            {
                toks.Add(new Tok { Ph = c == "g" && prevVowel ? "j" : "c", Fortis = c == "k" });
                i += next == "j" ? 2 : 1;
                continue;
            }
            if (G.TryGetValue(c, out var ph))
                toks.Add(new Tok { Ph = ph, GVar = c == "g", HiatusGlide = Manifest.HIATUS_GLIDE.Contains(c), Fortis = STOPS.Contains(c) });
            i += 1;
        }
        return toks;
    }

    private static string First(string ph) => Js.CodePoints(ph)[0];
    private static string Last(string ph)
    {
        var a = Js.CodePoints(ph);
        return a[^1];
    }
    private static bool StartsWithVowel(string ph) => VOWEL_PH.Contains(First(ph));
    private static bool EndsWithVowel(string ph) => VOWEL_PH.Contains(Last(ph));

    /** Intervocalic ⟨g⟩ [k] → the voiced velar fricative [ɣ] (dagur→taɣʏr), or [j] before a front vowel
     *  (Logi→lɔjɪ) — only underlying ⟨g⟩, not ⟨k⟩ (Gaukur→køykʏr). */
    private static void SpirantizeG(List<Tok> toks)
    {
        for (var i = 0; i < toks.Count; i++)
        {
            if (toks[i].Ph != "k") continue;
            var next = i + 1 < toks.Count ? toks[i + 1].Ph : null;
            if (next is "t" or "s") { toks[i].Ph = "x"; continue; } // ⟨k g⟩ → [x] before a voiceless stop (lukt→lʏxt)
            if (!toks[i].GVar || i == 0 || !EndsWithVowel(toks[i - 1].Ph)) continue;
            // post-vocalic ⟨g⟩ → [ɣ] before a voiced sound or word-finally (lag→laɣ, ég→jɛɣ,
            // Sigmar→sɪɣmar), [j] before front.
            if (next is null || !VOICELESS_PH.Contains(First(next)))
                toks[i].Ph = next is not null && FRONT_PH.Contains(First(next)) ? "j" : "ɣ";
        }
    }

    /** ⟨ng nk⟩ → [ŋk]: ⟨n⟩ → [ŋ] before a velar [k] or a palatal [c] (Alþingi→alθiŋcɪ), and the preceding
     *  short vowel diphthongizes (the pre-velar-nasal change). */
    private static void VelarNasal(List<Tok> toks)
    {
        for (var i = 0; i < toks.Count - 1; i++)
        {
            if (toks[i].Ph == "n" && (toks[i + 1].Ph is "k" or "c"))
            {
                toks[i].Ph = "ŋ";
                var prev = i - 1 >= 0 ? toks[i - 1] : null;
                if (prev is not null && PRENASAL_V.TryGetValue(prev.Ph, out var p)) prev.Ph = p;
            }
        }
    }

    /** PREASPIRATION: a single fortis ⟨p t k⟩ before a sonorant ⟨l m n⟩ → [h] + stop (Hekla→hɛhkla,
     *  vatn→vahtn). The fortis GEMINATES already preaspirated in scan. */
    private static void Preaspirate(List<Tok> toks)
    {
        for (var i = toks.Count - 2; i >= 0; i--)
        {
            var nph = toks[i + 1].Ph;
            var alreadyPre = i > 0 && toks[i - 1].Ph == "h"; // a fortis GEMINATE already carries its [h] from scan
            if (toks[i].Fortis && !alreadyPre && nph is "l" or "m" or "n" or "tl" or "tn")
                toks.Insert(i, new Tok { Ph = "h" });
        }
    }

    /** A glide [j] appears between a ⟨í⟩ and a following vowel (Biblía→pɪplija, María→maːrija). */
    private static void GlideJ(List<Tok> toks)
    {
        for (var i = toks.Count - 2; i >= 0; i--)
            if (toks[i].HiatusGlide && StartsWithVowel(toks[i + 1].Ph)) toks.Insert(i + 1, new Tok { Ph = "j" });
    }

    /** ⟨f⟩ realization: [v] before a voiced sound or intervocalic (lofa→lɔːva), [p] before a nasal
     *  ⟨m n⟩ (höfn→hœpn), [f] otherwise (word-final / before a voiceless obstruent). */
    private static void RealizeF(List<Tok> toks)
    {
        for (var i = 0; i < toks.Count; i++)
        {
            if (toks[i].Ph != "f") continue;
            var next = i + 1 < toks.Count ? toks[i + 1].Ph : null;
            if (next is "n" or "m") toks[i].Ph = "p";
            else if (i > 0 && (next is null || !VOICELESS_PH.Contains(First(next)))) toks[i].Ph = "v"; // voiced / word-final
        }
    }

    /** PRIMARY STRESS → the first syllable, marked before the NUCLEUS (the repo convention: nˈaða, not
     *  ˈnaða). The mark goes before the nucleus rather than prefixing the word — ⟨é⟩ scans to the
     *  two-character value "jɛ" whose [j] is an onset glide inside the grapheme, so ég is jˈɛɣ. */
    private static string StressInitial(string ipa)
    {
        var ch = Js.CodePoints(ipa);
        var i = 0;
        for (; i < ch.Count; i++)
            if (NUCLEUS_CH.Contains(ch[i])) break;
        if (i == ch.Count) return ipa; // no nucleus (bare consonants) → no mark
        return string.Concat(ch.GetRange(0, i)) + "ˈ" + string.Concat(ch.GetRange(i, ch.Count - i));
    }

    /** One Icelandic word → canonical IPA (segmental + initial stress; length + aspiration +
     *  sonorant-devoicing folded). */
    public static string PhonemizeWord(string word)
    {
        var toks = Scan(word);
        VelarNasal(toks);
        SpirantizeG(toks);
        Preaspirate(toks);
        GlideJ(toks);
        RealizeF(toks);
        return StressInitial(string.Concat(toks.Select(t => t.Ph)));
    }

    // A word (Icelandic Latin letters incl. á é í ó ú ý þ ð æ ö) / number / punctuation token.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.HostWordRun(new[] { "Latin" }, "'-")})|(\\d+)|([.!?…,;:])", "gu");

    /** This language's OWN inventory: a token the class rejects carries a letter the language does not use. */
    private const string NATIVE_CLASS = "[a-záéíóúýþðæöA-ZÁÉÍÓÚÝÞÐÆÖ'-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // normalize FIRST — everything the g2p cannot read is rewritten to Icelandic words, in
            // particular the ordinal form selected by the FOLLOWING noun (Icelandic ordinals agree in
            // gender and case, unlike the Norwegian and Danish single-form tables).
            return Clauses.AssembleClauses(Normalize.NormalizeIcelandic(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                // Numbers: the tens-first / gender-concord compositor → each word back through the same g2p.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0
                    && CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk != "")
                    sink.Pause(mk);
            });
        }
    }

    /** Build the Icelandic phonemizer (grapheme g2p + fortis/lenis neutralization + the epenthetic
     *  clusters). */
    public static ILanguage CreateIcelandic() => new Engine();

    internal static void RegisterSelf() => Registry.Register("icelandic", CreateIcelandic);
}
