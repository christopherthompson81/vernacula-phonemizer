/**
 * K'iche' (quc) phonemizer — a longest-match grapheme scan over the ALMG orthography, canonical IPA.
 * Ported from src/languages/kiche/kiche.ts — see that file for the corpus evidence. This file owns the
 * apostrophe-glyph normalisation (so the glottalized units match), multi-word splitting, and FINAL
 * (oxytone) stress placement. The unit/letter tables (the ejective/aspirated series) live in kiche.jsonc.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kiche;

public sealed class KicheePhonemizer : ILanguage
{
    private static readonly KicheDef DEF = Manifest.MANIFEST;
    private static readonly IReadOnlyDictionary<string, string> UNIT = DEF.Units;
    private static readonly IReadOnlyDictionary<string, string> G = DEF.Letters;

    // JS `Object.keys(UNIT).sort((a, b) => b.length - a.length)` — a STABLE longest-first sort, so
    // equal-length keys keep their declaration order from kiche.jsonc.
    private static readonly List<string> ORDER = UNIT.Keys.OrderByDescending(k => k.Length).ToList();

    private static readonly IReadOnlySet<string> VOWEL = Ipa.IPA_VOWEL;

    // JS `/\s/u` and `/\s+/u` — the ECMAScript WhiteSpace ∪ LineTerminator set, the same set `Js.Trim` uses.
    private static readonly JsRe WS = JsRegex.Compile("\\s", "u");
    private static readonly JsRe WS_RUN = JsRegex.Compile("\\s+", "u");

    /** The apostrophe glyphs (ASCII ' / curly ’ / backtick) normalise to ʼ so the glottalized units match. */
    private static readonly JsRe APOSTROPHE = JsRegex.Compile("['’`]", "gu");

    /** Phonemize one K'iche' word → canonical IPA: longest-match scan + final stress (length not emitted).
     *  A multi-word phrase (some referee headwords) is split so each word gets its own stress. */
    public static string PhonemizeWord(string word)
    {
        var t = Js.Trim(word);
        // ⚠ EACH PART GOES BACK THROUGH THE WHOLE FUNCTION (the TS `.map(phonemizeWord)`) — the recursion
        // is what gives every word of a phrase its own stress.
        if (WS.IsMatch(t)) return string.Join(" ", WS_RUN.Re.Split(t).Select(PhonemizeWord));
        var w = APOSTROPHE.Replace(Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC)), "ʼ");
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
                    segs.Add(UNIT[key]);
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
        // FINAL (oxytone) stress — the K'iche' default: ˈ before the onset of the last syllable (folded in eval).
        var vidx = new List<int>();
        for (var idx = 0; idx < segs.Count; idx++)
            if (VOWEL.Contains(segs[idx])) vidx.Add(idx);
        if (vidx.Count > 0)
        {
            var nucleus = vidx[^1];
            var at = nucleus > 0 && !VOWEL.Contains(segs[nucleus - 1]) ? nucleus - 1 : nucleus;
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs).Normalize(NormalizationForm.FormC);
    }

    /** A K'iche' word (Latin + ä + the apostrophe glyphs) / number / punctuation. */
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'’ʼ`-")})|(\\d+)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
     * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
     * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
     * core/hostWord.ts.
     */
    private const string NATIVE_CLASS = "[a-zäöëïüáéíóúÄÖËÏÜÁÉÍÓÚA-Z'’ʼ`-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeKiche(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
        });
    }

    /** Build the K'iche' phonemizer (ALMG grapheme scan + ejective series + aspirated plain stops + final stress). */
    public static ILanguage CreateKichee() => new KicheePhonemizer();

    // The TS registry imports `createKichee` statically; the C# port has no such import, so the module
    // registers itself — from Languages/Bootstrap.cs, not a [ModuleInitializer].
    internal static void RegisterSelf() => Registry.Register("kichee", CreateKichee);
}
