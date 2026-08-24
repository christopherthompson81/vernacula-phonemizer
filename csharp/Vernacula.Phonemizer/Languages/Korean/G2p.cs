/**
 * Korean grapheme→phoneme engine (Seoul standard): Hangul blocks are decomposed algorithmically into
 * initial/medial/final jamo, then the cross-syllable sandhi is applied over the jamo sequence.
 * Ported from src/languages/korean/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Korean;

public static class G2p
{
    // Unicode Hangul-decomposition constants — they drive the syllable-block index math.
    private const int SBASE = 0xac00, LCOUNT = 19, VCOUNT = 21, TCOUNT = 28;
    private const int NCOUNT = VCOUNT * TCOUNT;
    private static readonly IReadOnlyList<string> L_JAMO = Js.CodePoints(Manifest.MANIFEST.Jamo.Onset);
    private static readonly IReadOnlyList<string> V_JAMO = Js.CodePoints(Manifest.MANIFEST.Jamo.Vowel);
    // T_JAMO's leading NULL coda is re-added here: the manifest stores the codas without it so the index
    // math lines up with the Unicode T value.
    private static readonly IReadOnlyList<string> T_JAMO =
        new[] { "" }.Concat(Js.CodePoints(Manifest.MANIFEST.Jamo.Coda)).ToList();

    private static IReadOnlyDictionary<string, string> ONSET => Manifest.MANIFEST.Onset;             // onset jamo → phoneme (underlying, before voicing)
    private static IReadOnlyDictionary<string, string> VOWEL => Manifest.MANIFEST.Vowel;             // medial jamo → phoneme
    private static IReadOnlyDictionary<string, CodaInfo> CODA => Manifest.MANIFEST.Coda;             // coda jamo → { cons, lc, lo } (cluster resolution)
    private static IReadOnlyDictionary<string, string> CODA_PH => Manifest.MANIFEST.CodaPhoneme;     // underlying coda jamo → surface phoneme (7-way neut.)
    private static readonly IReadOnlySet<string> NASAL_CODA =
        new HashSet<string>(Js.CodePoints(Manifest.MANIFEST.NasalCodas), StringComparer.Ordinal);    // sonorant-nasal codas
    private static IReadOnlyDictionary<string, string> NEUT => Manifest.MANIFEST.Neutralize;         // 7-way coda neutralisation → representative jamo
    private static IReadOnlyDictionary<string, string> OBSTR_CODA_TO_NASAL => Manifest.MANIFEST.ObstruentToNasal; // obstruent coda → homorganic nasal (before nasal onset)
    private static IReadOnlyDictionary<string, string> VOICE => Manifest.MANIFEST.Voice;             // lenis onset phoneme → voiced allophone
    private static IReadOnlyDictionary<string, string> TENSE => Manifest.MANIFEST.Tense;             // lenis onset phoneme → tense (tensifiability test)
    private static IReadOnlyDictionary<string, string> TENSE_JAMO => Manifest.MANIFEST.TenseJamo;    // lenis onset jamo → tense counterpart jamo
    private static IReadOnlyDictionary<string, string> ASP_H_CODA => Manifest.MANIFEST.Aspiration.HCodaLenisOnset;  // ㅎ coda + lenis onset → aspirated onset jamo
    private static IReadOnlyDictionary<string, string> ASP_STOP_H => Manifest.MANIFEST.Aspiration.StopCodaHOnset;   // stop coda + ㅎ onset → aspirated onset jamo

    // Lexical 사잇소리 tensification (경음화), which is not rule-derivable. Word → 0-based syllable indices
    // whose onset tenses.
    private static Dictionary<string, int[]>? TENS;
    private static readonly object GATE = new();
    private static Dictionary<string, int[]> TensLexicon()
    {
        lock (GATE) return TENS ??= LoadTsv.LoadTsvMap<int[]>("languages/korean", "tensification.tsv",
            (v, _) => v.Split(',').Select(x => (int)Js.Number(x)).ToArray(), optional: true);
    }

    private sealed class Syl
    {
        public required string L { get; init; }
        public required string V { get; init; }
        public required string T { get; init; } // jamo; T = "" if none
    }

    /** Decompose a run into syllables (non-Hangul chars are dropped). */
    private static List<Syl> Decompose(string word)
    {
        var outp = new List<Syl>();
        foreach (var ch in Js.CodePoints(word))
        {
            var c = Js.CodePointAt0(ch);
            if (c < SBASE || c > 0xd7a3) continue;
            var s = c - SBASE;
            outp.Add(new Syl
            {
                L = L_JAMO[s / NCOUNT],
                V = V_JAMO[s % NCOUNT / TCOUNT],
                T = T_JAMO[s % TCOUNT],
            });
        }
        return outp;
    }

    /** One Korean word → canonical IPA (Hangul decomposition + sandhi + coda neutralisation). */
    public static string PhonemizeWord(string word)
    {
        var syls = Decompose(word);
        if (syls.Count == 0) return "";
        var coda = syls.Select(s => s.T != "" ? CODA[s.T].Cons : "").ToList();
        var onset = syls.Select(s => s.L).ToList();
        var liaised = syls.Select(_ => false).ToList(); // onset was moved here by liaison (gates palatalization)

        // Cross-boundary sandhi (coda of i vs onset of i+1). ⚠ THE ARM ORDER IS LOAD-BEARING and each arm
        // `continue`s: liaison → ㅎ-coda aspiration → stop-coda + ㅎ → lateralization → nasalization →
        // ㄹ→ㄴ after an obstruent/nasal coda → tensification. Reordering them changes the reading.
        for (var i = 0; i < syls.Count - 1; i++)
        {
            var cd = coda[i];
            if (cd == "") continue;
            var on = onset[i + 1];
            if (on == "ㅇ")
            {
                var info = CODA[syls[i].T];
                if (info.Lo == "ㅎ")
                {
                    coda[i] = info.Lc;
                    onset[i + 1] = "ㅇ";
                } // ㅎ deletes before a vowel
                else
                {
                    onset[i + 1] = info.Lo;
                    coda[i] = info.Lc;
                    liaised[i + 1] = true;
                }
                continue;
            }
            if (cd == "ㅎ" && (on == "ㄱ" || on == "ㄷ" || on == "ㅈ" || on == "ㅅ"))
            {
                onset[i + 1] = ASP_H_CODA[on];
                coda[i] = syls[i].T == "ㄶ" ? "ㄴ" : syls[i].T == "ㅀ" ? "ㄹ" : "";
                continue;
            }
            var ncd = NEUT.GetValueOrDefault(cd) ?? cd; // 7-way neutralised coda for the obstruent-based rules below
            if (on == "ㅎ" && (ncd == "ㄱ" || ncd == "ㄷ" || ncd == "ㅂ"))
            {
                onset[i + 1] = ASP_STOP_H[ncd];
                coda[i] = "";
                continue;
            }
            if ((ncd == "ㄴ" && on == "ㄹ") || (ncd == "ㄹ" && on == "ㄴ"))
            {
                coda[i] = "ㄹ";
                onset[i + 1] = "ㄹ";
                continue;
            }
            if ((on == "ㄴ" || on == "ㅁ") && OBSTR_CODA_TO_NASAL.ContainsKey(ncd))
            {
                coda[i] = OBSTR_CODA_TO_NASAL[ncd];
                continue;
            }
            if (on == "ㄹ" && (OBSTR_CODA_TO_NASAL.ContainsKey(ncd) || NASAL_CODA.Contains(ncd)))
            {
                onset[i + 1] = "ㄴ";
                if (OBSTR_CODA_TO_NASAL.ContainsKey(ncd)) coda[i] = OBSTR_CODA_TO_NASAL[ncd];
                continue;
            }
            if ((ncd == "ㄱ" || ncd == "ㄷ" || ncd == "ㅂ") && TENSE.ContainsKey(ONSET[on]))
            {
                onset[i + 1] = TENSE_JAMO.GetValueOrDefault(on) ?? on;
            }
        }

        // Lexical tensification applies AFTER the sandhi loop so it overrides the lenis realisation (a tense
        // onset never voices).
        if (TensLexicon().TryGetValue(word, out var tens))
            foreach (var j in tens)
                if (j >= 0 && j < onset.Count && TENSE_JAMO.ContainsKey(onset[j]))
                    onset[j] = TENSE_JAMO[onset[j]];

        // Stress falls on the first HEAVY (underlyingly coda-bearing) syllable; if none is closed, the first.
        var stressIdx = syls.FindIndex(s => s.T != "");
        if (stressIdx < 0) stressIdx = 0;

        var outp = "";
        bool IsSonorant(string cd) => NASAL_CODA.Contains(cd) || cd == "ㄹ";
        for (var i = 0; i < syls.Count; i++)
        {
            var onPh = ONSET.GetValueOrDefault(onset[i]) ?? "";
            var prevCoda = i > 0 ? coda[i - 1] : null;
            if (liaised[i] && (onset[i] == "ㄷ" || onset[i] == "ㅌ") && syls[i].V == "ㅣ")
                onPh = onset[i] == "ㄷ" ? "t͡ɕ" : "t͡ɕʰ";
            else if (onset[i] == "ㄹ" && prevCoda == "ㄹ") onPh = "ɭ";
            var voiceable = VOICE.ContainsKey(onPh);
            var afterSonorant = i > 0 && (prevCoda == "" || (prevCoda is not null && IsSonorant(prevCoda)));
            if (voiceable && afterSonorant) onPh = VOICE[onPh];
            outp += onPh;
            if (i == stressIdx) outp += "ˈ"; // ˈ before the whole medial (incl. any onglide j/w)
            outp += VOWEL.GetValueOrDefault(syls[i].V) ?? "";
            if (coda[i] != "") outp += CODA_PH.GetValueOrDefault(coda[i]) ?? "";
        }
        return outp;
    }
}
