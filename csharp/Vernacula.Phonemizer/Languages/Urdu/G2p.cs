/**
 * Urdu (ur) grapheme→phoneme engine — Perso-Arabic abjad → canonical IPA (Hindi phoneme inventory). Urdu is
 * stored in logical order = phonetic order, so RTL is a non-issue (as for Arabic). Handles: consonant letters,
 * aspiration (C + ھ → Cʰ/Cʱ), long vowels written with ا/آ/و/ی/ے, short vowels from harakat WHEN present,
 * shadda gemination, ں nasalization, and — for the usual undiacritized text — a DEFAULT short vowel [ə]
 * between consonants (the crude stand-in for the deferred short-vowel-restoration subsystem).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Urdu;

public sealed class UrduDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public string AspirateHe { get; init; } = "";
    public IReadOnlyDictionary<string, string> Aspirates { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LongVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Glides { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Harakat { get; init; } = new Dictionary<string, string>();
    public string Sukun { get; init; } = "";
    public string Shadda { get; init; } = "";
    public IReadOnlyList<string> Nasalizers { get; init; } = Array.Empty<string>();
    public string InherentVowel { get; init; } = "";
    public NumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class G2p
{
    public static readonly UrduDef DEF = LoadManifest.Load<UrduDef>("languages/urdu", "urdu.jsonc");
    private static IReadOnlyDictionary<string, string> C => DEF.Consonants;
    private static string HE => DEF.AspirateHe;
    private static IReadOnlyDictionary<string, string> ASP => DEF.Aspirates;
    private static IReadOnlyDictionary<string, string> HARAKAT => DEF.Harakat;
    private static readonly IReadOnlySet<string> NASAL = new HashSet<string>(DEF.Nasalizers, StringComparer.Ordinal);
    private static string INH => DEF.InherentVowel;
    private const string ALIF = "ا";
    private const string ALIF_MADDA = "آ";
    private const string WAW = "و";
    private const string YA = "ی";
    private const string BARI_YE = "ے";
    private const string HE_GOL = "ہ";

    private static readonly JsRe VOWEL_PH = JsRegex.Compile("[əaɑɪiʊueoɛɔ]", "");
    private static readonly JsRe ENDS_VOWEL = JsRegex.Compile("[əaɑɪiʊueoɛɔ]ː?̃?$", "u");
    private static readonly JsRe ENDS_TILDE = JsRegex.Compile("̃$", "");

    private static bool IsVowelPh(string ph) => VOWEL_PH.IsMatch(ph);
    /** True when the output so far ENDS in a vowel (ignoring a trailing length ː / nasal ̃). */
    private static bool EndsInVowel(string @out) => ENDS_VOWEL.IsMatch(@out);

    /** A short-vowel letter/glide that, standing alone, is a syllable nucleus rather than a consonant. */
    private static string? LongVowelAfterConsonant(string ch)
    {
        if (ch == ALIF || ch == ALIF_MADDA) return "ɑː";
        if (ch == WAW) return "oː";
        if (ch == YA) return "iː";
        if (ch == BARI_YE) return "eː";
        return null;
    }

    /** Urdu word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var s = Js.CodePoints(word.Normalize(System.Text.NormalizationForm.FormC));
        var n = s.Count;
        var @out = "";
        var i = 0;
        string At(int k) => k >= 0 && k < n ? s[k] : "";

        // Word-initial vowel carrier (alif): آ→ɑː; ا+و→oː, ا+ی→eː, ا+ے→eː; bare ا → short ə carrier.
        if (At(0) == ALIF_MADDA)
        {
            @out += "ɑː";
            i = 1;
        }
        else if (At(0) == ALIF)
        {
            if (At(1) == WAW) { @out += "oː"; i = 2; }
            else if (At(1) == YA || At(1) == BARI_YE) { @out += "eː"; i = 2; }
            else { @out += "ə"; i = 1; }
        }

        while (i < n)
        {
            var ch = s[i];
            // Nasalizer → nasalize the preceding vowel.
            if (NASAL.Contains(ch))
            {
                if (!ENDS_TILDE.IsMatch(@out) && EndsInVowel(@out)) @out += "̃";
                i++;
                continue;
            }
            // Word-final ہ after a consonant realizes as the [ɑ] vowel (بارہ→bɑːɾɑ, آئینہ→ɑːiːnɑ); elsewhere it is [ɦ].
            if (ch == HE_GOL)
            {
                var atEnd = i == n - 1;
                if (atEnd && @out != "" && !EndsInVowel(@out)) @out += "ɑ";
                else @out += "ɦ";
                i++;
                continue;
            }
            // Hamza seats ئ/ؤ carry a vowel in hiatus (بھائی→bʱɑːiː, کوئی→koːiː): emit the vowel and absorb a
            // directly-following ی/و (ئی = one iː). ء (bare hamza) → glottal/hiatus, skipped in the coda.
            if (ch == "ئ" || ch == "ؤ")
            {
                @out += ch == "ئ" ? "iː" : "oː";
                i++;
                if ((ch == "ئ" && At(i) == YA) || (ch == "ؤ" && At(i) == WAW)) i++;
                continue;
            }
            // Standalone glide/vowel letters after a vowel (hiatus) → glide; after a consonant → long vowel.
            if (ch == WAW || ch == YA || ch == BARI_YE || ch == ALIF || ch == ALIF_MADDA)
            {
                var prevVowel = EndsInVowel(@out);
                if (ch == BARI_YE) @out += "eː";
                else if (prevVowel)
                    @out += ch == WAW ? "ʋ" : ch == YA ? "j" : ch == ALIF || ch == ALIF_MADDA ? "ɑː" : "";
                else @out += LongVowelAfterConsonant(ch) ?? "";
                i++;
                continue;
            }
            // Consonant.
            if (C.TryGetValue(ch, out var cph))
            {
                var ph = cph;
                i++;
                // Aspiration: C + ھ → aspirated (only for aspirable consonants; else ھ is a plain [ɦ]).
                if (At(i) == HE && ASP.TryGetValue(ph, out var asp) && asp.Length > 0)
                {
                    ph = asp;
                    i++;
                }
                // Shadda → gemination (length on the consonant).
                if (At(i) == DEF.Shadda)
                {
                    ph += "ː";
                    i++;
                }
                @out += ph;
                // Vowel after the consonant.
                var hk = i < n ? HARAKAT.GetValueOrDefault(s[i]) : null;
                if (At(i) == DEF.Sukun)
                {
                    i++; // explicit no-vowel
                }
                else if (hk is not null)
                {
                    // An EXPLICITLY-WRITTEN fatḥa (= /ə/) must survive medial schwa-deletion, which only elides the
                    // g2p's UNwritten default schwa. Mark it (ə + U+0332) so deleteMedialSchwa (targets bare "ə") skips
                    // it; urdu.ts strips the mark. Without this, a written vowel gets deleted and no vocalization can
                    // reproduce e.g. کَرَنو → kəɾənoː (the cap on inversion for tri-consonantal words).
                    @out += hk == "ə" ? "ə̲" : hk;
                    i++;
                    // harakat + a matching long-vowel letter lengthens to the HIGH long vowel: kasra+ی→iː, damma+و→uː
                    // (the explicit diacritic pins the letter — bare ی/و default to iː/oː; damma+waw = uː, e.g. آلُو ɑːluː,
                    // آرزُو ɑːrzuː). Without this, medial و can only surface as oː and no vocalization reaches the ū words.
                    if ((hk == "ɪ" && At(i) == YA) || (hk == "ʊ" && At(i) == WAW))
                    {
                        @out = @out[..^hk.Length] + (At(i) == YA ? "iː" : "uː");
                        i++;
                    }
                }
                else
                {
                    // ی/و before ANOTHER vowel letter is a glide (دنیا→d̪ʊnjɑ, not d̪əniːɑ), not a long vowel.
                    var glideNext = (At(i) == YA || At(i) == WAW) && LongVowelAfterConsonant(At(i + 1)) is not null;
                    var lv = glideNext ? null : LongVowelAfterConsonant(At(i));
                    if (lv is not null)
                    {
                        // یَ (ya + fatḥa) → eː in our ADAPTED-WORD convention (bare ی = iː). The diacritic encodes the
                        // iː/eː distinction standard harakat lacks — the g2p reads it and the model learns which words
                        // take it, exactly as damma+waw encodes uː. Output is a diacritized word in OUR scheme.
                        if (At(i) == YA && At(i + 1) == "َ") { @out += "eː"; i += 2; }
                        else { @out += lv; i++; }
                    }
                    else if (glideNext)
                    {
                        @out += At(i) == YA ? "j" : "ʋ"; // glide; the following vowel letter provides the nucleus
                        i++;
                    }
                    else if (i < n
                             && !NASAL.Contains(s[i])
                             && !(At(i) == HE_GOL && i == n - 1)) // word-final ہ is the [ɑ] vowel, not a coda needing ə
                    {
                        // No written vowel and more letters follow → the abjad's omitted SHORT vowel: default [ə].
                        @out += INH;
                    }
                    // word-final consonant with no written vowel → no vowel (skeleton coda).
                }
                continue;
            }
            // hamza carriers / unknown diacritic → skip.
            i++;
        }
        return @out.Normalize(System.Text.NormalizationForm.FormC);
    }
}
