/**
 * Georgian / ქართული (ka) phonemizer — Kartvelian, the Mkhedruli script, canonical IPA (~4M speakers).
 * Georgian orthography is essentially ONE-LETTER-ONE-PHONEME (a transparent alphabet, no digraphs), so the
 * g2p is a greedy longest-match scan over the 33-letter grapheme table + ONE context rule (word-final
 * voiced stop devoicing ბ/დ/გ→pʰ/tʰ/kʰ). Signatures: the three-way stop/affricate contrast VOICED /
 * ASPIRATED / EJECTIVE (ბ b · ფ pʰ · პ pʼ), uvulars ღ=ʁ, ხ=χ, ყ=qʼ, and 5 vowels a ɛ i ɔ u. Stress is
 * weak/non-contrastive → not marked. Numbers are VIGESIMAL, composed by Numbers.cs.
 * Ported from src/languages/georgian/georgian.ts — see that file for the referee evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Georgian;

public static class GeorgianPhonemizer
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /**
     * WORD-FINAL DEVOICING: a word-final voiced STOP devoices to its aspirated voiceless counterpart. The
     * ONLY context rule in the Georgian g2p — categorical in the 20,894-word wikipron referee (final ⟨დ⟩→tʰ
     * 1584/1585, ⟨ბ⟩→pʰ 100/101, ⟨გ⟩→kʰ 11/12); the voiced fricatives/affricates (ვ ზ ღ ძ ჯ) do NOT devoice
     * finally. Keyed by the single output char b/d/ɡ, which can only come from a final ⟨ბ დ გ⟩ (⟨ღ⟩→ʁ,
     * never ɡ).
     */
    private static readonly IReadOnlyDictionary<string, string> FINAL_DEVOICE =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["b"] = "pʰ", ["d"] = "tʰ", ["ɡ"] = "kʰ" };

    /** Phonemize a single Georgian word to canonical IPA (segmental + word-final stop devoicing). */
    public static string PhonemizeWord(string word)
    {
        // ⚠ Mkhedruli is caseless, but MTAVRULI titlecase (U+1C90–1CBF, used for all-caps headings) must be
        // lowercased to the Mkhedruli block the table keys on — else those codepoints miss the scan and are
        // silently dropped. Verified against JS across all 48 Mtavruli codepoints before this was written.
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var outp = new StringBuilder();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in Manifest.GRAPHEME_KEYS)
            {
                if (i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0)
                {
                    outp.Append(G[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            // ⚠ NOT SILENTLY: a letter with no grapheme rule here still denotes a sound, and dropping it
            // deletes what the writer typed. Consulted only on the MISS branch, after every grapheme has
            // been tried, so it can never override a reading this language has an opinion about.
            if (!matched)
            {
                outp.Append(LatinPhones.LatinPhone(w[i].ToString(), new PhoneOpts { Initial = i == 0, IncludeH = true }) ?? "");
                i += 1;
            }
        }
        var res = outp.ToString();
        if (res.Length > 0)
        {
            var last = res[^1..];
            if (FINAL_DEVOICE.TryGetValue(last, out var dev)) res = res[..^1] + dev;
        }
        return res;
    }

    // A word (Mkhedruli letters) / number / punctuation token. ჻ = the Georgian paragraph separator.
    // ⚠ Georgian SCRIPT only (was \p{L}, which claimed embedded Latin and then phonemized it to nothing — a
    // silent drop). Narrowing it lets the shared unclaimed-run pass read Latin as foreign instead.
    private static readonly JsRe TOKEN =
        JsRegex.Compile("([\\p{Script=Georgian}\\p{M}]+)|(\\d+)|([.!?…,;:჻])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // NORMALIZE FIRST — a pure text→text pass (Normalize.cs) that turns everything the TOKEN cannot
            // read into Georgian words: the case suffix glued to a figure, the ordinal circumfix, the clock,
            // %, °C, the unit abbreviations, the era markers, currency and the signs. NFC first, because that
            // pass matches Mkhedruli literals and the g2p NFCs anyway.
            var prepared = Normalize.NormalizeGeorgian(Rewriter.Renormalize(input, NormalizationForm.FormC));
            return Clauses.AssembleClauses(prepared, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Georgian phonemizer (greedy g2p + the vigesimal number compositor; stress not marked). */
    public static ILanguage CreateGeorgian() => new Engine();

    internal static void RegisterSelf() => Registry.Register("georgian", CreateGeorgian);
}
