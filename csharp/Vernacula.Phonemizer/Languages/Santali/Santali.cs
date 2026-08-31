/**
 * Santali (sat) phonemizer — a grapheme scan over Ol Chiki + the sign rules, canonical IPA. This file
 * owns the sign machinery: ⟨ᱷ OH⟩ aspirating the preceding stop, ⟨ᱹ GAAHLAA⟩ vowel modification,
 * ⟨ᱸ MU⟩ / ⟨ᱺ MU-GAHLA⟩ nasalization, ⟨ᱻ RELAA⟩ vowel LENGTH, ⟨ᱼ PHAARKAA⟩ / ⟨ᱽ AHAD⟩ checking, and the
 * hallmark WORD-FINAL voiced-stop checking rule with its AHAD block. The letter values and the
 * substitution tables live in santali.jsonc (Manifest).
 * Ported from src/languages/santali/santali.ts — see that file for the corpus evidence, for the RELAA
 * sourcing, and for why the English-ordinal arm exists.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Santali;

public static class SantaliPhonemizer
{
    private static IReadOnlyDictionary<string, string> BASE => Manifest.DEF.Letters;
    private static IReadOnlyDictionary<string, string> CHECKED => Manifest.DEF.Checked;
    private static IReadOnlyDictionary<string, string> ASPIRATE => Manifest.DEF.Aspirated;
    private static IReadOnlyDictionary<string, string> GAHLA => Manifest.DEF.Gahla;

    // Ol Chiki digits ᱐-᱙ (U+1C50–1C59) → ASCII, so an Ol-Chiki-numeral token composes exactly like a
    // Western one.
    private const string OL_CHIKI_DIGITS = "᱐᱑᱒᱓᱔᱕᱖᱗᱘᱙";

    private static string ToAsciiDigits(string s)
    {
        var sb = new StringBuilder();
        foreach (var c in Js.CodePoints(s))
        {
            var i = c.Length == 1 ? OL_CHIKI_DIGITS.IndexOf(c[0]) : -1;
            sb.Append(i >= 0 ? Js.NumberToString(i) : c);
        }
        return sb.ToString();
    }

    private const string OH = "ᱷ", GAHLA_SIGN = "ᱹ", MU = "ᱸ", MU_GAHLA = "ᱺ",
                         RELAA = "ᱻ", PHAARKAA = "ᱼ", AHAD = "ᱽ";

    /** A vowel NUCLEUS test that survives nasalization/length (NFD so ã→a+◌̃ still counts). */
    private static bool IsVowelSeg(string s) =>
        Js.CodePoints(Js.Normalize(s, NormalizationForm.FormD)).Any(c => Ipa.IPA_VOWEL.Contains(c));

    private static readonly JsRe HAS_SPACE = JsRegex.Compile("\\s", "u");
    private static readonly JsRe WS_RUN = JsRegex.Compile("\\s+", "gu");

    /**
     * Phonemize a Santali (Ol Chiki) word → canonical IPA. A multi-word phrase (spaces, as some referee
     * headwords are) is split so word-final checking applies to EACH word's last stop.
     */
    public static string PhonemizeWord(string word)
    {
        var trimmed = Js.Trim(word);
        if (HAS_SPACE.IsMatch(trimmed))
            return string.Join(" ", WS_RUN.Re.Split(trimmed).Select(PhonemizeWord));

        var chars = Js.CodePoints(Js.Normalize(word, NormalizationForm.FormC));
        var segs = new List<string>();
        var ahadAt = -1; // index of a segment marked plain by a trailing ⟨ᱽ AHAD⟩ (blocks final checking)
        // ⚠ `segs[segs.length - 1]` IS `undefined` ON AN EMPTY LIST IN JS, AND EVERY BRANCH BELOW RELIES
        // ON THAT. `segs[^1]` would throw instead, so a word that OPENS with a sign — a bare ⟨ᱷ⟩, ⟨ᱹ⟩,
        // ⟨ᱻ⟩ — would crash where the TS reads it. Modelled as a nullable accessor, once, rather than
        // guarded at each of the six call sites.
        string? Last() => segs.Count > 0 ? segs[^1] : null;

        foreach (var ch in chars)
        {
            if (BASE.TryGetValue(ch, out var b) && ch != OH) { segs.Add(b); continue; }
            if (ch == OH) // aspirate the preceding stop, else [h]
            {
                var l = Last();
                if (l is not null && ASPIRATE.TryGetValue(l, out var asp)) segs[^1] = asp;
                else segs.Add("h");
                continue;
            }
            if (ch == GAHLA_SIGN)
            {
                var l = Last();
                if (l is not null && GAHLA.TryGetValue(l, out var g)) segs[^1] = g;
                continue;
            }
            if (ch == MU || ch == MU_GAHLA) // nasalize; ⟨ᱺ MU-GAHLA⟩ ALSO lowers the vowel (ᱮᱺ→ɛ̃)
            {
                var l = Last();
                if (ch == MU_GAHLA && l is not null && GAHLA.TryGetValue(l, out var lowered))
                {
                    segs[^1] = lowered;
                    l = lowered;
                }
                if (l is not null && Ipa.IPA_VOWEL.Contains(l))
                    segs[^1] = Js.Normalize(l + "̃", NormalizationForm.FormC);
                continue;
            }
            if (ch == RELAA) // ⟨ᱻ RELAA⟩ LENGTHENS the preceding vowel — see the TS block comment
            {
                var l = Last();
                if (l is not null && IsVowelSeg(l) && !l.EndsWith("ː", StringComparison.Ordinal))
                    segs[^1] = l + "ː";
                continue;
            }
            if (ch == PHAARKAA)
            {
                var l = Last();
                if (l is not null && CHECKED.TryGetValue(l, out var chk)) segs[^1] = chk;
                continue;
            }
            // ⟨ᱽ AHAD⟩ marks the preceding stop PLAIN/released — before a consonant a bare separator
            // (ᱫᱽᱨ→dr), word-finally it BLOCKS the checking rule (ᱨᱳᱜᱽ→roɡ, not rokʼ).
            if (ch == AHAD) { ahadAt = segs.Count - 1; continue; }
            // digits / punctuation / unmapped signs: handled by Text() or dropped
        }

        // ⚠ Santali hallmark: a WORD-FINAL voiced stop is CHECKED/glottalized (dak→dakʼ, met→metʼ) — but
        // NOT when marked plain by a trailing ⟨ᱽ AHAD⟩, and only in a real syllable (a lone-consonant
        // citation like ⟨ᱵ⟩ stays [b]).
        var fin = Last();
        if (fin is not null && Manifest.VOICED_STOP.Contains(fin) && ahadAt != segs.Count - 1
            && segs.Any(IsVowelSeg))
            segs[^1] = CHECKED[fin];

        return Js.Normalize(string.Concat(segs), NormalizationForm.FormC);
    }

    /**
     * A Santali word (Ol Chiki letters + signs U+1C5A–1C7D) / an ASCII-digit ENGLISH ORDINAL / a number
     * (Ol Chiki or ASCII digits) / punctuation.
     *
     * ⚠ THE ORDINAL ARM EXISTS BECAUSE THIS TOKENIZER WAS CUTTING AN ENGLISH EXPRESSION IN HALF — `1st`
     * read as *mitʼ stɹˈiːt*, the numeral arm claiming the `1` and the orphaned `st` expanding to STREET.
     * See the TS for the seven instances and the argument.
     */
    private static readonly JsRe TOKEN = JsRegex.Compile(
        "([ᱚ-ᱽ]+)|(\\d+(?:st|nd|rd|th)(?![\\p{sc=Latn}]))|([᱐-᱙]+|\\d+)|([.!?…,;:᱾᱿])", "gu");

    /** The trailing Latin ordinal suffix, stripped to leave the digits — TS `m[2].replace(/\D+$/u, "")`. */
    private static readonly JsRe ORDINAL_TAIL = JsRegex.Compile("\\D+$", "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // ⚠ THE NORMALIZATION PASS RUNS FIRST, and for this language it is not mainly a number layer:
            // sat.wikipedia types ⟨ᱹ GAAHLAA⟩ as an ASCII PERIOD and ⟨ᱼ PHAARKAA⟩ as an ASCII HYPHEN, and
            // both split their word (and the dot inserts a clause pause). See Normalize.cs.
            return Clauses.AssembleClauses(Normalize.NormalizeSantali(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // An English ordinal — hand the WHOLE run to the same English reader the surrounding
                    // phrase already goes to. ⚠ WITH A FLOOR RATHER THAN A GUESS: `core` may be loaded
                    // without the registry, and then the honest reading is the QUANTITY in Santali with
                    // the untranslatable ordinal morphology dropped — never a Santali letter name for
                    // `st`/`th`, none of which is attested.
                    var foreign = Foreign.GetDefaultForeign();
                    if (foreign is not null) sink.Emit(foreign(m.Groups[2].Value));
                    else
                    {
                        var bare = ORDINAL_TAIL.Replace(m.Groups[2].Value, "");
                        foreach (var wd in Numbers.NumberToWords(Js.Number(bare), bare).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    // Ol Chiki digits and Western digits are the same numbers — normalise, then compose.
                    // ≤15 digits stays inside the safe-integer range; longer reads the raw string
                    // digit-by-digit.
                    var d = ToAsciiDigits(m.Groups[3].Value);
                    var words = d.Length <= 15 ? Numbers.NumberToWords(Js.Number(d)) : Numbers.ReadDigits(d);
                    foreach (var wd in words.Split(' ')) sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var p = m.Groups[4].Value;
                    sink.Pause(p is "᱾" or "᱿" or "." or "!" or "?" ? "." : ",");
                }
            });
        }
    }

    /** Build the Santali phonemizer (Ol Chiki grapheme scan + sign rules + final checked stop). */
    public static ILanguage CreateSantali() => new Engine();

    internal static void RegisterSelf() => Registry.Register("santali", CreateSantali);
}
