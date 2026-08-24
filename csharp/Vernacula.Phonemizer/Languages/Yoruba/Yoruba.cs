/**
 * Native Yoruba / Èdè Yorùbá (yo) text phonemizer — canonical IPA. Volta-Niger (Niger-Congo),
 * a highly PHONEMIC three-tone Latin orthography, so a near one-to-one rule-based g2p. Signature features: the
 * labial-velars ⟨gb⟩→ɡ͡b / ⟨p⟩→k͡p (no plain /p/), ⟨j⟩→d͡ʒ, ⟨ṣ⟩→ʃ, ⟨r⟩→ɾ; the dotted-below vowels ẹ→ɛ ọ→ɔ; NASAL
 * vowels from a coda ⟨n⟩ (ọn→ɔ̃; an onset n before a vowel stays n); syllabic nasals m̩/n̩; and THREE level tones
 * on each vowel/syllabic nasal — High=acute ˥, Mid=unmarked ˧, Low=grave ˩ (Chao letters). Epitran-validated.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Yoruba;

public sealed class YorubaPhonemizer : ILanguage
{
    private static YorubaManifest DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private const string DOT_BELOW = "̣", ACUTE = "́", GRAVE = "̀", MACRON = "̄";
    private static readonly IReadOnlySet<string> TONE_MARK =
        new HashSet<string>(new[] { ACUTE, GRAVE, MACRON }, StringComparer.Ordinal);
    // ⚠ NO EMPTY GUARD, AND NONE IS WANTED: the one caller that can pass "" is the `⟨w⟩` labialisation test
    // below, whose `s[i + 1] ?? ""` is deliberate — `"aeiou".includes("")` is TRUE in JS, and .NET's
    // `Contains("")` is true too, so a word-final ⟨w⟩ after a consonant labialises it in both engines.
    private static bool IsVowelLetter(string c) => "aeiou".Contains(c, StringComparison.Ordinal);

    private sealed class Seg
    {
        public string Ph = "";
        public string? Tone; // Chao letter for a nucleus (vowel or syllabic nasal); null for a plain consonant
        public bool Nasal; // a coda-n nasalises the vowel
    }

    /** One Yoruba word → canonical IPA (segments + level tones). */
    public static string PhonemizeWord(string word)
    {
        var s = Js.CodePoints(word.ToLowerInvariant().Normalize(NormalizationForm.FormD));
        var n = s.Count;
        var segs = new List<Seg>();
        Seg? LastNucleus()
        {
            for (var k = segs.Count - 1; k >= 0; k--)
                if (segs[k].Tone is not null) return segs[k];
            return null;
        }

        for (var i = 0; i < n;)
        {
            var c = s[i];
            // Base vowel + its combining marks (dot-below → ẹ/ọ, tone accent).
            if (IsVowelLetter(c))
            {
                var ipa = DEF.Vowels[c];
                var tone = DEF.Tones.Mid;
                var dot = false;
                i++;
                while (i < n && (s[i] == DOT_BELOW || TONE_MARK.Contains(s[i])))
                {
                    if (s[i] == DOT_BELOW) dot = true;
                    else if (s[i] == ACUTE) tone = DEF.Tones.High;
                    else if (s[i] == GRAVE) tone = DEF.Tones.Low;
                    i++;
                }
                if (dot) ipa = c == "e" ? "ɛ" : c == "o" ? "ɔ" : ipa;
                segs.Add(new Seg { Ph = ipa, Tone = tone });
                continue;
            }
            // ⟨n⟩: syllabic n̩ (before a tone mark), onset n (before a vowel), else a coda that nasalises the vowel.
            if (c == "n")
            {
                var nx = i + 1 < n ? s[i + 1] : null;
                if (nx is not null && TONE_MARK.Contains(nx))
                {
                    segs.Add(new Seg
                    {
                        Ph = "n̩",
                        Tone = nx == ACUTE ? DEF.Tones.High : nx == GRAVE ? DEF.Tones.Low : DEF.Tones.Mid,
                    });
                    i += 2;
                }
                else if (nx is not null && IsVowelLetter(nx))
                {
                    segs.Add(new Seg { Ph = "n" }); // onset
                    i++;
                }
                else
                {
                    var v = LastNucleus();
                    if (v is not null) v.Nasal = true; // coda → nasalise the preceding vowel
                    i++;
                }
                continue;
            }
            // ⟨m⟩: syllabic m̩ before a tone mark, else a plain onset m.
            if (c == "m")
            {
                var nx = i + 1 < n ? s[i + 1] : null;
                if (nx is not null && TONE_MARK.Contains(nx))
                {
                    segs.Add(new Seg
                    {
                        Ph = "m̩",
                        Tone = nx == ACUTE ? DEF.Tones.High : nx == GRAVE ? DEF.Tones.Low : DEF.Tones.Mid,
                    });
                    i += 2;
                }
                else
                {
                    segs.Add(new Seg { Ph = "m" });
                    i++;
                }
                continue;
            }
            // ⟨gb⟩ digraph → ɡ͡b; ⟨gh⟩ → ɣ (dialectal / loan grapheme).
            if (c == "g" && i + 1 < n && s[i + 1] == "b")
            {
                segs.Add(new Seg { Ph = DEF.Consonants["gb"] });
                i += 2;
                continue;
            }
            if (c == "g" && i + 1 < n && s[i + 1] == "h")
            {
                segs.Add(new Seg { Ph = "ɣ" });
                i += 2;
                continue;
            }
            // ⟨w⟩ after a consonant onset, before a vowel → labialisation on that consonant (ẹgwa→ɛɡʷa).
            if (c == "w"
                && segs.Count > 0
                && segs[^1].Tone is null
                && IsVowelLetter(i + 1 < n ? s[i + 1] : ""))
            {
                segs[^1].Ph += "ʷ";
                i++;
                continue;
            }
            // ⟨s⟩ + dot-below → ʃ (ṣ).
            if (c == "s")
            {
                if (i + 1 < n && s[i + 1] == DOT_BELOW)
                {
                    segs.Add(new Seg { Ph = "ʃ" });
                    i += 2;
                }
                else
                {
                    segs.Add(new Seg { Ph = "s" });
                    i++;
                }
                continue;
            }
            if (DEF.Consonants.TryGetValue(c, out var cph))
            {
                segs.Add(new Seg { Ph = cph });
                i++;
                continue;
            }
            // ⚠ NOT SILENTLY: a letter this g2p has no rule for still denotes a sound, and dropping it deletes
            // content the writer typed. `latinPhone` is consulted HERE, after every digraph and single-letter rule
            // has been tried, so it can never override a reading this language has an opinion about.
            {
                var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
                if (p is not null) segs.Add(new Seg { Ph = p });
            }
            i++;
        }

        var outp = "";
        foreach (var sg in segs)
            outp += sg.Tone is not null ? sg.Ph + (sg.Nasal ? "̃" : "") + sg.Tone : sg.Ph;
        return outp.Normalize(NormalizationForm.FormC);
    }

    // A Yoruba word = Latin letters (incl. precomposed accented + dotted) plus any combining marks.
    private static readonly JsRe TOKEN = JsRegex.Compile("([A-Za-zÀ-ɏḀ-ỿ̀-ͯ]+)|(\\d+)|([.?!,;:])", "gu");
    private static readonly JsRe SPLIT_WORD = JsRegex.Compile("[\\s-]+", "u");

    public string Text(string input)
    {
        // ⚠ NORMALIZE FIRST, then tokenize. The symbol layer turns `%`, `₦`, a digit-flanked dash and a decimal
        // period into Yoruba words; TOKEN would otherwise drop the signs and read `.` as a clause break.
        return Clauses.AssembleClauses(Normalize.NormalizeYoruba(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            // ⚠ DIGITS GO TO THE YORUBA COMPOSITOR, NEVER TO `foreign`. That fallback is an ENGLISH phonemizer,
            // so `1945` used to read *wˈʌn θˈaᶷzənd nˈaᶦn hˈʌndɹəd fˈɔːɹt̬i fˈaᶦv* — fluent English inside Yoruba
            // speech, which for TTS is worse than silence. numbers.ts reads every digit run, and above 10¹² it
            // falls back to digit-by-digit in Yoruba units rather than to another language.
            // ⚠ ONE emit PER WORD. A composed numeral is several words, and handing the whole string to
            // `phonemizeWord` ran them together — `1945` came out as one 40-phone blob with no boundary, so the
            // syllabifier re-parsed across every junction.
            // ⚠ SPLIT ON HYPHENS TOO, not only spaces, because TOKEN splits typed text there — `ọgọ́rùn-ún` is
            // two tokens when a writer types it. Splitting only on spaces gave the SAME WORD two readings
            // depending on where it came from: `100` read ɔ˧ɡɔ˥ɾũ˩ũ˥ as one unit while typed `ọgọ́rùn-ún` read
            // ɔ˧ɡɔ˥ɾũ˩ ũ˥ with the boundary. The hyphen is a syllable boundary in this orthography, and
            // `phonemizeWord` simply ignores it, so the joined form lost a boundary the text path keeps.
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                foreach (var w in SPLIT_WORD.Re.Split(Numbers.YorubaNumber(m.Groups[2].Value)))
                    if (w.Length > 0) sink.Emit(PhonemizeWord(w));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Yoruba phonemizer. */
    public static ILanguage CreateYoruba() => new YorubaPhonemizer();

    internal static void RegisterSelf() => Registry.Register("yoruba", CreateYoruba);
}
