/**
 * Native Central Kurdish / Sorani (ckb) text phonemizer — canonical IPA. The SORANI Perso-Arabic alphabet
 * writes every long vowel and the short /a/; only the short /ɪ/ (bizroke) is unwritten, and it comes from
 * the AsoSoft-derived lexicon (or, on the async path, the tagger) rather than from a rule.
 * Ported from src/languages/central-kurdish/central-kurdish.ts — see that file for the measured evidence
 * behind the lexicon, the referee ladder, and the one-letter ⟨و⟩/⟨ی⟩ readings.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.CentralKurdish;

/** Resolve an OOV word to IPA — consulted BETWEEN the lexicon and the rule scan; null for "no opinion".
 *  Used only by the async neural path (CentralKurdishNeural.cs), so the sync engine is unchanged. */
public delegate string? OovResolver(string word);

public sealed class CentralKurdishPhonemizer : ILanguage
{
    private static CkbDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> CONS => DEF.Consonants;
    private static IReadOnlyDictionary<string, string> VOW => DEF.Vowels;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static readonly HashSet<string> VOWEL_LETTERS = [.. DEF.VowelLetters];

    /** The BIZROKE lexicon (lexicon.tsv) — the unwritten short /ɪ/, which no rule derives. */
    private static IReadOnlyDictionary<string, string>? LEX;
    private static IReadOnlyDictionary<string, string> Lexicon() =>
        LEX ??= LoadTsv.LoadTsvMap("languages/central-kurdish", "lexicon.tsv", optional: true);

    /** Whether the bizroke lexicon knows this word — the neural path uses the SAME lookup the engine does. */
    public static bool BizrokeLexiconHas(string word) => Lexicon().ContainsKey(word);

    /** Pure RULE-ENGINE word→IPA (no lexicon): the honest signal for the referee eval, and the tagger's input. */
    public static string PhonemizeWordRules(string word) => ScanWord(word);

    /** One Sorani word → IPA. Precedence is lexicon → oovOverride → rules. */
    public static string PhonemizeWord(string word, OovResolver? oov = null)
    {
        if (Lexicon().TryGetValue(word, out var hit)) return hit;
        var o = oov?.Invoke(word);
        return o ?? ScanWord(word);
    }

    private static readonly JsRe INVISIBLE = JsRegex.Compile("[‌ـ]", "gu"); // ZWNJ + tatweel

    private static string ScanWord(string word)
    {
        var w = Js.CodePoints(INVISIBLE.Replace(word, ""));
        // ⚠ The one-letter ⟨و⟩ and ⟨ی⟩ are the conjunction [u] and the izafe [iː], not the glides the
        // matres-lectionis rule below would give them. See the TS for the two measurements.
        if (w.Count == 1 && w[0] == "و") return "u";
        if (w.Count == 1 && w[0] == "ی") return "iː";
        var toks = new List<string>();
        for (var i = 0; i < w.Count; i++)
        {
            var c = w[i];
            var prev = i - 1 >= 0 ? w[i - 1] : "";
            var nxt = i + 1 < w.Count ? w[i + 1] : "";
            if (c == "و" && nxt == "و") { toks.Add("uː"); i++; continue; } // وو → uː
            if (CONS.TryGetValue(c, out var cons)) { toks.Add(cons); continue; }
            if (VOW.TryGetValue(c, out var vow)) { toks.Add(vow); continue; }
            if (c == "ئ") { if (i == 0) toks.Add("ʔ"); continue; } // hamza carrier: glottal onset word-initially
            // Matres lectionis: و/ی are glides word-initially or next to a written vowel, else the vowels.
            var glide = i == 0 || VOWEL_LETTERS.Contains(prev) || VOWEL_LETTERS.Contains(nxt);
            if (c == "و") toks.Add(glide ? "w" : "u");
            else if (c == "ی") toks.Add(glide ? "j" : "iː");
        }
        // н → ŋ before a velar stop.
        for (var k = 0; k < toks.Count - 1; k++)
            if (toks[k] == "n" && (toks[k + 1] == "k" || toks[k + 1] == "ɡ")) toks[k] = "ŋ";
        return string.Concat(toks);
    }

