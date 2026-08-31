/**
 * Luo / Dholuo (luo) phonemizer — Western Nilotic (Luo group), the Latin orthography, canonical IPA.
 * A greedy longest-match scan over the grapheme table (Luo.jsonc) with ONE code rule: a high vowel ⟨i u⟩
 * before another vowel becomes the glide ⟨j w⟩ (dhiang'→ðjaŋ, chieng'→t͡ʃjeŋ). Signatures: the DENTAL vs
 * ALVEOLAR contrast (⟨th dh⟩→θ ð vs ⟨t d⟩→t d); PRENASALISED voiced stops as single units (mb→ᵐb, nd→ⁿd,
 * nj→ⁿd͡ʒ, ng→ᵑɡ); ⟨ng'⟩→ŋ vs ⟨ng⟩→ᵑɡ; ⟨ny⟩→ɲ; the palatals ⟨ch⟩→t͡ʃ, ⟨j⟩→d͡ʒ; ⟨r⟩→ɾ.
 *
 * Ported from src/languages/luo/luo.ts — see that file for the corpus evidence. The 9-vowel ±ATR distinction
 * and register TONE (H/L) are UNWRITTEN in this orthography, so both are emitted at a +ATR/toneless default.
 * This file owns the ⟨ng'⟩ apostrophe + citation-accent normalisation (so the glottalized units match) and
 * the conservative high-vowel glide; the unit/letter tables live in luo.jsonc.
 */
using System.Text;
using System.Globalization;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Luo;

public sealed class LuoPhonemizer : ILanguage
{
    private static readonly IReadOnlyDictionary<string, string> G = Manifest.MANIFEST.Graphemes;
    private static readonly IReadOnlyDictionary<string, string> CLAUSE_MARK = Manifest.MANIFEST.ClausePunctuation;

    /** The ⟨ng'⟩ apostrophe in its two non-ASCII forms (’ U+2019 / ʼ U+02BC) → ASCII '. */
    private static readonly JsRe APOSTROPHE = JsRegex.Compile("[\u2019\u02bc]", "gu");
    /** The combining marks NFD leaves behind a tone-marked citation vowel. */
    private static readonly JsRe COMBINING = JsRegex.Compile("[\u0300-\u036f]", "gu");

    /** Phonemize a single Dholuo word to canonical IPA (segmental; +ATR/toneless default — ATR + tone are
     *  unwritten). A tone-marked citation spelling (chíeng', à) is normalised to its base letters first — the
     *  orthography proper is unaccented, and we emit no tone. */
    public static string PhonemizeWord(string word)
    {
        // Normalise the ⟨ng'⟩ apostrophe (’ / ʼ → ASCII ') and strip tone-marked citation accents.
        var w = COMBINING.Replace(
            Js.Normalize(APOSTROPHE.Replace(Js.ToLowerCase(word), "'"), NormalizationForm.FormD), "");
        var outp = new StringBuilder();
        var i = 0;
        while (i < w.Length)
        {
            var c = w[i].ToString();
            var nx = i + 1 < w.Length ? w[i + 1].ToString() : "";
            // GLIDE: ⟨i⟩ before a following ⟨a⟩/⟨e⟩ is the palatal glide [j] (dhiang'→ðjaŋ, chieng'→t͡ʃjeŋ — the
            // only environment the referee attests). Deliberately CONSERVATIVE: ⟨u⟩+V (would give dholuo→ðolwo,
            // but the endonym is the trisyllabic /ðoluo/) and ⟨i⟩ before a high/back vowel are left as HIATUS.
            if (c == "i" && (nx == "a" || nx == "e"))
            {
                outp.Append('j');
                i += 1;
                continue;
            }
            // greedy longest-match grapheme (ng' → the two-letter digraphs → singles); skip an unknown char
            var matched = false;
            foreach (var key in Manifest.GRAPHEME_KEYS)
            {
                // JS `w.startsWith(key, i)` — the bounds test comes first: CompareOrdinal with a length past
                // the end of `w` compares only what is there, so testing it afterwards is too late.
                if (i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0)
                {
                    outp.Append(G[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            if (!matched) i += 1;
        }
        return outp.ToString();
    }

    /** The ⟨ng'⟩ apostrophe in all three encodings — the word arm must accept it as a letter. */
    private const string WORD_EXTRA = "'" + "\u2019" + "\u02bc";

    /** A word (Dholuo letters + the ⟨ng'⟩ apostrophe in all three common forms) / number / punctuation token. */
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.HostWordRun(new[] { "Latin" }, WORD_EXTRA)})|(\\d+)|([.!?…,;:])", "giu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
     * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters.
     * A token this class REJECTS carries a letter the language does not use — i.e. a foreign name.
     */
    private const string NATIVE_CLASS = "[a-zàáâãäèéêëìíîïòóôõöùúûü'\u2019\u02bc]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input)
    {
        // normalizeLuo FIRST — its de-grouping, currency, range, clock and decimal steps all need the figures
        // intact and the marks unspent, and every mark it consumes (`,` `.` `:` `-`) is one this TOKEN would
        // otherwise hand to CLAUSE_MARK as a phrase break mid-number.
        return Clauses.AssembleClauses(Normalize.NormalizeLuo(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            // numbers: composed to Dholuo words (decimal + the gi-elision), then the same g2p
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var tok = m.Groups[2].Value;
                foreach (var wd in Numbers.NumberToWords(Js.Number(tok), tok).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Luo (Dholuo) phonemizer (greedy g2p + glide; decimal numbers; ATR + tone deferred). */
    public static ILanguage CreateLuo() => new LuoPhonemizer();

    // The TS registry imports `createLuo` statically; the C# port has no such import, so the module
    // registers itself — from Languages/Bootstrap.cs, not a [ModuleInitializer].
    internal static void RegisterSelf() => Registry.Register("luo", CreateLuo);
}
