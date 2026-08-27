/**
 * Latin (la) phonemizer — CLASSICAL Latin (Allen, *Vox Latina*), a context-sensitive grapheme scan over
 * macronized spelling. This file owns the context rules: digraphs and diphthongs, the ⟨i j⟩ glide logic,
 * hiatus tensing, dark/clear ⟨l⟩, the word-final ⟨-Vm⟩ nasalization, and penult/antepenult weight stress.
 * Ported from src/languages/latin/latin.ts — see that file for the rule-by-rule evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latin;

public static class LatinPhonemizer
{
    private static LatinDef DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> SHORT => DEF.Short;
    private static IReadOnlyDictionary<string, string> LONG => DEF.Long;
    private static IReadOnlyDictionary<string, string> TENSE => DEF.Tense;
    private static IReadOnlyDictionary<string, string> CONS => DEF.Consonants;

    private static readonly HashSet<string> VOWEL_LETTER = new(DEF.VowelLetters);
    private static readonly HashSet<string> VELAR = new(DEF.Velars);
    private static readonly HashSet<string> MUTA = new(DEF.Mutae);
    private static readonly HashSet<string> LIQUID = new(DEF.Liquids);

    private static readonly JsRe LENGTH = JsRegex.Compile("ː", "u");
    private static readonly JsRe LENGTH_G = JsRegex.Compile("ː", "gu");
    private static readonly JsRe OFFGLIDE = JsRegex.Compile("̯", "u");
    private static readonly JsRe TILDE_G = JsRegex.Compile("̃", "gu");
    private static readonly JsRe BREVE_G = JsRegex.Compile("̆", "gu");
    private static readonly JsRe NONSYLL_G = JsRegex.Compile("̯", "gu");

    private static bool IsVowelLetter(string? c) => c is not null && VOWEL_LETTER.Contains(c);

    // ⚠ NFD-normalise so a nasalized PRECOMPOSED vowel decomposes to base+tilde and its base is found.
    private static bool IsVowelSeg(string? s) =>
        s is not null && Js.CodePoints(s.Normalize(NormalizationForm.FormD)).Any(Ipa.IPA_VOWEL.Contains);

    /** Lax→tense map: a nasalized long vowel takes the CLOSE quality. */
    private static readonly Dictionary<string, string> TENSE_BASE =
        new() { ["ɛ"] = "e", ["ɪ"] = "i", ["ɔ"] = "o", ["ʊ"] = "u" };

    /** Add nasalization (U+0303) + length to a vowel segment: [ɛ]→[ẽː], [aː]→[ãː].
     *
     * ⚠ THE NON-SYLLABIC MARK IS STRIPPED TOO — the function's contract is "return a nasalized long
     * NUCLEUS", and it cannot honour that while leaving U+032F on. Without it a word whose last two letters
     * spell a diphthong got `ũ̯ː`, and `PlaceStress` (which skips U+032F) then lost the syllable. See the TS
     * for the referee count that settled it. */
    private static string NasalizeLong(string seg)
    {
        var b = NONSYLL_G.Replace(TILDE_G.Replace(LENGTH_G.Replace(seg, ""), ""), "");
        if (TENSE_BASE.TryGetValue(b, out var t)) b = t;
        return (b + "̃").Normalize(NormalizationForm.FormC) + "ː";
    }

    /** Phonemize one Classical Latin word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        // A combining BREVE over a macron marks "common quantity"; drop it and keep the macron's LONG form.
        var w = BREVE_G.Replace(Js.ToLowerCase(word.Normalize(NormalizationForm.FormC)), "");
        var segs = new List<string>();
        string? At(int k) => k >= 0 && k < w.Length ? w[k].ToString() : null;

        // Intervocalic ⟨i j⟩ is a GEMINATE glide after a SHORT vowel, SINGLE after a long/diphthong.
        void PushIntervocalicGlide()
        {
            var prev = segs.Count > 0 ? segs[^1] : null;
            var shortPrev = prev is not null && IsVowelSeg(prev) && !LENGTH.IsMatch(prev) && !OFFGLIDE.IsMatch(prev);
            if (shortPrev) { segs.Add("j"); segs.Add("j"); }
            else segs.Add("j");
        }

        var i = 0;
        while (i < w.Length)
        {
            var c = w[i].ToString();
            var n1 = At(i + 1);
            var two = c + (n1 ?? "");
            // ── Consonant digraphs ──────────────────────────────────────────
            if (two == "qu") { segs.Add("kʷ"); i += 2; continue; }
            if (c == "g" && n1 == "u" && IsVowelLetter(At(i + 2)) && At(i - 1) == "n") { segs.Add("ɡʷ"); i += 2; continue; }
            if (two == "ph") { segs.Add("pʰ"); i += 2; continue; }
            if (two == "th") { segs.Add("tʰ"); i += 2; continue; }
            if (two == "ch") { segs.Add("kʰ"); i += 2; continue; }
            if (two == "rh") { segs.Add("rʰ"); i += 2; continue; }
            if (two == "gn") { if (i == 0) segs.Add("n"); else { segs.Add("ŋ"); segs.Add("n"); } i += 2; continue; }
            // ── Diphthongs ⟨ae au oe⟩ ───────────────────────────────────────
            if (two == "ae") { segs.Add("a"); segs.Add("e̯"); i += 2; continue; }
            if (two == "au") { segs.Add("a"); segs.Add("u̯"); i += 2; continue; }
            if (two == "oe") { segs.Add("o"); segs.Add("e̯"); i += 2; continue; }
            // ── ⟨x⟩ → [k s] ────────────────────────────────────────────────
            if (c == "x") { segs.Add("k"); segs.Add("s"); i += 1; continue; }
            // ── Glides ─────────────────────────────────────────────────────
            if (c == "i" && IsVowelLetter(n1))
            {
                if (i == 0) { segs.Add("j"); i += 1; continue; }
                if (IsVowelLetter(At(i - 1))) { PushIntervocalicGlide(); i += 1; continue; }
                // after a consonant ⟨i⟩+V stays a VOWEL: fall through
            }
            if (c == "j")
            {
                if (i > 0 && IsVowelLetter(At(i - 1)) && IsVowelLetter(n1)) PushIntervocalicGlide();
                else segs.Add("j");
                i += 1; continue;
            }
            // ── ⟨b⟩ → [p] before a voiceless ⟨s t⟩ ─────────────────────────
            if (c == "b" && (n1 == "s" || n1 == "t")) { segs.Add("p"); i += 1; continue; }
            // ── intervocalic ⟨z⟩ → GEMINATE [z z] ──────────────────────────
            if (c == "z" && IsVowelLetter(At(i - 1)) && IsVowelLetter(n1)) { segs.Add("z"); segs.Add("z"); i += 1; continue; }
            // ── Dark ⟨l⟩ ───────────────────────────────────────────────────
            if (c == "l")
            {
                var clear = n1 == "l" || At(i - 1) == "l" || n1 == "i" || n1 == "ī" || n1 == "j" || n1 == "y";
                segs.Add(clear ? "l" : "ɫ");
                i += 1; continue;
            }
            // ── Vowels ─────────────────────────────────────────────────────
            if (LONG.TryGetValue(c, out var lng)) { segs.Add(lng); i += 1; continue; }
            if (SHORT.TryGetValue(c, out var sht))
            {
                // Hiatus tensing — but NOT before an ⟨i j⟩ that will itself surface as a GLIDE.
                var nextGlide = (n1 == "i" || n1 == "j") && IsVowelLetter(At(i + 2));
                var hiatus = "ëïöüÿ".Contains(c, StringComparison.Ordinal) || (IsVowelLetter(n1) && !nextGlide);
                segs.Add(hiatus && TENSE.TryGetValue(c, out var tns) ? tns : sht);
                i += 1; continue;
            }
            // ── Single consonants ──────────────────────────────────────────
            if (CONS.TryGetValue(c, out var cph)) { segs.Add(cph); i += 1; continue; }
            // A letter with no rule here still denotes a sound; only reached once every grapheme declined.
            {
                var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = true });
                if (p is not null) segs.Add(p);
            }
            i += 1;
        }

        // ── Post-processing on the segment array ────────────────────────────
        // (1) nasal ⟨n m⟩ before a fricative ⟨s f⟩ → drop nasal, lengthen+nasalize the preceding vowel.
        for (var k = segs.Count - 2; k >= 1; k--)
        {
            if ((segs[k] == "n" || segs[k] == "m") && (segs[k + 1] == "s" || segs[k + 1] == "f") && IsVowelSeg(segs[k - 1]))
            {
                segs[k - 1] = NasalizeLong(segs[k - 1]);
                segs.RemoveAt(k);
            }
        }
        // (2) ⟨n⟩ → [ŋ] before a velar.
        for (var k = 0; k < segs.Count - 1; k++) if (segs[k] == "n" && VELAR.Contains(segs[k + 1])) segs[k] = "ŋ";
        // (3) word-FINAL ⟨-Vm⟩ → nasalized long vowel [Ṽː].
        if (segs.Count >= 2 && segs[^1] == "m" && IsVowelSeg(segs[^2]))
        {
            segs[^2] = NasalizeLong(segs[^2]);
            segs.RemoveAt(segs.Count - 1);
        }

        PlaceStress(segs);
        return string.Concat(segs).Normalize(NormalizationForm.FormC);
    }

    /** Insert ˈ before the onset of the stressed syllable per the Latin penult/antepenult weight rule. */
    private static void PlaceStress(List<string> segs)
    {
        var nuclei = new List<(int Idx, bool Heavy)>();
        for (var k = 0; k < segs.Count; k++)
        {
            if (OFFGLIDE.IsMatch(segs[k])) continue; // an offglide is part of the preceding nucleus
            if (!IsVowelSeg(segs[k])) continue;
            var diphthong = k + 1 < segs.Count && OFFGLIDE.IsMatch(segs[k + 1]);
            var lng = LENGTH.IsMatch(segs[k]);
            nuclei.Add((k, lng || diphthong));
        }
        if (nuclei.Count == 0) return;
        int target;
        if (nuclei.Count <= 2) target = 0; // monosyllable → sole vowel; disyllable → penult
        else
        {
            var penult = nuclei[^2];
            var ultima = nuclei[^1];
            // Penult heavy BY POSITION iff CLOSED — a muta-cum-liquida cluster onsets the ultima instead.
            var cons = new List<string>();
            for (var k = penult.Idx + 1; k < ultima.Idx; k++)
                if (!IsVowelSeg(segs[k]) && !OFFGLIDE.IsMatch(segs[k])) cons.Add(segs[k]);
            var m = cons.Count;
            var onset = m >= 1 ? 1 : 0;
            if (m >= 2 && MUTA.Contains(cons[m - 2]) && LIQUID.Contains(cons[m - 1])) onset = 2;
            var closedPenult = m - onset >= 1;
            target = penult.Heavy || closedPenult ? nuclei.Count - 2 : nuclei.Count - 3;
        }
        var pos = nuclei[target].Idx;
        if (pos > 0 && !IsVowelSeg(segs[pos - 1]) && !OFFGLIDE.IsMatch(segs[pos - 1])) pos--;
        if (pos > 0 && !IsVowelSeg(segs[pos - 1])
            && (segs[pos] == "l" || segs[pos] == "ɫ" || segs[pos] == "r")
            && !(segs[pos - 1] == "l" || segs[pos - 1] == "ɫ" || segs[pos - 1] == "r")) pos--;
        segs.Insert(pos, "ˈ");
    }

    /** The shared SYMBOL tier — every word a la.wikipedia attestation; see the TS for the glosses and for
     *  why the tier emits the NOMINATIVE and is uninflected in every other slot. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "centesima", "centesimae" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "dollarium", "dollaria" }, ["€"] = new[] { "euro" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "chiliometrum", "chiliometra" }, ["m"] = new[] { "metrum", "metra" },
            ["cm"] = new[] { "centimetrum", "centimetra" }, ["mm"] = new[] { "millimetrum", "millimetra" },
            ["kg"] = new[] { "chiligramma", "chiligrammata" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "quadratum", "quadrata" }, Cubed = new[] { "cubicum", "cubica" },
            Position = ExponentPosition.After,
        },
        Magnitudes = new[] { "milia", "miliones", "milliones" },
    });

    // A word (Latin letters incl. macrons/diaeresis + editorial ⟨v j⟩ + combining marks) / number / punct.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "gu");

    /** This language's OWN inventory — a different question from TOKEN's script boundary above. */
    private const string NATIVE_CLASS = "[a-zāēīōūȳëïöüÿA-ZĀĒĪŌŪȲËÏÖÜŸ̀-ͯ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // normalize.ts FIRST — its era, degree and range steps need the figure and its mark still
            // adjacent — then the shared symbol tier, which matches a unit only when a NUMBER is adjacent.
            return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeLatin(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                // Numbers: compose the Latin cardinal phrase, then phonemize each word.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var tok = m.Groups[2].Value;
                    foreach (var wd in Numbers.NumberToWords(Js.Number(tok), tok).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var p = m.Groups[3].Value;
                    sink.Pause(p == "." || p == "!" || p == "?" ? p : ",");
                }
            });
        }
    }

    /** Build the Classical Latin phonemizer (macron-aware g2p + nasal assimilation + weight stress). */
    public static ILanguage CreateLatin() => new Engine();

    internal static void RegisterSelf() => Registry.Register("latin", () => CreateLatin());
}
