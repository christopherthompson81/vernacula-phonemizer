/**
 * Ewe (ee) phonemizer — a near-phonemic longest-match scan, canonical IPA. Ported from
 * src/languages/ewe/ewe.ts. This file owns the allophony: the ⟨r⟩ [l]~[r] split (post-consonant [l]), the
 * ⟨w⟩ [w]/[ɰ] rounding rule, and the nasalization-tilde handling on both combining and precomposed vowels.
 * The digraph/letter tables and the encyclopedic record live in ewe.jsonc.
 *
 * TONE (H/M/L) is UNMARKED in the orthography, so none is emitted — the Akan/Shona unwritten-tone
 * situation, with a tone lexicon deferred.
 *
 * ⚠ SINGLE-SOURCE-FAMILY: kaikki and wikipron are the only referees and both derive from Wiktionary, so
 * their agreement is not two independent confirmations.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ewe;

public static class EwePhonemizer
{
    private static readonly EweDef DEF = Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> DIGRAPH => DEF.Digraphs;
    private static IReadOnlyDictionary<string, string> G => DEF.Letters;

    private const string TILDE = "\u0303";     // ◌̃ COMBINING TILDE — Ewe's written nasalization
    private const string VOWEL_BASES = "aeiouɛɔ";

    /** ⚠ NFD INSIDE THE TEST, so a PRECOMPOSED nasal vowel (ã ẽ ĩ õ ũ) decomposes and its BASE is still
     *  recognised as a vowel. `some`, not `every` — a segment is a vowel if it contains one. */
    private static bool IsVowelSeg(string? s) =>
        s is not null && Js.CodePoints(s.Normalize(NormalizationForm.FormD))
            .Any(c => VOWEL_BASES.Contains(c, StringComparison.Ordinal));

    /** Phonemize one Ewe word → canonical IPA: longest-match scan (nasalization tilde kept, tone dropped). */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var chars = Js.CodePoints(w);
        var segs = new List<string>();
        var i = 0;
        while (i < chars.Count)
        {
            // Two-letter digraph? (gb kp dz ts ny — longest-match first.)
            if (i + 1 < chars.Count && DIGRAPH.TryGetValue(chars[i] + chars[i + 1], out var dg))
            {
                segs.Add(dg); i += 2; continue;
            }
            var c = chars[i];
            // ⟨r⟩ is [l] after a consonant (an onset cluster — Ewe /l/~/r/ allophony, "[l] follows
            // velar/alveolar consonants", Jalloh), else [r] (word-initial, after a vowel — mostly loans).
            if (c == "r")
            {
                segs.Add(segs.Count == 0 || IsVowelSeg(segs[^1]) ? "r" : "l");
                i += 1; continue;
            }
            // ⟨w⟩ is the ROUNDED [w] before a rounded vowel (o u ɔ), the unrounded velar approximant [ɰ]
            // before an unrounded one (Jalloh's rounding allophony; ⟨ɣ⟩ is always [ɰ]). A post-consonant ⟨w⟩
            // is a labialization glide → [w] (loan Cw, e.g. kwasiɖa). The referee generalizes [ɰ].
            if (c == "w")
            {
                // ⚠ THE FIRST UTF-16 UNIT of the next character's NFD, which is what JS `.normalize()[0]`
                // gives — a base letter for a precomposed vowel, and a lone high surrogate for an astral
                // character (which then matches no rounded vowel, exactly as in the TS).
                var next = i + 1 < chars.Count ? chars[i + 1].Normalize(NormalizationForm.FormD) : null;
                var nb = next is { Length: > 0 } ? next[0].ToString() : null;
                var afterConsonant = segs.Count > 0 && !IsVowelSeg(segs[^1]);
                segs.Add(afterConsonant || (nb is not null && "ouɔ".Contains(nb, StringComparison.Ordinal))
                    ? "w" : "ɰ");
                i += 1; continue;
            }
            // A base letter, possibly carrying a combining nasalization tilde (U+0303) — keep the tilde,
            // drop tone (acute/grave/… — the orthography doesn't write tone anyway).
            if (G.TryGetValue(c, out var g))
            {
                var nasal = i + 1 < chars.Count && chars[i + 1] == TILDE;
                segs.Add(nasal ? (g + TILDE).Normalize(NormalizationForm.FormC) : g);
                if (nasal) i += 1;
                i += 1; continue;
            }
            // A precomposed letter carrying a mark (ã ẽ ɛ̃ é à ç ý …): decompose, map the BASE with Ewe's own
            // value for that letter, and keep only the nasalization tilde.
            // ⚠ THE BASE NEED NOT BE A VOWEL. This branch used to require the base be in "aeiouɛɔ", which was
            // a restatement of "the tilde only nasalises a vowel" in the wrong place — it also threw away
            // every marked CONSONANT, whose base letter Ewe reads perfectly well: `Podobský` → *podobsk
            // (⟨y⟩ = /j/ is in the table), `Française` → *flanaise (⟨c⟩ = /t͡s/ is too). The vowel test
            // belongs on the TILDE, which is where it is, and this branch does what it says.
            var nfd = Js.CodePoints(Js.Normalize(c, NormalizationForm.FormD));
            var bas = nfd[0];
            if (G.TryGetValue(bas, out var gb))
            {
                var nasal = nfd.Contains(TILDE) && VOWEL_BASES.Contains(bas, StringComparison.Ordinal);
                segs.Add((gb + (nasal ? TILDE : "")).Normalize(NormalizationForm.FormC));
                i += 1; continue;
            }
            // Still nothing: a letter from an alphabet Ewe does not use at all (ñ, ß, æ). The shared table
            // names the phone the letter denotes rather than dropping it — ⟨ñ⟩ → /ɲ/, which Ewe has (⟨ny⟩)
            // and which ewe.jsonc therefore claims one branch earlier.
            var ph = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
            if (ph is not null) { segs.Add(ph); i += 1; continue; }
            i += 1; // unmapped (a stray combining mark of its own, punctuation) — drop
        }
        return string.Concat(segs).Normalize(NormalizationForm.FormC);
    }

    /**
     * An Ewe word (Latin + ɖ Ɖ ƒ ʋ ɣ ŋ ɔ ɛ + combining marks) / number / punctuation.
     *
     * ⚠ THE COMBINING RANGE U+0300–U+036F IS IN THE WORD CLASS, and the input is NFD-normalised in Text()
     * so a precomposed nasal or toned vowel (ã ẽ … á à) decomposes into a base this class admits plus a mark
     * this range captures. Without it the word would END at the vowel.
     */
    private static readonly JsRe TOKEN = JsRegex.Compile(
        @"([a-zɖƒʋɣŋɔɛA-ZƉƑƲƔŊƆƐ\u0300-\u036f']+)|(\d+)|([.!?…,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // Normalize.cs runs FIRST — it is a pre-tokenizer text→text pass, and its opening step folds the
            // homoglyphs (Ð Đ → Ɖ, Ƞ → Ŋ, U+0342 → U+0303) that TOKEN cannot see. NFD after it, so the
            // folded ⟨ã⟩ decomposes into a base the token class admits plus a mark in the U+0300–U+036F range.
            Clauses.AssembleClauses(
                Rewriter.Renormalize(Normalize.NormalizeEwe(input), NormalizationForm.FormD), TOKEN,
                (m, sink) =>
                {
                    if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                        sink.Emit(PhonemizeWord(m.Groups[1].Value));
                    // Numbers: composed to Ewe words (Numbers.cs: the wui-/bla- decimal), then through the
                    // same scan. ⚠ THE RAW TOKEN GOES ALONG, so the ≥10⁹ digit-by-digit arm reads the digits
                    // the text wrote rather than a double that has already lost them.
                    else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    {
                        var tok = m.Groups[2].Value;
                        foreach (var wd in Numbers.NumberToWords(Js.Number(tok), tok).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                    }
                    else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                        sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? "." : ",");
                });
    }

    /** Build the Ewe phonemizer (near-phonemic Gbe scan; toneless). */
    public static ILanguage CreateEwe() => new Engine();

    internal static void RegisterSelf() => Registry.Register("ewe", CreateEwe);
}
