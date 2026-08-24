/**
 * Tamil (ta) phonemizer — canonical IPA. The systematic abugida parsing (consonant +
 * inherent/sign vowel, virama clusters, independent vowels) is handled by the SHARED core/abugida.ts
 * interpreter driven by tamil.jsonc — the same engine Hindi uses. Tamil-specifics are layered on top as a
 * post-pass: the Dravidian plosive voicing allophony and the two-level (primary + secondary) stress, which are
 * context-sensitive and cannot be declarative.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tamil;

public static class TamilPhonemizer
{
    private const string TIE = "͡";
    private static readonly IReadOnlySet<string> COMBINING =
        new HashSet<string>(new[] { "̪", "̃", "ᶦ", "ᶷ" }, StringComparer.Ordinal); // dental, nasalisation, superscript i/u (aᶦ/aᶷ diphthong offglides)
    // Dravidian voicing classes are DATA (tamil.jsonc). VOICE: க/ட/த/ப → voiced; VOICELESS_BLOCK: units (voiceless
    // obstruents + ற) that block a following stop from voicing (the tap ர ɾ is NOT here, so a stop voices after it).
    private static IReadOnlyDictionary<string, string> VOICE => Manifest.MANIFEST.Voicing.Voice;
    private static readonly IReadOnlySet<string> NASAL_UNITS = new HashSet<string>(Manifest.MANIFEST.Voicing.Nasals, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> VOICELESS_BLOCK = new HashSet<string>(Manifest.MANIFEST.Voicing.VoicelessBlock, StringComparer.Ordinal);
    private static bool IsVowel(string u) => u != "" && "aɐɪiʊueo".Contains(Js.CodePoints(u)[0], StringComparison.Ordinal);

    /** Split an IPA string into phoneme units (base char + its combining marks / tie / length). */
    private static List<string> Segment(string ipa)
    {
        var ch = Js.CodePoints(ipa);
        var units = new List<string>();
        var i = 0;
        while (i < ch.Count)
        {
            var u = ch[i];
            i++;
            for (; ; )
            {
                var c = i < ch.Count ? ch[i] : null;
                if (c == TIE)
                {
                    u += c + (i + 1 < ch.Count ? ch[i + 1] : "");
                    i += 2;
                }
                else if (c is not null && (COMBINING.Contains(c) || c == "ː"))
                {
                    u += c;
                    i++;
                }
                else break;
            }
            units.Add(u);
        }
        return units;
    }

    /** Dravidian plosive allophony over the base phoneme units (from the shared abugida core). */
    private static List<string> Allophony(IReadOnlyList<string> units)
    {
        var outp = new List<string>();
        for (var i = 0; i < units.Count; i++)
        {
            var u = units[i];
            var prev = i - 1 >= 0 ? units[i - 1] : null;
            var next = i + 1 < units.Count ? units[i + 1] : null;
            // ற்ச → t͡ɕː (the ற assimilates to a following ச).
            if (u == "r" && next == "t͡ɕ")
            {
                outp.Add("t͡ɕː");
                i++;
                continue;
            }
            // Geminate: identical adjacent consonants → Cː; ற்ற → ʈr.
            if (!IsVowel(u) && next == u)
            {
                outp.Add(u == "r" ? "ʈr" : u + "ː");
                i++;
                continue;
            }
            // Coda ர (ɾ) → the alveolar r (அவர்→aʋɐr); onset ர stays the tap ɾ (அரசு→aɾɐt͡ɕʊ).
            if (u == "ɾ" && (next is null || !IsVowel(next))) u = "r";
            // Voicing. க/ட/த/ப voice unless word-initial, after a voiceless obstruent/ற, or a coda (except ட and the
            // word-final proclitic-sandhi form). ச is the exception: voiceless t͡ɕ, d͡ʒ only after a nasal.
            var prevVoiceless = prev is null || VOICELESS_BLOCK.Contains(prev);
            var postNasal = prev is not null && NASAL_UNITS.Contains(prev);
            var onset = next is not null && IsVowel(next);
            if (u == "t͡ɕ")
            {
                if (postNasal) u = "d͡ʒ";
            }
            else if (VOICE.ContainsKey(u) && !prevVoiceless && (onset || next is null || u == "ʈ"))
                u = VOICE[u];
            outp.Add(u);
        }
        return outp;
    }

    /** Primary ˈ on syllable 1; secondary ˌ on even nucleus indices ≥2 that are NOT the last (1–3-syllable words
     *  carry only the primary; 4+ get ˌ on syllables 3, 5, 7…). */
    private static string Stress(IReadOnlyList<string> units)
    {
        var last = -1;
        for (var i = 0; i < units.Count; i++) if (IsVowel(units[i])) last = i;
        var ni = -1;
        var res = "";
        for (var i = 0; i < units.Count; i++)
        {
            var u = units[i];
            if (IsVowel(u))
            {
                ni++;
                if (ni == 0) res += "ˈ";
                else if (ni >= 2 && ni % 2 == 0 && i != last) res += "ˌ";
            }
            res += u;
        }
        return res;
    }

    private static Func<string, string>? G2P;
    private static readonly object GATE = new();
    private static string G2p(string word)
    {
        lock (GATE) G2P ??= Abugida.MakeAbugidaG2P(Manifest.MANIFEST, PhonologyLoader.LoadSharedPhonology());
        return G2P(word);
    }

    /** One Tamil word → canonical IPA (abugida core + allophony + two-level stress). */
    public static string PhonemizeWord(string word) => Stress(Allophony(Segment(G2p(word))));

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN = JsRegex.Compile("([஀-௿]+)|(\\d+)|([.!?…,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // the ordered normalization pass (normalize.ts) owns the shared symbol tier too, because
            // its position in the sequence is load-bearing: units must run BEFORE decimals and AFTER
            // de-grouping and the rate rule. See the numbered steps there.
            Clauses.AssembleClauses(Normalize.NormalizeTamil(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in TamilNumbersComposer.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Tamil phonemizer (shared abugida core + Tamil allophony/stress post-pass). */
    public static ILanguage CreateTamil() => new Engine();

    internal static void RegisterSelf() => Registry.Register("tamil", CreateTamil);
}
