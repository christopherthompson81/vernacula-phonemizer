/**
 * Tashelhit / Shilha (shi) — Taclḥit, a Berber (Amazigh) language of SW Morocco (the Souss), ~7–9M.
 *
 * ⚠ THIS ENGINE CONSUMES BOTH COMMUNITY SCRIPTS — the Berber Latin alphabet AND Neo-Tifinagh (ⵜⵉⴼⵉⵏⴰⵖ,
 * Morocco's constitutionally-official IRCAM script) — auto-detecting per WORD by codepoint (Tifinagh is
 * U+2D30–2D7F). Both are phonemic alphabets for the same phonology, so they yield IDENTICAL IPA. (The
 * Arabic manuscript script is deferred — a defective non-standard abjad.)
 *
 * The orthography is near-1:1 PHONEMIC, so it is a greedy grapheme scan plus two rules the table cannot
 * express:
 *   · LABIALISATION — a consonant followed by ⟨ʷ⟩ (U+02B7), or Tifinagh ⵯ Tamatart (U+2D6F), → [Cʷ];
 *   · GEMINATION — a doubled consonant letter → a LONG consonant [Cː] (phonemic in Berber: kk→kː, ṭṭ→tˤː).
 *
 * Ported from src/languages/tashelhit/tashelhit.ts. Vowel-lessness / syllabic consonants are left as-is
 * (Berber allows them).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tashelhit;

public sealed class TashelhitPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** Tifinagh is U+2D30–2D7F. Tested on the CODE POINT, like the TS's `ch.codePointAt(0)`. */
    private static bool IsTifinagh(string ch)
    {
        var c = Js.CodePointAt0(ch);
        return c >= 0x2d30 && c <= 0x2d7f;
    }

    private static readonly JsRe LABIAL_AND_LENGTH = JsRegex.Compile("[ʷː]", "gu");
    private const string VOWELS = "aiuəo";

    /** One Tashelhit word → IPA, script auto-detected. Scan graphemes → apply labialisation (C + the
     *  script's labial marker) → collapse a doubled consonant to a long [Cː]. Unknown characters stay
     *  visible. */
    private static string Phonemize(string word)
    {
        var tif = Js.CodePoints(word).Any(IsTifinagh);
        var g = tif ? Manifest.MANIFEST.Tifinagh : Manifest.MANIFEST.Graphemes;
        var labial = tif ? "ⵯ" : "ʷ"; // Tifinagh Tamatart (U+2D6F) vs Latin ⟨ʷ⟩
        // ⚠ `Js.Normalize`, NOT `string.Normalize`: the subject is a RAW WORD and .NET refuses an unpaired
        // surrogate where JS returns it unchanged (#1199). Tifinagh is caseless and already atomic.
        var w = tif ? word : Js.ToLowerCase(Js.Normalize(word, System.Text.NormalizationForm.FormC));

        // 1. grapheme scan → IPA tokens (the labialisation marker merges into the previous token).
        var toks = new List<string>();
        foreach (var ch in Js.CodePoints(w))
        {
            if (ch == labial)
            {
                if (toks.Count > 0) toks[^1] += "ʷ";
                continue;
            }
            toks.Add(g.TryGetValue(ch, out var ph) ? ph : ch);
        }

        // 2. gemination: a doubled consonant → one LONG consonant [Cː] (Berber phonemic length). Compare the
        //    BASE consonant (ignoring labialisation/length) so ⟨ggʷ⟩ = ɡ + ɡʷ collapses to a long labialised
        //    [ɡʷː] and ⟨ṭṭ⟩ = tˤ + tˤ → [tˤː]; the length + labial mark are carried onto the single segment.
        var outp = new List<string>();
        foreach (var t in toks)
        {
            var prev = outp.Count > 0 ? outp[^1] : null;
            var bareT = LABIAL_AND_LENGTH.Replace(t, "");
            if (prev is not null && LABIAL_AND_LENGTH.Replace(prev, "") == bareT && !IsVowel(bareT))
                outp[^1] = bareT + ((prev + t).Contains('ʷ') ? "ʷ" : "") + "ː";
            else outp.Add(t);
        }
        return string.Concat(outp);
    }

    /** JS `"aiuəo".includes(x)` — TRUE for the empty string, which is why this is spelled out rather than
     *  written as a character test: an empty base can reach here if a grapheme maps to "". */
    private static bool IsVowel(string x) => VOWELS.Contains(x, StringComparison.Ordinal);

    /**
     * Latin (with emphatic dot-below + combining marks) OR Tifinagh LETTERS (U+2D30–2D6F, incl. the Tamatart
     * labial ⵯ) — one word class; the Tifinagh separator ⵰ (U+2D70) is punctuation, not a letter.
     * ⚠ THE WORD CLASS IS THE SCRIPTS (Latin + Tifinagh), not a letter list.
     * ⚠ ٠-٩ (Arabic-Indic) are accepted alongside 0-9 because Moroccan text mixes them.
     */
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin", "Tifinagh" })})|([0-9\\u0660-\\u0669]+)|([.,?!;:،؟⵰])", "gu");

    /**
     * This language's OWN inventory — the token word class as it stood before the script widening, lifted
     * verbatim, so nothing about the orthography is invented here. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART:
     * TOKEN decides where the SCRIPT boundary falls (routing); this decides whether the g2p has rules for
     * these letters. A token this REJECTS carries a letter the language does not use — a foreign name.
     */
    private const string NATIVE_CLASS = "[a-zɣġšžčɛḍṭṣẓṛḥḷṇʷ̀-ͯⴰ-ⵯA-ZƔĠŠŽČƐḌṬṢẒṚḤḶṆ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    public string Text(string input)
    {
        // TEXT NORMALIZATION runs FIRST — see Normalize.cs. It NFCs at its own entry (its era and unit
        // literals carry dot-below emphatics), and NFC is idempotent, so this fold still guarantees the
        // tokenizer's class sees a composed string whatever the layer emitted.
        var nfc = Renormalize(Normalize.NormalizeTashelhit(input), System.Text.NormalizationForm.FormC);

        return Clauses.AssembleClauses(nfc, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(Phonemize(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                // Arabic-Indic ٠-٩ fold to ASCII so the number path reads one digit set.
                var d = string.Concat(Js.CodePoints(m.Groups[2].Value)
                    .Select(c => string.CompareOrdinal(c, "٠") >= 0 && string.CompareOrdinal(c, "٩") <= 0
                        ? Js.NumberToString(Js.CodePointAt0(c) - 0x0660)
                        : c));
                // ≤12 digits stays inside the attested range (< 10¹²); longer reads the raw digit string.
                var words = d.Length <= 12 ? Numbers.NumberToWords(Js.Number(d)) : Numbers.ReadDigits(d);
                foreach (var wd in words.Split(' ')) sink.Emit(Phonemize(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    private static string Renormalize(string s, System.Text.NormalizationForm f) => Rewriter.Renormalize(s, f);

    /** Bare word → IPA (tests / referee eval). */
    public static string PhonemizeWord(string word) => Phonemize(word);

    /** Build the Tashelhit (Shilha) phonemizer — Berber Latin OR Neo-Tifinagh → IPA. */
    public static ILanguage CreateTashelhit() => new TashelhitPhonemizer();

    internal static void RegisterSelf() => Registry.Register("tashelhit", CreateTashelhit);
}
