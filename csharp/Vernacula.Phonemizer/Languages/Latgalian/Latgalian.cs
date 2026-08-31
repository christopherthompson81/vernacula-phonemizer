/**
 * Latgalian (ltg) phonemizer — a greedy scan plus the Latgalian PALATALIZATION system, canonical IPA.
 * This file owns the passes: whole-onset palatalization before a front vowel with its /r/-opacity, the
 * ⟨v⟩ coda rule, the t-epenthesis, and the Baltic voicing assimilation. The grapheme tables and voicing
 * pairs live in latgalian.jsonc. Ported from src/languages/latgalian/latgalian.ts.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latgalian;

public sealed class LatgalianPhonemizer : ILanguage
{
    private static LatgalianDef DEF => Manifest.MANIFEST;
    private static IReadOnlyList<IReadOnlyList<string>> DIGRAPHS => DEF.Digraphs;
    private static IReadOnlyDictionary<string, string> VOWEL => DEF.Vowels;
    private static IReadOnlyDictionary<string, string> CONS => DEF.Consonants;
    private static IReadOnlyDictionary<string, string> VOICE => DEF.Voice;
    private static IReadOnlyDictionary<string, string> DEVOICE => DEF.Devoice;
    /** The vowel LETTERS that palatalize a preceding consonant. */
    private static readonly IReadOnlySet<string> FRONT =
        new HashSet<string>(Manifest.MANIFEST.FrontVowels, StringComparer.Ordinal);

    /** One scanned segment. Mutable: the palatalization, epenthesis and voicing passes rewrite `Ph`. */
    private sealed class Seg
    {
        public required string Ph { get; set; }
        public required bool Vowel { get; init; }
        public required bool FrontTrigger { get; init; }
    }

    private static readonly JsRe PAL_SUFFIX = JsRegex.Compile("ʲ$", "u");
    /** The obstruents a voicing cluster is made of — the TS's own class, verbatim. */
    private static readonly JsRe OBSTRUENT =
        JsRegex.Compile("[bdɡzʒvszʃfxptk]|t͡s|t͡ʃ|d͡z|d͡ʒ", "u");

    /** One Latgalian word → canonical IPA (scan → palatalization → t-epenthesis → voicing assimilation). */
    public static string PhonemizeWord(string word)
    {
        // ⚠ `Js.Normalize`, NOT `string.Normalize`: the subject is a RAW WORD and .NET refuses a string
        // carrying an unpaired surrogate where JS returns it unchanged (#1199).
        var s = Js.CodePoints(Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC)));
        var segs = new List<Seg>();
        for (var i = 0; i < s.Count; i++)
        {
            var c = s[i];
            // ⚠ THE DIGRAPHS ARE AN ORDERED LIST AND THE FIRST MATCH WINS — the TS's `.find()`. The key is
            // compared CHARACTER BY CHARACTER (`c === k[0] && s[i+1] === k[1]`), not by substring.
            IReadOnlyList<string>? dg = null;
            foreach (var k in DIGRAPHS)
            {
                var key = k[0];
                if (c == key[0].ToString() && i + 1 < s.Count && s[i + 1] == key[1].ToString()) { dg = k; break; }
            }
            if (dg is not null)
            {
                segs.Add(new Seg { Ph = dg[1], Vowel = false, FrontTrigger = false });
                i++;
                continue;
            }
            if (VOWEL.TryGetValue(c, out var v))
            {
                segs.Add(new Seg { Ph = v, Vowel = true, FrontTrigger = FRONT.Contains(c) });
                continue;
            }
            // ⟨v⟩ → [w] only BEFORE A CONSONANT (sovs→sows); it stays [v] before a vowel and WORD-FINALLY
            // (where the voicing pass then devoices it: div→dʲif, not dʲiw).
            if (c == "v")
            {
                var nx = i + 1 < s.Count ? s[i + 1] : null;
                var beforeCons = nx is not null && !VOWEL.ContainsKey(nx) && nx != "'" && nx != "’";
                segs.Add(new Seg { Ph = beforeCons ? "w" : "v", Vowel = false, FrontTrigger = false });
                continue;
            }
            if (CONS.TryGetValue(c, out var cn))
            {
                segs.Add(new Seg { Ph = cn, Vowel = false, FrontTrigger = false });
                continue;
            }
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            // Reached only when every rule above has declined, so the language's own reading always wins.
            var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = true });
            if (p is not null) segs.Add(new Seg { Ph = p, Vowel = false, FrontTrigger = false });
        }

        // PALATALIZATION: a consonant softens if its NEXT vowel (skipping the cluster) is a FRONT vowel
        // ⟨i ī e ē⟩ — the whole ONSET before a front vowel (bazneica→bazʲnʲɛit͡sa). ⚠ /r/ IS OPAQUE: an
        // obstruent+⟨r⟩ cluster stays HARD (treis→trɛis), and ⟨r⟩ inside a cluster does not soften; a
        // SIMPLE ⟨r⟩ onset still does (svareigs→sʋarʲɛiks).
        for (var k = 0; k < segs.Count; k++)
        {
            var seg = segs[k];
            if (seg.Vowel || seg.Ph.EndsWith("ʲ", StringComparison.Ordinal) || seg.Ph == "j") continue;
            if (k + 1 < segs.Count && segs[k + 1].Ph == "r") continue;      // consonant before ⟨r⟩ stays hard
            if (seg.Ph == "r" && k > 0 && !segs[k - 1].Vowel) continue;      // ⟨r⟩ in a cluster stays hard
            for (var m = k + 1; m < segs.Count; m++)
            {
                var t = segs[m];
                if (t.Ph == "r") break;                                     // /r/ blocks leftward spread
                if (t.Vowel) { if (t.FrontTrigger) seg.Ph += "ʲ"; break; }
            }
        }

        // t-EPENTHESIS: a word-final ⟨s⟩/⟨š⟩ after a nasal /n ņ/ surfaces with an epenthetic [t] → the
        // affricate [t͡s]/[t͡ʃ] (sens→sʲænt͡s, kaimiņš→kaimʲinʲt͡ʃ).
        if (segs.Count >= 2)
        {
            Seg last = segs[^1], prev = segs[^2];
            var prevNasal = prev.Ph == "n" || prev.Ph == "nʲ";
            if (prevNasal && last.Ph == "s") last.Ph = prev.Ph == "nʲ" ? "t͡sʲ" : "t͡s";
            else if (prevNasal && last.Ph == "ʃ") last.Ph = "t͡ʃ";
        }

        // VOICING assimilation (regressive) within obstruent clusters: an obstruent assimilates to the LAST
        // obstruent of the cluster; a word-final obstruent devoices (Latgola→ladɡɔla; absurds→apsurt͡s).
        for (var k = segs.Count - 1; k >= 0; k--)
        {
            var basePh = PAL_SUFFIX.Replace(segs[k].Ph, "");
            var pal = segs[k].Ph.EndsWith("ʲ", StringComparison.Ordinal) ? "ʲ" : "";
            var next = k + 1 < segs.Count ? segs[k + 1] : null;
            if (next is null || next.Vowel || !OBSTRUENT.IsMatch(PAL_SUFFIX.Replace(next.Ph, "")))
            {
                // word-final or before a sonorant/vowel: devoice a word-final obstruent only
                if (next is null && DEVOICE.TryGetValue(basePh, out var dv)) segs[k].Ph = dv + pal;
                continue;
            }
            var nb = PAL_SUFFIX.Replace(next.Ph, "");
            if (DEVOICE.ContainsKey(nb) && VOICE.TryGetValue(basePh, out var vo)) segs[k].Ph = vo + pal;
            else if (VOICE.ContainsKey(nb) && DEVOICE.TryGetValue(basePh, out var dv2)) segs[k].Ph = dv2 + pal;
        }
        return string.Concat(segs.Select(x => x.Ph));
    }

    // Latgalian Latin + macron/háček letters. Word / number / punctuation.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'’")})|(\\d+)|([.?!,;:…])", "giu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — a foreign name.
     */
    private const string NATIVE_CLASS = "[a-zāēīōūȳčšžģķļņř'’]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input) =>
        // ⚠ NORMALIZATION FIRST — Normalize.cs rewrites figures, signs, units and the ordinal period into
        // Latgalian words BEFORE tokenization, so everything below sees plain words and digits.
        Clauses.AssembleClauses(
            Normalize.NormalizeLatgalian(Rewriter.Renormalize(input, NormalizationForm.FormC)), TOKEN,
            (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
            });

    /** Build the Latgalian phonemizer (Latin scan + the ⟨i⟩/⟨y⟩ palatalization + Baltic voicing). */
    public static ILanguage CreateLatgalian() => new LatgalianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("latgalian", CreateLatgalian);
}
