/**
 * Turkish grapheme→phoneme engine. Turkish orthography is shallow and near-1:1 (vowel harmony is already
 * encoded in the spelling), so this is a left-to-right scan with a few context rules — no lexicon:
 *   - vowels are phonemic: a e ı i o ö u ü → a e ɯ i o ø u y (front = e i ö ü, back = a ı o u).
 *   - k/g palatalize before a FRONT vowel: k→c always (asker→asceɾ); g→ɟ only when not after a consonant
 *     (gel→ɟel but bölge→bølɡe).
 *   - l is DARK ɫ next to a back vowel, clear l next to a front vowel (okul→okuɫ, dil→dil) — the ɫ census
 *     contribution.
 *   - ğ (yumuşak g) after e/i → j glide (değil→dejil); elsewhere it lengthens the preceding vowel and a
 *     following identical vowel merges (dağ→daː, soğuk→soːuk, düğün→dyːn).
 *   - a doubled consonant geminates to Cː (teşekkür→teʃekːyɾ).
 * Stress (final-syllable default + a lexicon) and number reading are applied downstream. See
 * for the convention.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkish;

public sealed class Seg
{
    public required string Ph { get; set; } // IPA phoneme(s)
    public required bool Nucleus { get; init; } // is a syllable nucleus (a vowel)
}

public static class G2p
{
    // Vowel/consonant tables + harmony classes are DATA (turkish.jsonc). g/k/l/ğ are handled specially in the scan.
    private static IReadOnlyDictionary<string, string> VOWEL_IPA => Manifest.MANIFEST.Vowels.Ipa;
    private static readonly IReadOnlySet<string> FRONT = new HashSet<string>(Manifest.MANIFEST.Vowels.Front, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> FRONT_UNROUND = new HashSet<string>(Manifest.MANIFEST.Vowels.FrontUnround, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> BACK = new HashSet<string>(Manifest.MANIFEST.Vowels.Back, StringComparer.Ordinal);
    private static IReadOnlyDictionary<string, string> CONS_IPA => Manifest.MANIFEST.Consonants;
    // Doubled STOPS/affricates geminate to Cː (teşekkür→teʃekːyɾ); doubled sonorants/fricatives stay written double.
    private static readonly IReadOnlySet<string> GEMINATE = new HashSet<string>(Manifest.MANIFEST.Geminate, StringComparer.Ordinal);
    private static bool IsVowel(string c) => c != "" && VOWEL_IPA.ContainsKey(c);

    private static readonly JsRe DOTTED_I = JsRegex.Compile("İ", "g");
    private static readonly JsRe DOTLESS_I = JsRegex.Compile("I", "g");
    private static readonly JsRe CIRCUMFLEX = JsRegex.Compile("[âîû]", "g");

    /** Turkish-locale lowercase: İ→i and I→ı (JS toLowerCase would give i̇ / i). Then fold circumflex â/î/û→a/i/u. */
    public static string TrLower(string word)
    {
        var s = JsRegex.Replace(word, DOTTED_I, _ => "i");
        s = JsRegex.Replace(s, DOTLESS_I, _ => "ı");
        s = s.ToLowerInvariant();
        return JsRegex.Replace(s, CIRCUMFLEX, m => Manifest.MANIFEST.CircumflexFold.GetValueOrDefault(m.Value) ?? m.Value);
    }

    /** Turkish word → segment list. */
    public static List<Seg> ToSegments(string word)
    {
        var chars = Js.CodePoints(TrLower(word));
        var segs = new List<Seg>();
        var prevVowel = ""; // last vowel LETTER seen (for l-darkness / ğ)
        var gMerge = "";    // a ğ just lengthened this vowel letter; a following same vowel merges
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            var next = i + 1 < chars.Count ? chars[i + 1] : "";
            var prevC = i - 1 >= 0 ? chars[i - 1] : "";
            // Vowel.
            if (VOWEL_IPA.TryGetValue(c, out var vIpa))
            {
                if (gMerge == c && c != "ı")
                {
                    gMerge = "";
                    prevVowel = c;
                    continue;
                } // ğ-merge: identical vowel folds (ı never merges: yaptığı→ɯːɯ)
                gMerge = "";
                segs.Add(new Seg { Ph = vIpa, Nucleus = true });
                prevVowel = c;
                continue;
            }
            gMerge = "";
            // Geminate stop/affricate → length mark (the second of a doubled stop).
            if (c == prevC && GEMINATE.Contains(c))
            {
                segs.Add(new Seg { Ph = "ː", Nucleus = false });
                continue;
            }
            // ğ (yumuşak g).
            if (c == "ğ")
            {
                if (FRONT_UNROUND.Contains(prevVowel))
                    segs.Add(new Seg { Ph = "j", Nucleus = false }); // değil → dejil
                else if (segs.Count > 0)
                {
                    segs[^1].Ph += "ː";
                    gMerge = prevVowel;
                } // lengthen prev vowel
                continue;
            }
            // l: dark ɫ next to a back vowel, clear l next to a front vowel. Onset l keys on the FOLLOWING vowel,
            // coda l on the PRECEDING vowel.
            if (c == "l")
            {
                var ctx = IsVowel(next) ? next : prevVowel;
                segs.Add(new Seg { Ph = BACK.Contains(ctx) ? "ɫ" : "l", Nucleus = false });
                continue;
            }
            // k/g palatalize to c/ɟ in the environment of a FRONT vowel — an onset keys on the FOLLOWING vowel
            // (asker → asceɾ), a coda on the PRECEDING vowel (renk → ɾeɲc, türk → tyɾc, direkt → diɾect). Same
            // onset/coda logic as l above.
            if (c == "k")
            {
                var ctx = IsVowel(next) ? next : prevVowel;
                segs.Add(new Seg { Ph = FRONT.Contains(ctx) ? "c" : "k", Nucleus = false });
                continue;
            }
            // g → ɟ before a front vowel (majority of the gold; the ɡ cases like bölge are lexical), else ɡ.
            if (c == "g")
            {
                var ctx = IsVowel(next) ? next : prevVowel;
                segs.Add(new Seg { Ph = FRONT.Contains(ctx) ? "ɟ" : "ɡ", Nucleus = false });
                continue;
            }
            if (CONS_IPA.TryGetValue(c, out var cons)) segs.Add(new Seg { Ph = cons, Nucleus = false });
            // else: unknown char (punctuation slipped in) → skip
        }
        // Nasal PLACE assimilation: /n/ takes the place of a following velar/palatal stop — [ŋ] before k/ɡ
        // (angut → aŋɡut, denk → deŋk when back), [ɲ] before c/ɟ (renk → ɾeɲc, brifing → bɾifiɲɟ). Standard Turkish.
        for (var i = 0; i < segs.Count - 1; i++)
        {
            if (segs[i].Ph != "n") continue;
            var nx = segs[i + 1].Ph;
            if (nx == "k" || nx == "ɡ") segs[i].Ph = "ŋ";
            else if (nx == "c" || nx == "ɟ") segs[i].Ph = "ɲ";
        }
        return segs;
    }
}
