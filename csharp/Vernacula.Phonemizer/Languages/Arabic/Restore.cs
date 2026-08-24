/**
 * Arabic short-vowel restoration — a SUPPLEMENT-ONLY pass that repairs the words the neural diacritizer
 * (diacritizer.ts) leaves under-voweled. The BiLSTM is trained on running text and hedges to sukun on isolated /
 * OOV words, producing unpronounceable skeletons (يقول → jqwl, not jaquːl). This pass runs AFTER the diacritizer:
 * for each word whose g2p output is still a SKELETON (0 vowels, or a run of ≥3 consecutive consonants — Arabic
 * forbids CCC, so a 3-run marks a dropped short vowel), it overrides that word's vocalization from a Tashkeela-
 * derived PAUSAL lexicon (direct hit, else clitic/suffix strip → stem lookup), falling back to a syllable-aware
 * epenthesis FLOOR so the output is always sayable. It NEVER touches a word the diacritizer already voweled — so
 * it can only improve, never degrade.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Arabic;

public static class Restore
{
    private static readonly JsRe HARAKAT_G = JsRegex.Compile("[ً-ْٰ]", "g"); // tanwīn, short vowels, shadda, sukūn, dagger alif
    private static string StripHarakat(string w) => HARAKAT_G.Replace(w, "");

    /**
     * Is a diacritized word's g2p output a SKELETON — 0 vowels, or a run of ≥3 consecutive consonant segments? Uses
     * the engine's own segmentation (Seg.vowel), so no IPA-vowel guessing and no digraph miscounting. This is the
     * gate: the restoration fires ONLY on skeletons, never on an already-sayable word.
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

    // Leading proclitics (undiacritized key → VOCALIZED form to re-attach), longest-first. The vocalized form gives
    // the proclitic its own short vowel so the re-attached clitic isn't itself a skeleton. Bare article ال stays
    // undiacritized — the g2p adds ʔal-.
    private static readonly (string Key, string Voc)[] CLITICS =
    {
        ("وال", "وَال"), ("فال", "فَال"), ("بال", "بِال"), ("كال", "كَال"), ("لل", "لِل"),
        ("ال", "ال"), ("و", "وَ"), ("ف", "فَ"), ("ب", "بِ"), ("ك", "كَ"), ("ل", "لِ"), ("س", "سَ"),
    };
    // Pronominal/object suffixes (undiacritized), re-attached after the voweled stem.
    private static readonly string[] SUFFIXES = { "ها", "هما", "هم", "هن", "كما", "كم", "كن", "نا", "ه", "ك", "ي" };

    private const string ARABIC_CONSONANTS = "ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوي";
    private const string LONG_CARRIERS = "اوىي"; // alif/wāw/alif-maqṣūra/yāʾ — mater lectionis (long vowel)

    /**
     * Epenthesis floor: vocalize a bare consonant SKELETON so an OOV word (no lexicon/clitic hit) is at least SAYABLE.
     * SYLLABLE-AWARE (Arabic (C)V(C)(C)): each onset consonant gets ONE nucleus (an inserted fatḥa, or a following
     * long-vowel carrier that already supplies it); the consonants that follow stay as a coda cluster up to the next
     * onset — reading the "tight skeleton" (دنمارك → دَنمارك /danmaːrk/) rather than breaking every cluster.
     */
    private static string Epenthesize(string u)
    {
        var cs = Js.CodePoints(u);
        bool IsCons(string? c) =>
            c is not null && ARABIC_CONSONANTS.Contains(c, StringComparison.Ordinal)
                          && !LONG_CARRIERS.Contains(c, StringComparison.Ordinal);
        var outp = "";
        var i = 0;
        // leading definite article ال: pass through UNVOCALIZED so the g2p handles /ʔal-/ + sun-letter assimilation.
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
            // coda cluster: the following consonant run MINUS its last member (which onsets the next syllable), unless
            // the run ends the word (all coda, CVCC).
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
     * Build a candidate VOCALIZED form for an undiacritized word: direct lexicon hit, else clitic-strip → stem lookup
     * → re-attach, else suffix-strip, else clitic+suffix, else the epenthesis floor. Returns undefined for too-short
     * input.
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

    // Arabic word token (letters + harakat) — everything else (spaces, digits, punctuation) passes through unchanged.
    private static readonly JsRe WORD = JsRegex.Compile("[ء-يٰٱً-ْـ]+", "gu");

    /**
     * The supplement pass: for each Arabic word in the diacritizer's output whose g2p is a SKELETON, override its
     * vocalization from the lexicon (or the epenthesis floor) — but keep the override only if it is itself NO LONGER a
     * skeleton (a bad derivation can't make things worse). Every non-skeleton word is left exactly as the diacritizer
     * produced it.
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
     * diacritizer for any covered word (the classical citation-form vocalization is right for isolated/dictionary
     * words, which the context-trained BiLSTM gets wrong out-of-distribution). An OOV word (no direct hit) keeps the
     * neural output, unless that output is a skeleton — then it falls to the clitic/suffix-strip + epenthesis floor.
     * (Trade-off vs restoreSkeletons: the lexicon's single reading wins even where the neural's CONTEXT would have
     * disambiguated mid-sentence — measured net-better on isolated/dictionary referees; running-text is the open Q.)
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
