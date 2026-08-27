/**
 * Mongolian (mn) phonemizer — Standard Khalkha. Cyrillic Khalkha is a DEEP orthography: only the first-syllable
 * vowel is realised full, a non-initial short vowel reduces to ə and a word-final one deletes. On top of the
 * greedy g2p scan this module applies that reduction/deletion, the ⟨в⟩ final devoicing and final н→ŋ, then
 * tokenizes. Ported from src/languages/mongolian/mongolian.ts — see that file for the corpus evidence,
 * including the ⟨ї⟩/⟨ѳ⟩ legacy-codepage argument.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mongolian;

public static class MongolianPhonemizer
{
    /** Word-final obstruent devoicing: only в→f. Final г stays voiced. */
    private static readonly Dictionary<string, string> DEVOICE = new() { ["w"] = "f" };

    /** A non-initial SHORT vowel reduces to a quality that keeps the ORIGINAL letter's rounding. */
    private static readonly Dictionary<string, string> REDUCED_OF = new()
    {
        ["a"] = "ə", ["e"] = "ə", ["i"] = "ə", ["æ"] = "ə", ["ɔ"] = "ʊ", ["ʊ"] = "ʊ",
        ["o"] = "ʊ", ["ɵ"] = "ɵ", ["œ"] = "ɵ", ["u"] = "u",
    };

    private static bool IsCons(Seg? s) => s is not null && !s.Nucleus;

    /** Apply the deep-orthography vowel reduction: the first nucleus stays full; a non-initial non-final SHORT
     *  vowel reduces; a word-final short vowel DELETES, and an epenthetic reduced vowel breaks the consonant
     *  cluster that leaves. Long vowels / diphthongs stay full. */
    private static List<Seg> Reduce(List<Seg> segs, bool initialFull = true, bool keepNonFinal = false)
    {
        var seen = !initialFull; // a bound morpheme has NO full first vowel — everything reduces
        var outp = new List<Seg>();
        string? epenthesis = null;
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            if (!s.Nucleus) { outp.Add(s); continue; }
            if (!seen) { seen = true; outp.Add(s); continue; } // first vowel is full
            if (!s.Short) { outp.Add(s); continue; } // long vowel / diphthong stays full
            var reduced = REDUCED_OF.GetValueOrDefault(s.Ph, "ə");
            if (i == segs.Count - 1) { epenthesis = reduced; continue; } // word-final short vowel → delete
            // A mixed-harmony (loanword) word keeps its non-final vowels FULL.
            outp.Add(keepNonFinal ? s : new Seg { Ph = reduced, Nucleus = true, Short = true });
        }
        if (epenthesis is not null && outp.Count >= 2 && IsCons(outp[^1]) && IsCons(outp[^2]))
            outp.Insert(outp.Count - 1, new Seg { Ph = epenthesis, Nucleus = true, Short = true });
        return outp;
    }

    /** ⟨ї⟩ U+0457 IS ⟨ү⟩ and ⟨ѳ⟩ U+0473 is ⟨ө⟩ — a legacy-codepage artefact of the pre-Unicode Mongolian
     *  fonts, not another language's letters wandering in. ⚠ NOT a registry-level confusable fold: ⟨ї⟩ is a
     *  real Ukrainian letter, so the claim is about MONGOLIAN text specifically and lives here. */
    private static readonly Dictionary<string, string> LEGACY_CODEPAGE = new() { ["ї"] = "ү", ["ѳ"] = "ө" };
    private static readonly JsRe LEGACY_RE =
        JsRegex.Compile($"[{string.Concat(LEGACY_CODEPAGE.Keys)}]", "gu");
    private static string FoldLegacyCodepage(string w) =>
        LEGACY_RE.Replace(w, m => LEGACY_CODEPAGE[m.Value]);

    private static readonly JsRe VELAR_AFTER_N = JsRegex.Compile("^[ɡɢkxχq]", "u");
    private static readonly JsRe BOUND_PREFIX = JsRegex.Compile("^[-­]", "u");
    private static readonly JsRe HAS_BACK = JsRegex.Compile("[аоуяёю]", "u");
    private static readonly JsRe HAS_FRONT = JsRegex.Compile("[эөүе]", "u");

    /** One Mongolian word → canonical IPA. A Mongol-bichig word is transliterated to Cyrillic first. */
    public static string PhonemizeWord(string word)
    {
        if (MongolBichig.IsBichig(word)) word = MongolBichig.BichigToCyrillic(word);
        var w = FoldLegacyCodepage(Js.ToLowerCase(word));
        var raw = G2p.ToSegments(w);
        if (!raw.Any(s => s.Nucleus)) return string.Concat(raw.Select(s => s.Ph)); // vowelless (a letter name)
        // Final н → ŋ keyed on the ORIGINAL spelling (before vowel deletion).
        for (var i = 0; i < raw.Count; i++)
        {
            if (raw[i].Ph != "n") continue;
            var next = i + 1 < raw.Count ? raw[i + 1].Ph : null;
            if (next is null || VELAR_AFTER_N.IsMatch(next)) raw[i].Ph = "ŋ";
        }
        var bound = BOUND_PREFIX.IsMatch(word); // a -suffix entry: its leading vowel is non-initial
        // A word mixing BACK and FRONT vowels violates harmony → a loanword, whose non-initial vowels stay FULL.
        var loan = HAS_BACK.IsMatch(w) && HAS_FRONT.IsMatch(w);
        var segs = Reduce(raw, !bound, loan);
        // Final devoicing — but NOT when the written word ends in ь (the obstruent isn't truly final).
        var last = segs.Count > 0 ? segs[^1] : null;
        if (last is not null && DEVOICE.TryGetValue(last.Ph, out var dv) && !w.EndsWith("ь", StringComparison.Ordinal))
            last.Ph = dv;
        return string.Concat(segs.Select(s => s.Ph));
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN = JsRegex.Compile("([Ѐ-ӿᠠ-ᡂ᠋-᠎‌‍\\u202f]+)|(\\d+)|([.!?…,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // NORMALIZATION FIRST — every unit, sign, ordinal and initialism reading lives in Normalize.cs
            // rather than in the shared symbol tier; see the TS header for why the tier cannot say it.
            return Clauses.AssembleClauses(Normalize.NormalizeMongolian(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(m.Groups[1].Value));
                // ⚠ ABOVE 2^53 `NumberToWords` RETURNS "" and the number used to VANISH — the else is the fix.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var tok = m.Groups[2].Value;
                    var composed = Numbers.NumberToWords(Js.Number(tok));
                    foreach (var wd in (composed == "" ? Numbers.SpellDigits(tok) : composed).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Mongolian phonemizer (greedy Cyrillic g2p + deep-orthography reduction + final devoicing). */
    public static ILanguage CreateMongolian() => new Engine();

    internal static void RegisterSelf() => Registry.Register("mongolian", () => CreateMongolian());
}
