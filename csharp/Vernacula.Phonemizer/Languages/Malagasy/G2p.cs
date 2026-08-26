/**
 * Malagasy grapheme→phoneme engine — a left-to-right scan over the multi-letter graphemes (prenasalized
 * stops, retroflex affricates) and the vowel table (⟨o⟩→/u/, ⟨y⟩→/i/), no lexicon. Stress is downstream.
 * Ported from src/languages/malagasy/g2p.ts — see that file for the rule inventory and its evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Malagasy;

public readonly record struct Seg(string Ph, bool Nucleus);

public static class G2p
{
    private static IReadOnlyDictionary<string, string> VOWEL_IPA => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> CONS_IPA => Manifest.MANIFEST.Consonants;

    // ⚠ LONGEST FIRST — ndr beats nd/dr, ntr beats nt/tr, nts beats nt/ts. Ordered, not a dictionary.
    private static readonly (string Seq, string Ph)[] DIGRAPHS =
    {
        ("ndr", "ⁿɖʐ"), ("ntr", "ⁿʈʂ"), ("nts", "ⁿts"), ("ndz", "ⁿdz"),
        ("mp", "ᵐp"), ("mb", "ᵐb"), ("nd", "ⁿd"), ("nt", "ⁿt"), ("nj", "ⁿdz"),
        ("ng", "ᵑɡ"), ("nk", "ᵑk"), ("tr", "ʈʂ"), ("dr", "ɖʐ"), ("ts", "ts"), ("j", "dz"),
    };

    // Vowel sequences that are ONE nucleus, so ⟨o⟩ inside them does not take /u/ and stress counts them once.
    private static readonly (string Seq, string Ph)[] VOWEL_SEQ =
    {
        ("ai", "aj"), ("ay", "aj"), ("ao", "o"),
    };

    /** JS `String.prototype.startsWith(seq, i)`. */
    private static bool StartsWithAt(string w, string seq, int i) =>
        i + seq.Length <= w.Length && string.CompareOrdinal(w, i, seq, 0, seq.Length) == 0;

    /** Malagasy word → segment list (no stress). */
    public static List<Seg> ToSegments(string word)
    {
        var w = Js.ToLowerCase(word);
        var n = w.Length;
        var segs = new List<Seg>();
        var i = 0;
        while (i < n)
        {
            var matched = false;
            foreach (var (seq, ph) in DIGRAPHS)
                if (StartsWithAt(w, seq, i))
                {
                    segs.Add(new Seg(ph, false));
                    i += seq.Length;
                    matched = true;
                    break;
                }
            if (matched) continue;
            foreach (var (seq, ph) in VOWEL_SEQ)
                if (StartsWithAt(w, seq, i))
                {
                    segs.Add(new Seg(ph, true));
                    i += seq.Length;
                    matched = true;
                    break;
                }
            if (matched) continue;

            var c = w[i].ToString();
            if (VOWEL_IPA.TryGetValue(c, out var v))
            {
                segs.Add(new Seg(v, true));
                i++;
                continue;
            }
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            var cons = CONS_IPA.TryGetValue(c, out var k)
                ? k
                : LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = true });
            if (cons is not null) segs.Add(new Seg(cons, false));
            i++;
        }
        return segs;
    }

    /** Is this segment a syllable nucleus (a vowel)? */
    public static bool IsNucleus(Seg s) => s.Nucleus;
}
