/**
 * Arabic short-vowel restoration — a SUPPLEMENT-ONLY pass that repairs the words the neural diacritizer
 * (diacritizer.ts) leaves under-voweled.
 * Ported from src/languages/arabic/restore.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Arabic;

public static class Restore
{
    private static readonly JsRe HARAKAT_G = JsRegex.Compile("[ً-ْٰ]", "g"); // tanwīn, short vowels, shadda, sukūn, dagger alif
    private static string StripHarakat(string w) => HARAKAT_G.Replace(w, "");

    /**
     * Is a diacritized word's g2p output a SKELETON — 0 vowels, or a run of ≥3 consecutive consonant
     * segments?
     */
    public static bool IsSkeleton(string diacritizedWord)
    {
        var segs = G2p.ToSegments(diacritizedWord);
        if (segs.Count == 0) return false;
        int vowels = 0,
            run = 0,
            maxRun = 0;
        foreach (var s in segs)
        {
            if (s.Vowel)
            {
                vowels++;
                run = 0;
            }
            else
            {
                run++;
                if (run > maxRun) maxRun = run;
            }
        }
        return vowels == 0 || maxRun >= 3;
    }

    private static readonly (string Key, string Voc)[] CLITICS =
    {
        ("وال", "وَال"), ("فال", "فَال"), ("بال", "بِال"), ("كال", "كَال"), ("لل", "لِل"),
        ("ال", "ال"), ("و", "وَ"), ("ف", "فَ"), ("ب", "بِ"), ("ك", "كَ"), ("ل", "لِ"), ("س", "سَ"),
    };
    private static readonly string[] SUFFIXES = { "ها", "هما", "هم", "هن", "كما", "كم", "كن", "نا", "ه", "ك", "ي" };

    private const string ARABIC_CONSONANTS = "ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوي";
    private const string LONG_CARRIERS = "اوىي"; // alif/wāw/alif-maqṣūra/yāʾ — mater lectionis (long vowel)

    /**
     * Epenthesis floor: vocalize a bare consonant SKELETON so an OOV word (no lexicon/clitic hit) is at least
     * SAYABLE.
     */
    private static string Epenthesize(string u)
    {
        var cs = Js.CodePoints(u);
        bool IsCons(string? c) =>
            c is not null && ARABIC_CONSONANTS.Contains(c, StringComparison.Ordinal)
                          && !LONG_CARRIERS.Contains(c, StringComparison.Ordinal);
        var outp = "";
        var i = 0;
        if (cs.Count > 3 && cs[0] == "ا" && cs[1] == "ل")
        {
            outp = "ال";
            i = 2;
        }
        while (i < cs.Count)
        {
            var c = cs[i];
            if (!IsCons(c))
            {
                outp += c;
                i++;
                continue;
            }
            outp += c;
            i++;
            if (i < cs.Count && LONG_CARRIERS.Contains(cs[i], StringComparison.Ordinal))
            {
                outp += cs[i];
                i++;
            }
            else outp += "َ"; // inserted fatḥa (short nucleus)
            var j = i;
            while (j < cs.Count && IsCons(cs[j])) j++;
            var runLen = j - i;
            var codaLen = j >= cs.Count ? runLen : Math.Max(0, runLen - 1);
            for (var k = 0; k < codaLen; k++) outp += cs[i + k];
            i += codaLen;
        }
        return outp;
    }

    /**
     * Build a candidate VOCALIZED form for an undiacritized word: direct lexicon hit, else clitic-strip →
     * stem lookup → re-attach, else suffix-strip, else clitic+suffix, else the epenthesis floor.
     */
    private static string? BuildRestoredText(string word, IReadOnlyDictionary<string, string> lexicon)
    {
        var u = StripHarakat(word);
        if (u.Length < 2) return null;
        if (lexicon.TryGetValue(u, out var direct)) return direct;
        foreach (var (c, voc) in CLITICS)
        {
            if (u.Length > c.Length + 1 && u.StartsWith(c, StringComparison.Ordinal))
            {
                if (lexicon.TryGetValue(u[c.Length..], out var stem)) return voc + stem;
            }
        }
        foreach (var sfx in SUFFIXES)
        {
            if (u.Length > sfx.Length + 1 && u.EndsWith(sfx, StringComparison.Ordinal))
            {
                if (lexicon.TryGetValue(u[..^sfx.Length], out var stem)) return stem + sfx;
            }
        }
        foreach (var (c, voc) in CLITICS)
        {
            if (u.StartsWith(c, StringComparison.Ordinal))
            {
                var rest = u[c.Length..];
                foreach (var sfx in SUFFIXES)
                {
                    if (rest.Length > sfx.Length + 1 && rest.EndsWith(sfx, StringComparison.Ordinal))
                    {
                        if (lexicon.TryGetValue(rest[..^sfx.Length], out var stem)) return voc + stem + sfx;
                    }
                }
            }
        }
        return Epenthesize(u); // floor: sayable OOV
    }

    private static readonly JsRe WORD = JsRegex.Compile("[ء-يٰٱً-ْـ]+", "gu");

    /**
     * The supplement pass: for each Arabic word in the diacritizer's output whose g2p is a SKELETON, override
     * its vocalization from the lexicon (or the epenthesis floor) — but only if the override is itself no
     * longer a skeleton. Every non-skeleton word is left exactly as the diacritizer produced it.
     */
    public static string RestoreSkeletons(string vocalized, IReadOnlyDictionary<string, string> lexicon)
    {
        return WORD.Replace(vocalized, m =>
        {
            var w = m.Value;
            if (!IsSkeleton(w)) return w;
            var cand = BuildRestoredText(w, lexicon);
            if (cand is not null && !IsSkeleton(cand)) return cand;
            return w;
        });
    }

    /**
     * LEXICON-PRIMARY restoration: a direct Tashkeela lexicon hit is AUTHORITATIVE — it overrides the neural
     * diacritizer for any covered word. An OOV word keeps the neural output unless that output is a
     * skeleton, which then falls to the clitic/suffix strip plus the epenthesis floor.
     */
    public static string LexiconPrimary(string vocalized, IReadOnlyDictionary<string, string> lexicon)
    {
        return WORD.Replace(vocalized, m =>
        {
            var w = m.Value;
            if (lexicon.TryGetValue(StripHarakat(w), out var direct)) return direct;
            if (!IsSkeleton(w)) return w;
            var cand = BuildRestoredText(w, lexicon);
            return cand is not null && !IsSkeleton(cand) ? cand : w;
        });
    }
}
