/**
 * Quechua (qu) phonemizer — Southern Quechua / Runasimi (Qhichwa; Cusco-Collao + Ayacucho), Latin script,
 * canonical IPA. Near-phonemic: a 3-vowel system ⟨a i u⟩ and a THREE-WAY stop series written overtly —
 * plain ⟨p t k q ch⟩, aspirated with ⟨h⟩ (⟨ph th kh qh chh⟩), ejective with an apostrophe (⟨p' t' k' q'
 * ch'⟩); uvular ⟨q⟩→[q]. A longest-match scan (tri/digraphs before single graphemes) suffices, then
 * regular PENULTIMATE stress on the onset of the penult syllable.
 *
 * ⚠ THE APOSTROPHE IS A LETTER HERE, not punctuation — it marks ejection, and the three shapes (ʼ ’ ')
 * are normalised to U+0027 before the scan so all of them reach the same rule.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Quechua;

public sealed class QuechuaPhonemizer : ILanguage
{
    private static readonly QuechuaManifest DEF = Manifest.MANIFEST;
    private static readonly IReadOnlyDictionary<string, string> DIGRAPHS = DEF.Digraphs;
    private static readonly IReadOnlyDictionary<string, string> G = DEF.Graphemes;
    private static readonly IReadOnlyDictionary<string, string> CLAUSE_MARK = DEF.ClausePunctuation;

    // JS `Object.keys(...).sort((a, b) => b.length - a.length)` — insertion order, then a STABLE
    // longest-first sort, so equal-length keys keep their declaration order from quechua.jsonc.
    private static readonly List<string> ORDER = DIGRAPHS.Keys.OrderByDescending(k => k.Length).ToList();

    private static readonly IReadOnlySet<string> VOWEL = Ipa.IPA_VOWEL;

    private static readonly JsRe APOSTROPHE = JsRegex.Compile("[ʼ’‘]", "gu");

    /** Phonemize one Quechua word → canonical IPA: longest-match scan + penultimate stress. */
    public static string PhonemizeWord(string word)
    {
        // Normalise the three apostrophe glyphs (modifier ʼ / curly ’ / ASCII ') so the ejective digraphs match.
        var w = APOSTROPHE.Replace(word.Normalize(NormalizationForm.FormC).ToLowerInvariant(), "'");
        var segs = new List<string>();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in ORDER)
            {
                // JS `w.startsWith(key, i)` — the BOUNDS TEST COMES FIRST: CompareOrdinal with a length
                // past the end of `w` compares only what is there, so testing it afterwards is too late.
                if (i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0)
                {
                    segs.Add(DIGRAPHS[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            // Consulted AFTER every digraph and single-letter rule, so it cannot override this language.
            var ch = w[i].ToString();
            var ph = G.TryGetValue(ch, out var g) ? g : LatinPhones.LatinPhone(ch, new PhoneOpts { Initial = i == 0 });
            if (ph is not null) segs.Add(ph);
            i += 1;
        }
        // Regular penultimate stress: ˈ before the onset of the penultimate syllable (the second-to-last vowel, or the
        // sole vowel of a monosyllable). Quechua onsets are a single consonant, so back up at most one segment.
        var vidx = new List<int>();
        for (var idx = 0; idx < segs.Count; idx++) if (VOWEL.Contains(segs[idx])) vidx.Add(idx);
        if (vidx.Count > 0)
        {
            var nucleus = vidx.Count >= 2 ? vidx[^2] : vidx[0];
            var at = nucleus > 0 && !VOWEL.Contains(segs[nucleus - 1]) ? nucleus - 1 : nucleus;
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs).Normalize(NormalizationForm.FormC);
    }

    // A word (Quechua Latin letters incl. ñ + the apostrophe glyphs for ejectives) / number / punctuation.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'’ʼ‘-")})|(\\d+)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
     * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
     * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
     * core/hostWord.ts.
     */
    private const string NATIVE_CLASS = "[a-zñşA-ZÑŞ'’ʼ‘-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    public string Text(string input)
    {
        // The pre-tokenizer normalization pass — see normalize.ts. Pure text→text, so everything it emits
        // still reaches the g2p through the TOKEN below (playbook trap 6).
        return Clauses.AssembleClauses(Normalize.NormalizeQuechua(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Quechua phonemizer (direct 3-vowel phonemic g2p + the aspirate/ejective series + penultimate stress). */
    public static ILanguage CreateQuechua() => new QuechuaPhonemizer();

    // The TS registry imports `createQuechua` statically; the C# port has no such import, so the module
    // registers itself — from Languages/Bootstrap.cs, not a [ModuleInitializer] (CA2255: load-time side
    // effects in a library, and 182 invisible initializers make "which languages are ported" ungreppable).
    internal static void RegisterSelf() => Registry.Register("quechua", CreateQuechua);
}
