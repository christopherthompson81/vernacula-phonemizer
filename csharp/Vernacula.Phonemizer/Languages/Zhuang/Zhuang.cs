/**
 * Zhuang / Vahcuengh (za) phonemizer — Tai-Kadai, Standard Zhuang (Wuming), the 1982 Latin orthography,
 * canonical IPA. A longest-match scan (multi-letter onsets + vowel digraphs before single letters) whose
 * TONES are written as syllable-FINAL letters and emitted as Chao contours after each syllable.
 * Ported from src/languages/zhuang/zhuang.ts — see that file for the orthographic conventions and evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Zhuang;

public static class ZhuangPhonemizer
{
    private static IReadOnlyList<KeyValuePair<string, string>> ONSETS => Manifest.ONSETS_ORDERED;
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyList<KeyValuePair<string, string>> VDIGRAPH => Manifest.VDIGRAPH_ORDERED;
    private static IReadOnlyDictionary<string, string> VOWELS => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> TONE => Manifest.MANIFEST.Tones;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private static bool IsVowelStart(string w, int i) =>
        i < w.Length && (VOWELS.ContainsKey(w[i].ToString()) || VDIGRAPH.Any(d => StartsWithAt(w, d.Key, i)));

    /** JS `String.prototype.startsWith(search, pos)`; `pos` may run past the end. */
    private static bool StartsWithAt(string w, string search, int i) =>
        i >= 0 && i + search.Length <= w.Length && string.CompareOrdinal(w, i, search, 0, search.Length) == 0;

    // The tone letters that are NEVER onsets (z/x/q/j); ⟨h⟩ is contextual, handled inline.
    private static readonly HashSet<string> TONE_LETTER = new(StringComparer.Ordinal) { "z", "j", "x", "q" };
    // Coda stop letters → PLAIN (unaspirated) stops: b/p→p, d/t→t, g/k→k.
    private static readonly Dictionary<string, string> CODA = new(StringComparer.Ordinal)
    {
        ["b"] = "p", ["p"] = "p", ["d"] = "t", ["t"] = "t", ["g"] = "k", ["k"] = "k", ["m"] = "m", ["n"] = "n",
    };
    // The HIGH vowels {i, u, w=ɯ} form a diphthong offglide; a NON-high vowel after a nucleus is HIATUS.
    private static readonly HashSet<string> HIGH_VOWEL = new(StringComparer.Ordinal) { "i", "u", "w" };

    private static readonly JsRe AE_CODA_NG = JsRegex.Compile("^ng", "u");
    private static readonly JsRe AE_CODA_C = JsRegex.Compile("^[bdgptkmn]", "u");

    /** Phonemize one Zhuang word to canonical IPA (segments + Chao tones). Tones fold in the eval. */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word);
        var @out = new StringBuilder();
        var i = 0;
        // Per-syllable state: nucleus present? a tone already placed? an onset consonant already emitted?
        var sylVowel = false;
        var sylCoda = ""; // "" (open), or "p"/"t"/"k" (checked)
        var toneDone = false;
        var sylHasOnset = false;

        void CloseSyllable()
        {
            if (sylVowel && !toneDone) @out.Append(sylCoda != "" ? TONE["checked"] : TONE["1"]);
            sylVowel = false;
            sylCoda = "";
            toneDone = false;
            sylHasOnset = false;
        }
        // A vowel opening a syllable with NO onset consonant takes a glottal onset [ʔ].
        void OpenVowel()
        {
            if (!sylVowel && !sylHasOnset) @out.Append('ʔ');
        }
        void EmitOnset(string ipa)
        {
            if (sylVowel) CloseSyllable();
            @out.Append(ipa);
            sylHasOnset = true;
        }

        while (i < w.Length)
        {
            var c = w[i].ToString();
            // Tone letters z/j/x/q — always a tone; the syllable is complete.
            if (TONE_LETTER.Contains(c))
            {
                if (sylVowel)
                {
                    @out.Append(TONE[c]);
                    toneDone = true;
                    CloseSyllable();
                }
                i++;
                continue;
            }
            // Apostrophe — an explicit syllable-boundary marker.
            if (c == "'")
            {
                if (sylVowel) CloseSyllable();
                i++;
                continue;
            }
            // h — onset [h] before a vowel; tone-6 marker otherwise.
            if (c == "h")
            {
                if (IsVowelStart(w, i + 1))
                {
                    EmitOnset("h");
                    i++;
                    continue;
                }
                if (sylVowel)
                {
                    @out.Append(TONE["h"]);
                    toneDone = true;
                    CloseSyllable();
                }
                i++;
                continue;
            }
            // CODA-FIRST: a coda-capable consonant not opening a following vowel closes the syllable. This
            // runs BEFORE the onset loop so a boundary cluster like ⟨nd⟩ in Yin|du is split rather than read
            // as the implosive onset.
            if (sylVowel)
            {
                if (StartsWithAt(w, "ng", i) && !IsVowelStart(w, i + 2))
                {
                    @out.Append('ŋ');
                    CloseSyllable();
                    i += 2;
                    continue;
                }
                if (CODA.TryGetValue(c, out var coda) && !IsVowelStart(w, i + 1))
                {
                    @out.Append(coda);
                    if (coda == "p" || coda == "t" || coda == "k") sylCoda = coda;
                    CloseSyllable();
                    i++;
                    continue;
                }
            }
            // Multi-letter onset (mb/nd/ng/ny/gv/by/gy/ngv/mby) — a new syllable onset.
            var matched = false;
            foreach (var (orth, ipa) in ONSETS)
            {
                if (StartsWithAt(w, orth, i) && IsVowelStart(w, i + orth.Length))
                {
                    EmitOnset(ipa);
                    i += orth.Length;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;
            // ⟨ae⟩ → [ai] in an OPEN syllable, short [a] before a CODA.
            if (StartsWithAt(w, "ae", i) && !StartsWithAt(w, "aeu", i))
            {
                if (sylVowel) CloseSyllable();
                OpenVowel();
                var rest = w[(i + 2)..];
                var isCoda =
                    (AE_CODA_NG.IsMatch(rest) && !IsVowelStart(w, i + 4)) ||
                    (AE_CODA_C.IsMatch(rest) && !IsVowelStart(w, i + 3));
                @out.Append(isCoda ? "a" : "ai");
                sylVowel = true;
                i += 2;
                continue;
            }
            // Vowel digraph (aeu/ie/ue/we/oe) — a nucleus; if one is already open this is a new syllable.
            var vmatched = false;
            foreach (var (orth, ipa) in VDIGRAPH)
            {
                if (StartsWithAt(w, orth, i))
                {
                    if (sylVowel) CloseSyllable();
                    OpenVowel();
                    @out.Append(ipa);
                    sylVowel = true;
                    i += orth.Length;
                    vmatched = true;
                    break;
                }
            }
            if (vmatched) continue;
            // Single vowel — a HIGH vowel continues a diphthong; a NON-high vowel after a nucleus is hiatus.
            if (VOWELS.TryGetValue(c, out var v))
            {
                if (sylVowel && !HIGH_VOWEL.Contains(c)) CloseSyllable();
                OpenVowel();
                @out.Append(v);
                sylVowel = true;
                i++;
                continue;
            }
            // Single consonant onset (a coda would have been caught by CODA-FIRST above).
            if (CONS.TryGetValue(c, out var cp))
            {
                EmitOnset(cp);
                i++;
                continue;
            }
            i++; // unknown → skip
        }
        CloseSyllable();
        return @out.ToString();
    }

    // A word (Zhuang Latin letters) / number / SAWNDIP run (CJK ideographs) / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "", "'")})|(\\d+)|([〇㐀-䶿一-鿿豈-﫿\\u{{20000}}-\\u{{2ee5f}}\\u{{2f800}}-\\u{{2fa1f}}\\u{{30000}}-\\u{{3347f}}]+)|([.!?…,;:])",
        "giu");

    /** This language's OWN inventory — the INVENTORY question, not the script-boundary one. */
    private const string NATIVE_CLASS = "[a-z']";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // The normalization pre-pass runs BEFORE tokenization; see Normalize.cs for the ordering.
            Clauses.AssembleClauses(Normalize.NormalizeZhuang(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in ZhuangNumberWords.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    // Sawndip: one glyph = one syllable → look up its reading, phonemize through the za g2p.
                    foreach (var reading in Sawndip.SawndipToReadings(m.Groups[3].Value))
                        sink.Emit(PhonemizeWord(reading));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Zhuang phonemizer (rule g2p + tone letters). */
    public static ILanguage CreateZhuang() => new Engine();

    internal static void RegisterSelf() => Registry.Register("zhuang", CreateZhuang);
}