    /** A run of ASCII digits → the spoken Sorani cardinal in canonical IPA. */
    /// <summary>⚠ THE ZERO WORD READ WITHOUT A VOWEL, AND IT WAS IN THE SHIPPED GOLDEN. ⟨سفر⟩ is the only
    /// entry in the numbers table whose written form carries none of its vowels, so the rule scan produced
    /// *sfɾ* — a vowel-less token, the class this engine's header calls "not a variant, IMPOSSIBLE". It
    /// reached 2 of the 200 parity rows and every one of the 22 colon-clock instances.
    /// <para>⚠ THE READING IS THE ENGINE'S OWN. Written as a WORD, `سفر` already reads *sɪfɪɾ* on the async
    /// path — the bizroke tagger supplies it. The number path never asks: a COMPOSED number word is not in
    /// the text, so the oovOverride the neural layer installs never sees it and both modes fell to rules.
    /// </para>
    /// <para>⚠ NOT THE LEXICON, because `سفر` is a genuine HOMOGRAPH — AsoSoft pairs it with *safar*
    /// ("journey"), which is why the builder's bizroke-only filter dropped it. The numeral CONTEXT is
    /// unambiguous where the word is not, so the reading belongs here. See the TS docstring.</para></summary>
    private static readonly Dictionary<string, string> NUMERAL_READING = new(StringComparer.Ordinal)
    {
        ["سفر"] = "sɪfɪɾ",
    };

    private static string NumberWord(string w) =>
        NUMERAL_READING.TryGetValue(w, out var ipa) ? ipa : PhonemizeWord(w);

    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // ⚠ Above 2^53 the float has lost the low digits, so composing a quantity is refused; the reading
        // is digit-at-a-time through this engine's own number words rather than a raw digit leak.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
            return Core.Numbers.SpellDigits(digits, DEF.Numbers, NumberWord);
        return Core.Numbers.RenderNumber(n, DEF.Numbers, NumberWord, Numbers.IranianNumberWords);
    }

    // A word (Sorani Perso-Arabic letters, U+0620–U+06FF incl. ZWNJ) / number / punctuation token.
    // ⚠ CentralKurdishNeural.cs KEYS ITS PRE-PASS OFF THE SAME CLASS — keep the two in step.
    private static readonly JsRe TOKEN = JsRegex.Compile("([ؠ-ۿ‌]+)|(\\d+)|([،؛؟.!?…,:])", "gu");

    private readonly Func<string, string>? _foreign;
    private CentralKurdishPhonemizer(Func<string, string>? foreign = null) => _foreign = foreign;

    public string Text(string rawInput) => Text(rawInput, null);

    public string Text(string rawInput, OovResolver? oovOverride)
    {
        // Everything the g2p cannot read is rewritten FIRST — see Normalize.cs. ⚠ Most importantly the
        // Arabic-Indic digits are folded to ASCII there: the letter class above CONTAINS U+0660–U+0669.
        return Clauses.AssembleClauses(Normalize.NormalizeCentralKurdish(rawInput), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(m.Groups[1].Value, oovOverride));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                sink.Emit(Number(m.Groups[2].Value));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
            }
        });
    }

    /** Build the Central Kurdish (Sorani) phonemizer. `foreign` mirrors the TS constructor parameter; the
     *  tokenizer has no Latin arm, so an embedded Latin run is handled by the shared clause assembler and
     *  this field is never read — exactly as in the TS (registry.ts names the nine factories that do this). */
    public static CentralKurdishPhonemizer CreateCentralKurdish(Func<string, string>? foreign = null) => new(foreign);

    /** Build the Central Kurdish engine with a per-call `oovOverride` hook (the async neural path). */
    public static CentralKurdishPhonemizer CreateCentralKurdishEngine() => new();

    internal static void RegisterSelf() =>
        Registry.Register("centralkurdish", () => CreateCentralKurdish(Registry.ReadAsEnglish));
}
