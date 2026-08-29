/**
 * Cherokee (chr) phonemizer — a deterministic per-character lookup over the 85-char syllabary, canonical
 * IPA. This file BUILDS the char → IPA table from the ordered syllable values (U+13A0 + index) and folds
 * the Supplement lowercase block on via ToUpperInvariant. The syllable list, onset/vowel values and the
 * encyclopedic record (the shallow-skeleton caveat, referees) live in cherokee.jsonc.
 *
 * ⚠ THE SYLLABARY IS A SHALLOW PHONEMIC SKELETON: it does not differentiate aspiration (except in the
 * split cells ga/ka, da/ta, de/te, di/ti, dla/tla), and never marks tone, vowel length, the glottal stop
 * or the intrusive /h/. The engine recovers the SEGMENTAL melody only; the rest is the disclosed folded
 * residual.
 * Ported from src/languages/cherokee/cherokee.ts.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Cherokee;

public static class CherokeePhonemizer
{
    /**
     * The char → IPA table, built from the ordered values (U+13A0 + index) exactly as the TS builds it —
     * the syllabary's own order is the only index, so a mis-transcribed table is impossible by construction.
     */
    private static readonly IReadOnlyDictionary<string, string> CHAR_IPA = BuildTable();

    private static Dictionary<string, string> BuildTable()
    {
        var syllables = Manifest.MANIFEST.Syllables;
        var onset = Manifest.MANIFEST.Onsets;
        var vowel = Manifest.MANIFEST.Vowels;
        var table = new Dictionary<string, string>(StringComparer.Ordinal);
        for (var idx = 0; idx < syllables.Count; idx++)
        {
            var syl = syllables[idx];
            var ch = char.ConvertFromUtf32(0x13A0 + idx);
            if (syl == "s") { table[ch] = "s"; continue; }
            if (syl == "nah") { table[ch] = "na"; continue; } // obsolete; now written ⟨na⟩ (grammar §4)
            var v = syl[^1..];                                // the vowel is always the last character
            var on = syl[..^1];
            table[ch] = (onset.TryGetValue(on, out var o) ? o : "") + (vowel.TryGetValue(v, out var vv) ? vv : "");
        }
        // CHEROKEE LETTER MV (U+13F5). Montgomery-Anderson (p.95) calls /mv/ "the non-existent sound" — "the
        // only gap in the table" — but Unicode encodes the character and the referees attest it, so it is
        // mapped pragmatically to [mə̃] rather than dropped. The Supplement lowercase ꮿ uppercases here too.
        table["Ᏽ"] = "m" + (vowel.TryGetValue("v", out var mv) ? mv : "");
        return table;
    }

    /** One Cherokee syllabary word → canonical IPA (segmental skeleton; tone/length/aspiration/glottal
     *  unwritten). */
    public static string PhonemizeWord(string word)
    {
        // ⚠ Fold the Cherokee Supplement lowercase (U+AB70–ABBF, and U+13F8–13FD) onto the main block, then
        // look up each character. `ToUpperInvariant` was checked against JS `toUpperCase()` across all 86
        // lowercase codepoints before this was written — an unfolded character looks up to nothing and is
        // SILENTLY DROPPED, which is the whole reason the fold is here.
        var t = word.ToUpperInvariant();
        var outp = new StringBuilder();
        foreach (var ch in Js.CodePoints(t))
            if (CHAR_IPA.TryGetValue(ch, out var ipa)) outp.Append(ipa);
        return outp.ToString().Normalize(NormalizationForm.FormC);
    }

    // Cherokee syllabary (main block + Supplement) / number / punctuation.
    private static readonly JsRe TOKEN = JsRegex.Compile("([Ꭰ-Ᏽꭰ-ꮿ]+)|(\\d+)|([.?!,;:…])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // ⚠ NORMALIZE BEFORE TOKENIZING, and after NFC — Normalize.cs matches ASCII separators around
            // digits, so it must see the same string the tokenizer will. Its whole job is to spend marks
            // that `[.?!,;:…]` would otherwise read as clause punctuation INSIDE a number.
            var prepared = Normalize.NormalizeCherokee(Rewriter.Renormalize(input, NormalizationForm.FormC));
            return Clauses.AssembleClauses(prepared, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
            });
        }
    }

    /** Build the Cherokee phonemizer (syllabary → phonemic segmental IPA; Montgomery-Anderson-grounded). */
    public static ILanguage CreateCherokee() => new Engine();

    internal static void RegisterSelf() => Registry.Register("cherokee", CreateCherokee);
}
