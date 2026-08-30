/**
 * Paraguayan Guaraní (gn) phonemizer — Avañe'ẽ, Tupian, the achegety's Latin script, canonical IPA.
 * A longest-match scan over the prenasalized digraphs ⟨mb nd nt⟩→[ᵐb ⁿd ⁿt] (⟨ng⟩→[ŋ]), ⟨ch⟩→[ʃ],
 * the Spanish-style ⟨gu⟩ ([w] before a back vowel, u-silent [ɰ] before a front or central one), then
 * the single graphemes of the 12-vowel system (⟨y⟩→[ɨ] + the six nasal vowels); glide formation and
 * oxytone stress, overridden by an acute accent or drawn to a nasal vowel. Ported from
 * src/languages/guarani/guarani.ts — see that file for the corpus evidence, and the ⟨g̃⟩ letter that
 * completes the four-way approximant paradigm.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Guarani;

public static class GuaraniPhonemizer
{
    private static readonly GuaraniDef DEF = Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> DIGRAPHS => DEF.Digraphs;
    private static IReadOnlyDictionary<string, string> G => DEF.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    /** ⚠ STABLE LENGTH-DESCENDING, like the TS `Object.keys(…).sort((a,b) => b.length - a.length)`:
     *  the sort is stable and the dictionary preserves insertion order, so the tie order is the
     *  declaration order in the jsonc. */
    private static readonly IReadOnlyList<string> ORDER =
        DEF.Digraphs.Keys.OrderByDescending(k => k.Length).ToList();

    private static readonly HashSet<string> ACUTE = new(DEF.AcuteVowels, StringComparer.Ordinal);
    private static readonly HashSet<string> NASAL = new(DEF.NasalVowels, StringComparer.Ordinal);

    /** ⟨gu⟩ is u-silent [ɰ] before a front OR central vowel. */
    private static readonly HashSet<string> FRONT = new(DEF.FrontLetters, StringComparer.Ordinal);

    /**
     * The universal vowel letters PLUS Guaraní's nasal vowels. ⚠ A SET OF SEGMENTS, NOT CHARACTERS:
     * ⟨ɨ̃⟩ is ⟨ɨ⟩ + a combining tilde, so the class only works because this engine compares whole
     * segments rather than characters — the TS says so at length.
     */
    private static readonly HashSet<string> VOWEL = VowelSet();

    private static HashSet<string> VowelSet()
    {
        var v = new HashSet<string>(Ipa.IPA_VOWEL, StringComparer.Ordinal);
        v.Add("ã"); v.Add("ẽ"); v.Add("ĩ"); v.Add("õ"); v.Add("ũ");
        v.Add("\u0268\u0303"); // ɨ̃ — no precomposed codepoint
        return v;
    }

    private static readonly IReadOnlyDictionary<string, string> GLIDE =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["i"] = "j", ["u"] = "w", ["ɨ"] = "j" };
    private static readonly HashSet<string> GLIDE_OUT = new(StringComparer.Ordinal) { "j", "w" };

    private const string TILDE = "\u0303";          // ◌̃ COMBINING TILDE
    private static readonly JsRe PUSO_GLYPHS = JsRegex.Compile("[’ʼ]", "gu");

    /**
     * ⚠ U+0303 IS IN THE CLASS, and it has to be: ⟨g̃⟩ has no precomposed form, so without the mark the
     * nativiser folds the cluster to a bare ⟨g⟩ and the letter is gone before the g2p runs. See the TS.
     */
    private const string NATIVE_CLASS = "[a-zãẽĩõũỹáéíóúýñA-ZÃẼĨÕŨỸÁÉÍÓÚÝÑ'’\u0303]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    /**
     * Phonemize one Guaraní word → canonical IPA: longest-match scan + ⟨gu⟩ context + glide formation +
     * stress. ⚠ CODE-POINT iteration, which equals the TS's code-unit scan because the token class is
     * Latin + ⟨’⟩ + U+0303 — all BMP; an astral letter reaching the scan is where the two would differ.
     */
    public static string PhonemizeWord(string word)
    {
        var w = JsRegex.Replace(Js.ToLowerCase(word.Normalize(NormalizationForm.FormC)), PUSO_GLYPHS, "'");
        var chars = Js.CodePoints(w);
        var segs = new List<string>();
        // Per emitted vowel segment: its segment index + whether its source grapheme was acute / nasal.
        var vseg = new List<(int At, bool Acute, bool Nasal)>();
        var i = 0;
        while (i < chars.Count)
        {
            var c = chars[i];
            // ⟨g̃⟩ AND ⟨g̃u⟩ — the NASAL counterparts of the two branches below, and a LETTER of the
            // achegety in their own right. FIRST, because ⟨g̃u⟩ has to be claimed before the plain ⟨gu⟩
            // test sees its ⟨g⟩.
            if (c == "g" && i + 1 < chars.Count && chars[i + 1] == TILDE)
            {
                var after = i + 2 < chars.Count ? chars[i + 2] : null;
                var vowelAt = i + 3 < chars.Count ? chars[i + 3] : null;
                if (after == "u" && vowelAt is not null && G.TryGetValue(vowelAt, out var gvu) && VOWEL.Contains(gvu))
                {
                    segs.Add(FRONT.Contains(vowelAt) ? "\u0270\u0303" : "w\u0303");
                    i += 3;
                    continue;
                }
                segs.Add("\u0270\u0303");
                i += 2;
                continue;
            }
            // ⟨gu⟩ is Spanish-style: before a back vowel → [w] (gua→wa), before a front vowel → [ɰ]
            // (gue→ɰe, u silent).
            if (c == "g" && i + 1 < chars.Count && chars[i + 1] == "u"
                && i + 2 < chars.Count && G.TryGetValue(chars[i + 2], out var gu) && VOWEL.Contains(gu))
            {
                segs.Add(FRONT.Contains(chars[i + 2]) ? "\u0270" : "w");
                i += 2;
                continue;
            }
            var matched = false;
            foreach (var key in ORDER)
            {
                if (StartsWith(chars, i, key))
                {
                    segs.Add(DIGRAPHS[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;
            // A single grapheme — the vowel marks go to the stress pass, the consonants straight out.
            // ⚠ A LETTER WITH NO GRAPHEME IS DROPPED, as in the TS.
            if (G.TryGetValue(c, out var ph))
            {
                if (VOWEL.Contains(ph)) vseg.Add((segs.Count, ACUTE.Contains(c), NASAL.Contains(c)));
                segs.Add(ph);
            }
            i += 1;
        }
        // Stress nucleus: an acute-accented vowel, else the last nasal vowel (nasality attracts
        // stress), else the final vowel (oxytone).
        var nucleus = -1;
        if (vseg.Count > 0)
        {
            var acute = vseg.FirstOrDefault(v => v.Acute);
            var nasal = vseg.Where(v => v.Nasal).LastOrDefault();
            nucleus = (acute.Acute ? acute : nasal.Nasal ? nasal : vseg[^1]).At;
        }
        // Glide formation: a non-nucleus HIGH vowel (i/u/ɨ) immediately before another vowel → a glide.
        foreach (var v in vseg)
        {
            if (v.At != nucleus && GLIDE.TryGetValue(segs[v.At], out var gl)
                && v.At + 1 < segs.Count && VOWEL.Contains(segs[v.At + 1]))
                segs[v.At] = gl;
        }
        // Stress before the onset of the nuclear syllable: back up over the onset consonant, and over a
        // preceding glide too (a C+glide onset like ⟨ku⟩→[kw] is one syllable: kuéra→ˈkweɾa).
        if (nucleus >= 0)
        {
            var at = nucleus;
            if (at > 0 && !VOWEL.Contains(segs[at - 1])) at--;
            if (at > 0 && GLIDE_OUT.Contains(segs[at]) && !VOWEL.Contains(segs[at - 1])) at--;
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs).Normalize(NormalizationForm.FormC);
    }

    /** TS `w.startsWith(key, i)` over the code-point list. The digraph keys are ASCII, where a UTF-16
     *  unit is a code point. */
    private static bool StartsWith(List<string> chars, int i, string key)
    {
        if (i + key.Length > chars.Count) return false;
        for (var k = 0; k < key.Length; k++)
            if (chars[i + k] != key.AsSpan(k, 1).ToString()) return false;
        return true;
    }

    // A word (Guaraní achegety letters incl. the nasal/accented vowels + the puso ⟨'⟩) / number /
    // punctuation.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'’")})|(\\d+)|([.!?…,;:])", "giu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // Normalize.cs runs BEFORE tokenization — which is where the puso fold has to be, because two
            // of the three glyphs Guaraní writes it with are outside TOKEN and would split the word.
            Clauses.AssembleClauses(Normalize.NormalizeGuarani(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var tok = m.Groups[2].Value;
                    // ≤9 digits stays inside the attested range (< 10⁹); longer reads the raw digit string.
                    var words = tok.Length <= 9
                        ? Numbers.NumberToWords(Js.Number(tok), tok)
                        : Numbers.ReadDigits(tok);
                    foreach (var wd in words.Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk)) sink.Pause(mk);
                }
            });
    }

    /** Build the Guaraní phonemizer (direct near-phonemic g2p + prenasalized digraphs +
     *  oxytone/accent stress). */
    public static ILanguage CreateGuarani() => new Engine();

    internal static void RegisterSelf() => Registry.Register("guarani", () => CreateGuarani());
}
