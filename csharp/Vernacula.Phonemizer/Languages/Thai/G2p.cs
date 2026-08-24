/**
 * Thai grapheme→phoneme engine (authored). The hard structural work — leading-vowel reorder,
 * อักษรนำ leaders, the schwa/inherent-vowel algorithm, syllable segmentation, and computed tone — is done by
 * the syllabifier (syllabifier.ts). This module RENDERS the
 * resulting {onset, nucleus, coda, tone} syllable structure to IPA directly.
 * Contributes ɤ.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Thai;

public static class G2p
{
    // Lexical dictionary of irregulars (length, silent-ร Sanskrit, cluster-under-leading-vowel) the rules can't
    // derive — word → IPA (Chao). Consulted BEFORE the rule engine.
    private static Dictionary<string, string>? DICT;
    private static readonly object GATE = new();
    private static Dictionary<string, string> Dict()
    {
        lock (GATE) return DICT ??= LoadTsv.LoadTsvMap("languages/thai", "dictionary.tsv", optional: true);
    }

    // Grapheme→IPA tables + the length-exception sets are DATA (thai.jsonc). INIT: onset (อ = glottal ʔ; a silent
    // leader is dropped first). CODA: 8-way final. VQUAL: written-vowel unit → base quality (ː added from the scan).
    private static IReadOnlyDictionary<string, string> INIT => Manifest.MANIFEST.Onset;
    private static IReadOnlyDictionary<string, string> CODA => Manifest.MANIFEST.Coda;
    private static IReadOnlyDictionary<string, string> VQUAL => Manifest.MANIFEST.VowelQuality;
    private static readonly IReadOnlySet<string> NO_LENGTH =
        new HashSet<string>(Manifest.MANIFEST.NoLength, StringComparer.Ordinal); // diphthongs — never take ː
    private static readonly IReadOnlySet<string> FORCE_LONG =
        new HashSet<string>(Manifest.MANIFEST.ForceLong, StringComparer.Ordinal); // เ–อ / เ–ิ are ɤː (long); the short exceptions (เงิน) are in the dict
    private static readonly IReadOnlySet<string> RAISABLE =
        new HashSet<string>(Js.CodePoints(Manifest.MANIFEST.Raisable), StringComparer.Ordinal);

    /** Onset IPA for a syllable, dropping a silent ห/อ leader and joining any cluster. */
    private static string OnsetIpa(IReadOnlyList<string> cs, bool first)
    {
        var g = cs;
        if (g.Count >= 2 &&
            ((g[0] == "ห" && RAISABLE.Contains(g[1])) ||
             (first && g[0] == "อ" && g[1] == "ย")))
            g = g.Skip(1).ToList();
        return string.Concat(g.Select(c => INIT.GetValueOrDefault(c) ?? ""));
    }

    /** Render one scanned syllable to IPA (onset + nucleus + tone + coda). */
    private static string RenderSyllable(ThaiSyllableScan s, bool first, bool last)
    {
        var onset = OnsetIpa(s.OnsetCs, first);
        string nucleus;
        var glide = "";
        var vShort = false;
        if (s.NucUnit.Kind == "C")
        {
            nucleus = s.Fate == "o" ? "o" : "a"; // inherent vowel (short) — no glottal
        }
        else
        {
            var gs = string.Concat(s.NucUnit.Gs);
            var q = VQUAL.GetValueOrDefault(gs) ?? "a";
            if (s.NucUnit.Glide is not null)
                glide = s.NucUnit.Glide; // ไ/ใ/ำ → j/m coda (short vowel)
            else if (gs == "เา") glide = "w"; // เ–า → aw (short)
            var isEy = gs == "เย"; // เ–ย → ɤːj (long ɤ, glide j)
            var isLong =
                (s.Long || FORCE_LONG.Contains(gs) || isEy) &&
                !NO_LENGTH.Contains(q) &&
                (glide == "" || isEy);
            nucleus = q + (isLong ? "ː" : "");
            vShort = !isLong && glide == "" && !NO_LENGTH.Contains(q); // an explicit SHORT written vowel, open (not a diphthong)
        }
        var coda = s.CodaG != "" ? (CODA.GetValueOrDefault(s.CodaG) ?? "") : glide;
        var tone = s.Tone is not null ? ThaiTone.THAI_TONE_IPA.GetValueOrDefault(s.Tone) ?? "" : "";
        // A word-FINAL short open syllable takes a glottal ʔ — a written short vowel (จะ→t͡ɕaʔ) or a standalone
        // single-consonant letter with its inherent vowel (ณ→naʔ). A non-final minor short syllable does not.
        var openLast = last && coda == "";
        var finalCoda =
            coda != "" ? coda : (openLast && (vShort || s.NucUnit.Kind == "C") ? "ʔ" : "");
        return onset + nucleus + tone + finalCoda;
    }

    /** One Thai TOKEN → IPA: segment into words (a compound token like ก็คือ splits into ก็ คือ), phonemize each. */
    public static string PhonemizeWord(string token) =>
        string.Join(" ", ThaiSegment.Segment(token)
            .Select(PhonemizeSubword)
            .Where(s => s != ""));

    private static readonly JsRe STRESS_VOWEL = JsRegex.Compile("[aeiouɛɔɤɯ]", "u");

    /** One segmented Thai word → canonical IPA (dictionary of irregulars, else the ported syllabifier + render). */
    private static string PhonemizeSubword(string word)
    {
        if (Dict().TryGetValue(word, out var lex)) return lex;
        var reordered = Syllabifier.ReorderThaiLeadingVowels(Syllabifier.ThaiLexicalFixup(word));
        var prep = Syllabifier.ThaiPrep(reordered);
        if (prep is null) return "";
        var syls = Syllabifier.ThaiScanSyllables(
            prep.Units,
            prep.Fates,
            prep.UnitMark,
            prep.ShortMark);
        // Stress: ˈ on the first syllable; ˌ on even nucleus indices ≥2 (syllables 3, 5, 7…).
        return string.Concat(syls.Select((s, i) =>
        {
            var syl = RenderSyllable(s, i == 0, i == syls.Count - 1);
            var mark = i == 0 ? "ˈ" : i >= 2 && i % 2 == 0 ? "ˌ" : "";
            if (mark == "") return syl;
            var m = STRESS_VOWEL.Match(syl);
            return m.Success
                ? syl[..m.Index] + mark + syl[m.Index..]
                : mark + syl;
        }));
    }
}
