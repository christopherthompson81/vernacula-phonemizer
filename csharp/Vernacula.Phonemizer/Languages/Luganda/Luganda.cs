/**
 * Luganda / Oluganda (lg) phonemizer — Bantu (Great Lakes, JE15), the Latin orthography, canonical IPA. A
 * greedy longest-match scan over the grapheme table with two code rules: CONSONANT GEMINATION (a doubled
 * consonant is [Cː]) and VOWEL LENGTHENING before a prenasalised consonant (Buganda→buɡaːⁿda). Tone (3-way
 * H/L/falling) is lexical + unwritten → DEFERRED.
 * Ported from src/languages/luganda/luganda.ts — see that file for the corpus evidence and for the referee's
 * circularity (epitran lug-Latn is itself rule-based).
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Luganda;

public sealed class LugandaPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private static readonly HashSet<string> VOWEL_LETTERS =
        new(Manifest.MANIFEST.VowelLetters, StringComparer.Ordinal);

    /** ⟨ng'⟩/⟨ny⟩ + the syllabic-nasal prefix ⟨n'⟩ — must be matched BEFORE the general prenasalisation
     *  rule, or ⟨ng'⟩ reads as ᵑ + g rather than the velar nasal. */
    private static readonly string[] SPECIAL = ["nng'", "ng'", "nny", "ny", "n'"];

    /** A nasal prenasalises a following obstruent (epitran's set): b p f v t d c j k g — NOT s z. */
    private static readonly HashSet<string> PRENASAL =
        new(Manifest.MANIFEST.Prenasalisable, StringComparer.Ordinal);

    /** The multi-letter grapheme keys the greedy step handles: labialisation ⟨Cw⟩ + the vowel-length
     *  digraphs. ⚠ THE PRENASAL DIGRAPHS (mb, nd…) ARE EXCLUDED — the prenasalisation rule handles them, and
     *  it is what keeps a following ⟨w⟩ reachable (ndw → ⁿdʷ). */
    private static readonly string[] OTHER_DIGRAPHS = Manifest.GRAPHEME_KEYS
        .Where(k => k.Length == 2 && (k[1] == 'w'
            || (VOWEL_LETTERS.Contains(k[0].ToString()) && VOWEL_LETTERS.Contains(k[1].ToString()))))
        .ToArray();

    /** A vowel before a prenasalised consonant (superscript nasal ᵐ ⁿ ᵑ) is lengthened. */
    private static readonly JsRe PRENASAL_LENGTHEN = JsRegex.Compile("([aeiou])(?=[ᵐⁿᵑ])", "g");

    /** One Luganda word → canonical IPA (segmental; gemination + prenasal lengthening; non-tonal here). */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word);
        var outp = new StringBuilder();
        var i = 0;
        while (i < w.Length)
        {
            // 1. ⟨ng'⟩/⟨nny⟩/⟨ny⟩/⟨n'⟩ — before the prenasalisation rule
            var sp = SPECIAL.FirstOrDefault(k => StartsWithAt(w, k, i));
            if (sp is not null)
            {
                outp.Append(G.TryGetValue(sp, out var g) ? g : "ⁿ");
                i += sp.Length;
                continue;
            }
            var c = w[i];
            // 2. PRENASALISATION: ⟨n m⟩ + an obstruent → a place-assimilated superscript nasal; the
            //    obstruent is then scanned normally, so its labialisation and gemination survive.
            if ((c == 'n' || c == 'm') && PRENASAL.Contains(i + 1 < w.Length ? w[i + 1].ToString() : ""))
            {
                var x = w[i + 1];
                outp.Append("bpfv".Contains(x) ? "ᵐ"
                    : "kg".Contains(x) ? "ᵑ" : "ⁿ");
                i += 1;
                continue;
            }
            // 3. ⟨Cw⟩ labialisation + the vowel-length digraphs
            var dg = OTHER_DIGRAPHS.FirstOrDefault(k => StartsWithAt(w, k, i));
            if (dg is not null) { outp.Append(G[dg]); i += 2; continue; }
            // 4. consonant gemination: a doubled consonant letter → geminate [Cː]
            var single = c.ToString();
            var hasSingle = G.TryGetValue(single, out var sv) && sv.Length > 0;
            if (!VOWEL_LETTERS.Contains(single) && i + 1 < w.Length && w[i + 1] == c && hasSingle)
            {
                outp.Append(sv).Append('ː');
                i += 2;
                continue;
            }
            // 5. single grapheme (or skip unknown)
            if (hasSingle) outp.Append(sv);
            i += 1;
        }
        return PRENASAL_LENGTHEN.Replace(outp.ToString(), "$1ː");
    }

    private static bool StartsWithAt(string s, string key, int i) =>
        i <= s.Length - key.Length && string.CompareOrdinal(s, i, key, 0, key.Length) == 0;

    // A word (Luganda letters incl. ŋ and the ⟨ng'⟩ apostrophe) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'’")})|(\\d+)|([.!?…,;:])", "giu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: TOKEN decides where the SCRIPT
     * boundary falls (routing); this class decides whether the g2p has rules for these letters.
     * ⚠ ŋ IS DELIBERATELY ABSENT because the g2p has no rule for it — BUT THE TS COMMENT'S "drops it
     * outright" IS TRUE ONLY OF `PhonemizeWord`. On this path the nativiser folds ŋ→n first, so `ŋŋamba`
     * reads *nːaːᵐba* rather than losing the letter (#1131). Both engines do it; do not "fix" it here.
     */
    private const string NATIVE_CLASS = "[a-z'’]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");
    private static readonly JsRe CURLY_APOSTROPHE = JsRegex.Compile("’", "gu");

    public string Text(string input) =>
        // NORMALIZATION FIRST — see Normalize.cs. Every unit and currency reading lives there rather than on
        // the shared symbol tier, because Luganda puts the measure noun BEFORE its number and the tier can
        // only POSTPOSE.
        Clauses.AssembleClauses(Normalize.NormalizeLuganda(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(CURLY_APOSTROPHE.Replace(Nat(m.Groups[1].Value), "'")));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
            }
        });

    /** Build the Luganda phonemizer (greedy g2p + gemination + the cardinal compositor; tone deferred). */
    public static ILanguage CreateLuganda() => new LugandaPhonemizer();

    internal static void RegisterSelf() => Registry.Register("luganda", CreateLuganda);
}
