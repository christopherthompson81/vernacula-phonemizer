/**
 * Arabic diacritized grapheme→phoneme engine (Modern Standard Arabic, broad phonemic).
 * Ported from src/languages/arabic/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Arabic;

public sealed class Seg
{
    public required string Ph { get; init; }   // IPA phoneme(s)
    public required bool Vowel { get; init; }  // is a syllable nucleus
    public bool Article { get; init; }         // this vowel is the definite-article nucleus (الـ)
}

public static class G2p
{
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static readonly IReadOnlySet<string> SUN = new HashSet<string>(Manifest.MANIFEST.SunLetters, StringComparer.Ordinal);
    private static IReadOnlyDictionary<string, string> PROCLITIC => Manifest.MANIFEST.Proclitics;
    private static ArabicMarks M => Manifest.MANIFEST.Marks;
    private static ArabicLetters L => Manifest.MANIFEST.Letters;
    private static string FATHA => M.Fatha;
    private static string KASRA => M.Kasra;
    private static string DAMMA => M.Damma;
    private static string SUKUN => M.Sukun;
    private static string SHADDA => M.Shadda;
    private static string TANWIN_A => M.Fathatan;
    private static string TANWIN_I => M.Kasratan;
    private static string TANWIN_U => M.Dammatan;
    private static string DAGGER => M.DaggerAlif;
    private static string ALIF => L.Alif;
    private static string ALIF_MAQSURA => L.AlifMaqsura;
    private static string ALIF_MADDA => L.AlifMadda;
    private static string TAA_MARBUTA => L.TaaMarbuta;
    private static string WAW => L.Waw;
    private static string YA => L.Ya;

    private static readonly IReadOnlySet<string> HARAKAT = new HashSet<string>(new[]
    {
        Manifest.MANIFEST.Marks.Fatha, Manifest.MANIFEST.Marks.Kasra, Manifest.MANIFEST.Marks.Damma,
        Manifest.MANIFEST.Marks.Sukun, Manifest.MANIFEST.Marks.Shadda, Manifest.MANIFEST.Marks.Fathatan,
        Manifest.MANIFEST.Marks.Kasratan, Manifest.MANIFEST.Marks.Dammatan, Manifest.MANIFEST.Marks.DaggerAlif,
    }, StringComparer.Ordinal);

    /**
     * Resolve the vowel from a gathered harakat `hk` plus the following LETTER at index i (a long
     * vowel/diphthong consumes a following ا/ي/و).
     */
    private static (string V, int Next) ResolveVowel(string hk, string s, int i)
    {
        string After(int k) => k >= 0 && k < s.Length ? s[k].ToString() : "";
        bool BareGlide(int k) => !HARAKAT.Contains(After(k + 1)); // ي/و with no harakat of its own = long-vowel marker
        if (hk == FATHA)
        {
            if (After(i) == ALIF || After(i) == ALIF_MAQSURA || After(i) == DAGGER) return ("aː", i + 1);
            if (After(i) == YA && After(i + 1) == SUKUN) return ("aj", i + 2);
            if (After(i) == WAW && After(i + 1) == SUKUN) return ("aw", i + 2);
            return ("a", i);
        }
        if (hk == KASRA)
        {
            if (After(i) == YA && BareGlide(i)) return ("iː", i + 1);
            return ("i", i);
        }
        if (hk == DAMMA)
        {
            if (After(i) == WAW && BareGlide(i)) return ("uː", i + 1);
            return ("u", i);
        }
        if (hk == DAGGER) return ("aː", i);
        if (hk == TANWIN_A) return ("an", i);
        if (hk == TANWIN_I) return ("in", i);
        if (hk == TANWIN_U) return ("un", i);
        return ("", i); // sukun / no marker
    }

    /** Gather the combining-mark cluster after a consonant (shadda + one harakat, in any order). */
    private static (bool Shadda, string Hk, int Next) GatherMarks(string s, int i)
    {
        var shadda = false;
        var hk = "";
        while (i < s.Length && HARAKAT.Contains(s[i].ToString()))
        {
            if (s[i].ToString() == SHADDA) shadda = true;
            else hk = s[i].ToString();
            i++;
        }
        return (shadda, hk, i);
    }

    /** Scan a fully-diacritized Arabic word into segments (consonants + vowel nuclei). */
    public static List<Seg> ToSegments(string word)
    {
        var s = word;
        var n = s.Length;
        var segs = new List<Seg>();
        void PushCons(string ph) => segs.Add(new Seg { Ph = ph, Vowel = false });
        void PushVowel(string v, bool article = false)
        {
            if (v != "") segs.Add(new Seg { Ph = v, Vowel = true, Article = article });
        }
        string At(int k) => k >= 0 && k < n ? s[k].ToString() : "";

        var shortMap = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [FATHA] = "a", [KASRA] = "i", [DAMMA] = "u",
        };
        int EmitArticle(int lamIdx)
        {
            var j = lamIdx + 1;
            var shadda = false;
            var vowelMark = "";
            while (j < n && HARAKAT.Contains(At(j)))
            {
                if (At(j) == SHADDA) shadda = true;
                else vowelMark = At(j);
                j++;
            }
            if (shadda)
            {
                PushCons("lː");
                var r = ResolveVowel(vowelMark, s, j);
                PushVowel(r.V);
                return r.Next;
            } // الّذي/الله: geminate + its (possibly long) vowel
            if (!SUN.Contains(At(j))) PushCons("l"); // moon letter keeps l (sun: drop l, it geminates via shadda)
            return j;
        }

        var i = 0;
        if (At(i) == ALIF && At(i + 1) == "ل")
        {
            PushVowel("a", article: true); // tag so a variety can raise it (arz il-)
            i = EmitArticle(i + 1);
        }
        else if (PROCLITIC.ContainsKey(At(i)) && shortMap.ContainsKey(At(i + 1)) && At(i + 2) == ALIF && At(i + 3) == "ل")
        {
            PushCons(PROCLITIC[At(i)]);
            PushVowel(shortMap[At(i + 1)]);
            i = EmitArticle(i + 3); // proclitic + الـ (alif elides)
        }
        else if (At(i) == "ل" && At(i + 1) == KASRA && At(i + 2) == "ل")
        {
            PushCons("l");
            PushVowel("i");
            i = EmitArticle(i + 2);
        }
        else if (At(i) == ALIF && HARAKAT.Contains(At(i + 1)))
        {
            var (_, hk, next) = GatherMarks(s, i + 1);
            var r = ResolveVowel(hk, s, next);
            PushVowel(r.V);
            i = r.Next;
        }
        else if (At(i) == ALIF_MADDA)
        {
            PushCons("ʔ");
            PushVowel("aː");
            i += 1;
        }
        else if (At(i) == ALIF)
        {
            PushVowel("i");
            i += 1;
        }

        while (i < n)
        {
            var c = At(i);
            if (CONS.TryGetValue(c, out var consPh))
            {
                var ph = consPh;
                i++;
                var marks = GatherMarks(s, i); // shadda + harakat in any order, then the long-vowel letter
                if (marks.Shadda) ph += "ː"; // gemination → length mark C
                PushCons(ph);
                var (v, next) = ResolveVowel(marks.Hk, s, marks.Next);
                PushVowel(v);
                i = next;
            }
            else if (c == ALIF_MADDA)
            {
                PushCons("ʔ");
                PushVowel("aː");
                i++;
            }
            else if (c == ALIF || c == ALIF_MAQSURA)
            {
                var prev = segs.Count > 0 ? segs[^1] : null;
                if (prev is not null && !prev.Vowel) PushVowel("aː");
                i++;
            }
            else if (c == TAA_MARBUTA)
            {
                i++;
            } // taː marbuːta: silent in pausal form (the preceding fatḥa is the ending)
            else
            {
                i++;
            } // harakat already consumed / unknown → skip
        }
        return segs;
    }
}
