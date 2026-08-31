/**
 * Native Macedonian / македонски (mk) text phonemizer — canonical IPA. South Slavic, Cyrillic.
 * Macedonian is fully phonemic with NO vowel reduction, so a left-to-right grapheme scan plus the shared
 * South-Slavic phonotactics recovers the pronunciation. Macedonian specifics vs Bulgarian: the palatals are
 * DISTINCT LETTERS (ѓ ќ љ њ ѕ џ ј → ɟ c ʎ ɲ d͡z d͡ʒ j — no ь/я/ю palatalization), and STRESS is FIXED on the
 * ANTEPENULT syllable (predictable → emitted). Rules: dark-l (⟨л⟩→[l] before е/и/ј, [ɫ] else), syllabic
 * ⟨р⟩→[r̩], n→ŋ before a velar, word-final devoicing, regressive voicing assimilation.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Macedonian;

public sealed class MacedonianPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> L => Manifest.DEF.Letters;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.DEF.ClausePunctuation;

    /**
     * Macedonian count form: SINGULAR when the number's last digit is 1 (not 11), else PLURAL. Macedonian
     * has no paucal — 2 километри and 5 километри are the same form — so it is two-way, unlike Russian's
     * three. This differs from the default count form (n === 1) on compounds: 21 километар, 22 километри,
     * 11 километри.
     */
    private static int MkCountForm(double n)
    {
        var m = Math.Abs(n) % 100;
        return m % 10 == 1 && m != 11 ? 0 : 1;
    }

    /**
     * Symbol normalization — Macedonian. Percent/currency/units/rates carry the count form above. Units are
     * written BOTH ways — Cyrillic км and Latin km are equally common in the corpus — so both scripts are
     * declared. The rate denominator is "на час" (per hour) but "во секунда" (per second), which the keyed
     * `UnitPer` expresses.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `Multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
        // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x`
        // as a LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so
        // `By` is omitted and defaults to it — this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "пати" },
        Percent = new[] { "процент", "проценти" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "долар", "долари" },
            ["¥"] = new[] { "јен", "јени" },
            ["€"] = new[] { "евро", "евра" },
            ["£"] = new[] { "фунта", "фунти" },
        },
        Magnitudes = new[] { "милијарди", "милиони" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["км"] = new[] { "километар", "километри" }, ["km"] = new[] { "километар", "километри" },
            ["м"] = new[] { "метар", "метри" }, ["m"] = new[] { "метар", "метри" },
            ["см"] = new[] { "сантиметар", "сантиметри" }, ["cm"] = new[] { "сантиметар", "сантиметри" },
            ["мм"] = new[] { "милиметар", "милиметри" }, ["mm"] = new[] { "милиметар", "милиметри" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "квадратен", "квадратни" },
            Cubed = new[] { "кубен", "кубни" },
            Position = ExponentPosition.Before,
        },
        UnitPer = new UnitPerSpec
        {
            ByDenominator = new Dictionary<string, string>(StringComparer.Ordinal)
                { ["h"] = "на", ["ч"] = "на", ["s"] = "во", ["с"] = "во" },
        },
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
            { ["h"] = "час", ["ч"] = "час", ["s"] = "секунда", ["с"] = "секунда" },
        CountForm = MkCountForm,
    });

    private static readonly IReadOnlySet<string> VOWELS = Ipa.IPA_VOWEL;

    /** Voiced obstruent → voiceless (final devoicing + regressive assimilation before a voiceless one). */
    private static readonly IReadOnlyDictionary<string, string> DEVOICE =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["b"] = "p", ["v"] = "f", ["ɡ"] = "k", ["d"] = "t", ["ʒ"] = "ʃ", ["z"] = "s",
            ["d͡ʒ"] = "t͡ʃ", ["d͡z"] = "t͡s", ["ɟ"] = "c",
        };
    private static readonly IReadOnlyDictionary<string, string> VOICE =
        DEVOICE.ToDictionary(kv => kv.Value, kv => kv.Key, StringComparer.Ordinal);
    /** The voiceless obstruents (DEVOICE values) plus ⟨х⟩. */
    private static readonly IReadOnlySet<string> VOICELESS =
        new HashSet<string>(DEVOICE.Values.Append("x"), StringComparer.Ordinal);

    private static bool IsVowel(string t) => t.Length != 0 && VOWELS.Contains(t);
    /** The syllabic р counts as a nucleus for stress. */
    private static bool IsNucleus(string t) => IsVowel(t) || t == "r̩";

    /**
     * Scan a lowercased Macedonian word into IPA phoneme tokens (dark-l in code, every other letter from
     * the table). ⚠ CODE POINTS — the TS spells this `[...word.toLowerCase()]`.
     */
    private static List<string> Scan(string word)
    {
        var chars = Js.CodePoints(Js.ToLowerCase(word));
        var toks = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            if (c == "л")
            {
                toks.Add(Manifest.FRONT_L.Contains(i + 1 < chars.Count ? chars[i + 1] : "") ? "l" : "ɫ");
            }
            else if (L.TryGetValue(c, out var ph))
            {
                toks.Add(ph);
            }
        }
        return toks;
    }

    /** Syllabic ⟨р⟩: an [r] with no vowel-token neighbour becomes [r̩] (прст→pr̩st, Грк→ɡr̩k). */
    private static void SyllabicR(List<string> toks)
    {
        for (var k = 0; k < toks.Count; k++)
        {
            if (toks[k] != "r") continue;
            var left = k > 0 && IsVowel(toks[k - 1]);
            var right = k + 1 < toks.Count && IsVowel(toks[k + 1]);
            if (!left && !right) toks[k] = "r̩";
        }
    }

    /** The shared South-Slavic consonant post-rules: n→ŋ before a velar, word-final devoicing, regressive
     *  voicing, and the sibilant assimilation. */
    private static void ApplyPhonotactics(List<string> toks)
    {
        // н → ŋ before a velar stop к/ɡ.
        for (var k = 0; k < toks.Count - 1; k++)
            if (toks[k] == "n" && (toks[k + 1] == "k" || toks[k + 1] == "ɡ")) toks[k] = "ŋ";
        // Word-final devoicing (град→ɡrat, нож→nɔʃ, ѕид→d͡zit).
        var last = toks.Count - 1;
        if (last >= 0 && DEVOICE.TryGetValue(toks[last], out var dv)) toks[last] = dv;
        // Regressive voicing assimilation (right-to-left). ⚠ /v/ is voicing-TRANSPARENT as [v] (it does not
        // trigger), but once it devoices to [f] before a voiceless obstruent that [f] triggers the one
        // before it.
        for (var k = toks.Count - 2; k >= 0; k--)
        {
            var b = toks[k];
            var nb = toks[k + 1];
            if (nb == "v") continue;
            if (DEVOICE.TryGetValue(b, out var d2) && VOICELESS.Contains(nb)) toks[k] = d2;
            else if (VOICE.TryGetValue(b, out var v2) && DEVOICE.ContainsKey(nb)) toks[k] = v2;
        }
        // Sibilant assimilation: с/з → ʃ before a postalveolar ʃ/t͡ʃ.
        for (var k = 0; k < toks.Count - 1; k++)
            if ((toks[k] == "s" || toks[k] == "z") && (toks[k + 1] == "ʃ" || toks[k + 1] == "t͡ʃ")) toks[k] = "ʃ";
    }

    /** Assemble the tokens with the fixed ANTEPENULT stress: ˈ before the 3rd-from-last nucleus (penult in
     *  disyllables, the sole nucleus in monosyllables). */
    private static string WithStress(IReadOnlyList<string> toks)
    {
        var nuclei = new List<int>();
        for (var i = 0; i < toks.Count; i++) if (IsNucleus(toks[i])) nuclei.Add(i);
        if (nuclei.Count == 0) return string.Concat(toks);
        var stressIdx = nuclei[Math.Max(0, nuclei.Count - 3)];
        var outp = new StringBuilder();
        for (var i = 0; i < toks.Count; i++)
        {
            if (i == stressIdx) outp.Append('ˈ');
            outp.Append(toks[i]);
        }
        return outp.ToString();
    }

    /** Phonemize a single Macedonian word to canonical IPA with antepenultimate stress. */
    public static string PhonemizeWord(string word)
    {
        var toks = Scan(word);
        SyllabicR(toks);
        ApplyPhonotactics(toks);
        return WithStress(toks);
    }

    /**
     * One number token → its words, phonemized.
     *
     * ⚠ DEAD, AND LEFT THAT WAY DELIBERATELY (#1095). Nothing calls this: `Text()` below reaches
     * `NumberToText` directly, because it has to split the decimal comma first. It is recorded rather than
     * repaired — its `return digits` would put a DIGIT STRING into the phoneme stream past 2^53, so it is a
     * live trap for whoever wires it up, and the fix is to use the arm in `Text()` rather than to give this
     * one a `raw`. Ported as dead for the same reason it is kept dead in the TypeScript.
     */
    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d)) return digits;
        return string.Join(" ", Numbers.NumberToText(n).Split(' ')
            .Where(w => w.Length > 0).Select(PhonemizeWord));
    }

    /**
     * A word (Macedonian Cyrillic) / number / punctuation token. ⚠ The number carries its DECIMAL COMMA
     * (Macedonian's decimal mark) so the comma is not read as clause punctuation — `6,5` was coming out as
     * a phrase break between "шест" and "пет". A 3-digit block after the comma is GROUPING, not a fraction
     * (the corpus's "1,400 луѓе" is fourteen hundred), so it is read as one number; 1–2 digits are a decimal.
     */
    private static readonly JsRe TOKEN =
        JsRegex.Compile("([а-шА-ШѓѕјљњќџЃЅЈЉЊЌЏѐѝЀЍ]+)|(\\d+(?:,\\d+)?)|([.!?…,;:—])", "gu");

    public string Text(string input)
    {
        // order: Macedonian rewrites (grouping, ordinals, century/date, clock, ranges, signs) →
        // INITIALISMS (after abbreviations, so `Д-р` is not spelled DE-ER) → the shared symbol tier last
        // (it needs the number still adjacent to its unit/sign). Roman numerals arrive already converted at
        // the registry seam, so regnal "Лиалофи III" is "3" by the time normalize runs.
        var normalized = SYMBOLS(Normalize.NormalizeMacedonianInitialisms(Normalize.NormalizeMacedonian(input)));
        return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
            {
                sink.Emit(PhonemizeWord(m.Groups[1].Value));
            }
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var parts = m.Groups[2].Value.Split(',');
                var intPart = parts[0];
                var frac = parts.Length > 1 ? parts[1] : null;
                // ⚠ AND THE INTEGER PART MAY NOT BE A LONE `0`: no convention groups from zero, so `0,001`
                // is one THOUSANDTH, not one. Without the guard `Number("0" + "001")` read it as 1 — a
                // 1000× error, and the reading dropped the zero entirely rather than saying it.
                if (frac is not null && frac.Length == 3 && intPart != "0")
                {
                    // "1,400" is 1400 — a grouped thousand, read as one number.
                    // ⚠ THE JOINED DIGITS ARE PASSED AS `raw` (#1095) — past 2^53 the double cannot carry them.
                    var joined = $"{intPart}{frac}";
                    foreach (var wd in Numbers.NumberToText(Js.Number(joined), joined).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else
                {
                    foreach (var wd in Numbers.NumberToText(Js.Number(intPart), intPart).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                    if (frac is not null)
                    {
                        sink.Emit(PhonemizeWord("запирка")); // the Macedonian name of the decimal comma
                        // ⚠ CODE POINTS — the TS's `for (const d of frac)` iterates code points.
                        foreach (var d in Js.CodePoints(frac))
                            foreach (var wd in Numbers.NumberToText(Js.Number(d)).Split(' '))
                                sink.Emit(PhonemizeWord(wd));
                    }
                }
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Macedonian phonemizer (phonemic g2p + antepenultimate stress + composed numbers). */
    public static ILanguage CreateMacedonian() => new MacedonianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("macedonian", CreateMacedonian);
}
