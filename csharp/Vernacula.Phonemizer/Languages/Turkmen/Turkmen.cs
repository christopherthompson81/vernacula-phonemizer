/**
 * Standard Turkmen (tk) phonemizer — Türkmençe, Oghuz Turkic, Latin script, canonical IPA. Near-phonemic
 * (no digraphs — one sound per letter), so a direct grapheme scan. The HALLMARK is the INTERDENTAL
 * fricatives ⟨s⟩→[θ] / ⟨z⟩→[ð], shared with Bashkir. Word-final (oxytone) stress, the Turkic default.
 * Ported from src/languages/turkmen/turkmen.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkmen;

public static class TurkmenPhonemizer
{
    private static readonly IReadOnlyDictionary<string, string> G = Manifest.DEF.Graphemes;
    private static readonly IReadOnlyDictionary<string, string> CLAUSE_MARK = Manifest.DEF.ClausePunctuation;
    private static readonly IReadOnlySet<string> VOWEL = Ipa.IPA_VOWEL;
    private static readonly IReadOnlySet<string> NASAL = Manifest.NASAL;

    private static readonly IReadOnlySet<string> STRESS_FRICATIVE = new HashSet<string>(
        ["f", "v", "θ", "ð", "ʃ", "ʒ", "x", "χ", "h"], StringComparer.Ordinal);

    /** Sonority class (higher = more sonorous): vowel 6, glide 5, liquid 4, nasal 3, fricative 2,
     *  affricate 1, stop 0. ⚠ THE AFFRICATE TEST PRECEDES THE FRICATIVE LIST — order is the tie-break. */
    private static int Sonority(string seg)
    {
        if (VOWEL.Contains(seg)) return 6;
        if (seg == "j" || seg == "w") return 5;
        if (seg == "l" || seg == "ɾ" || seg == "r") return 4;
        if (NASAL.Contains(seg)) return 3;
        if (seg.Contains('\u0361')) return 1; // affricate (t͡ʃ d͡ʒ) — the tie bar
        if (STRESS_FRICATIVE.Contains(seg)) return 2;
        return 0; // stop (p b t d k ɡ)
    }

    /** Phonemize one Turkmen word → canonical IPA: direct grapheme scan + word-final stress. */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var segs = new List<string>();
        var at0 = 0;
        // JS `for (const ch of w)` iterates by CODE POINT, and `at0` counts those, not UTF-16 units.
        foreach (var ch in Js.CodePoints(w))
        {
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer
            // typed. Reached only when every rule above has declined, so the language's own reading wins.
            var ph = G.TryGetValue(ch, out var g)
                ? g
                : LatinPhones.LatinPhone(ch, new PhoneOpts { Initial = at0 == 0, IncludeH = true });
            at0 += 1;
            if (ph is not null) segs.Add(ph);
        }
        // Word-final (oxytone) stress — the Turkic default: ˈ before the MAXIMAL onset of the last vowel's
        // syllable. Native Turkmen has no onset clusters; loanwords do (plan, sport→θp, klub), so back up
        // over the whole onset by sonority sequencing plus the fricative- and nasal-initial clusters.
        var vidx = new List<int>();
        for (var k = 0; k < segs.Count; k++)
            if (VOWEL.Contains(segs[k])) vidx.Add(k);
        if (vidx.Count > 0)
        {
            var nucleus = vidx[^1];
            var at = nucleus;
            if (at > 0 && !VOWEL.Contains(segs[at - 1])) at--; // always include the immediate onset consonant
            while (at > 0 && !VOWEL.Contains(segs[at - 1]))
            {
                // extend only over a valid COMPLEX onset: obstruent + liquid/glide (pl, kr), fricative +
                // stop (θp, θt), or nasal + stop — NOT nasal/liquid + liquid/glide (a coda + the next onset).
                var p = segs[at - 1];
                var l = segs[at];
                var obstruentLiquid = Sonority(p) <= 2 && Sonority(l) >= 4;
                var fricStop = Sonority(p) == 2 && Sonority(l) <= 1;
                var nasalStop = NASAL.Contains(p) && Sonority(l) <= 1;
                if (!(obstruentLiquid || fricStop || nasalStop)) break;
                at--;
            }
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs).Normalize(NormalizationForm.FormC);
    }

    /**
     * A digit run → spoken Turkmen, phonemized through the same grapheme scan.
     *
     * ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
     * refuse to COMPOSE — the float has already lost the low digits — but the refusal returned the digit
     * string, which no g2p in this fleet reads. Read it out digit-at-a-time through this engine's own
     * number words instead; see Core/Numbers.cs `SpellDigits` for the cost.
     */
    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        if (!Numbers.IsSafeInteger(n))
            return Core.Numbers.SpellDigits(digits, Manifest.DEF.Numbers, PhonemizeWord);
        return Core.Numbers.RenderNumber(n, Manifest.DEF.Numbers, PhonemizeWord, Numbers.TurkmenNumberWords);
    }

    /**
     * The shared SYMBOL tier. Every word is a tk.wikipedia TOKEN attestation whose examples were read, and
     * `inedördül` comes from the corpus's own prose — "19,0 inedördül metre deň" — which fixes the word AND
     * its position, before the unit.
     *
     * ⚠ NO BARE `g` OR `t`, AND NO `s`. This corpus carries Russian and English bibliography where a
     * one-letter key would claim an initial, and Turkmen's own `-s` is a possessive. `sm` IS declared,
     * because the corpus writes `Gar örtügi 5-8 sm` and the two-letter key cannot collide with anything.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "göterim" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dollar" },
            ["€"] = new[] { "ýewro" },
            ["₼"] = new[] { "manat" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometr" }, ["sm"] = new[] { "santimetr" }, ["mm"] = new[] { "millimetr" },
            ["kg"] = new[] { "kilogram" }, ["ga"] = new[] { "gektar" }, ["m"] = new[] { "metr" },
            ["cm"] = new[] { "santimetr" },
        },
        // Turkmen does not say "A per B": the denominator takes the locative and stands alone (*sagatda*),
        // which is Basque's shape — `UnitPer` is the empty string and `RateDenominators` carries the form.
        UnitPer = "",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["sag"] = "sagatda", ["h"] = "sagatda", ["s"] = "sekuntda",
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "inedördül" },
            Cubed = new[] { "kub" },
            Position = ExponentPosition.Before,
        },
        Ampersand = "we",
        // Turkmen writes the magnitude word after the figure and often after a DECIMAL (`30,3 million km²`),
        // so the tier must hop it to reach a unit on the far side. Turkic magnitudes do not inflect.
        // `müň` is the native thousand; `million`/`milliard` arrive from step 2's expansion.
        Magnitudes = new[] { "müň", "million", "milliard" },
    });

    // ⚠ THE DECIMAL COMMA IS **NOT** SPANNED HERE, AND THAT IS A MEASURED REFUSAL RATHER THAN AN OVERSIGHT.
    // Every other layer in this sweep spans it and emits the separator's own NAME, and Turkmen has no such
    // word this corpus will source: `otur`/`otyr` are the VERB "sit", `wergul` scores 0, and `nokat` names
    // the DOT. So the comma stays a CLAUSE PAUSE, which keeps the two halves audibly separate and invents
    // nothing. The shared tier is unaffected: it matches `132,8` as one quantity in the TEXT, before this
    // tokenizer ever sees it.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for
     * these letters. A token this class REJECTS carries a letter the language does not use — i.e. a
     * foreign name.
     */
    private const string NATIVE_CLASS = "[a-zäçžňöşüýA-ZÄÇŽŇÖŞÜÝ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // Normalize FIRST — its tilde fold, ordinal, degree and sign steps need the figure and its
            // written suffix still adjacent, which the tier would break — then the INITIALISM pass, then
            // the shared symbol tier, which matches a unit only when a NUMBER is adjacent.
            var prepared = SYMBOLS(Normalize.NormalizeTurkmenInitialisms(Normalize.NormalizeTurkmen(input)));
            return Clauses.AssembleClauses(prepared, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    sink.Emit(Number(m.Groups[2].Value));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Turkmen phonemizer (direct grapheme g2p + the interdental hallmark + final stress). */
    public static ILanguage CreateTurkmen() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("turkmen", CreateTurkmen);
        Registry.RegisterRomanPolicy("tk", RomanOrdinals.ROMAN_POLICY);
    }
}
