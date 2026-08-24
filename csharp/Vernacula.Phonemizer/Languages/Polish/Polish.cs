/**
 * Polish (pl) phonemizer — canonical IPA. Rule g2p (g2p.ts) + fixed PENULTIMATE stress
 * (the near-universal Polish pattern). text() tokenizes words / numbers / punctuation; numbers are
 * composed by numbers.ts (Slavic three-way magnitude agreement) and re-phonemized as Polish words.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Polish;

public static class PolishPhonemizer
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** One Polish word → canonical IPA with penultimate primary stress. */
    public static string PhonemizeWord(string word)
    {
        var segs = G2p.ToSegments(word);
        var nucIdx = segs.Select((s, i) => s.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        // stressed nucleus = penultimate (or the only one)
        var stressAt = nucIdx.Count >= 2 ? nucIdx[^2] : (nucIdx.Count > 0 ? nucIdx[0] : -1);
        var outp = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressAt) outp += "ˈ";
            outp += segs[i].Ph;
        }
        return outp.Normalize(System.Text.NormalizationForm.FormC);
    }

    /**
     * Shared SYMBOL tier — %, currency signs and unit abbreviations, matched only when a NUMBER is
     * adjacent, which is why it runs LAST and why the decimal comma is left in the text for it to see.
     *
     * `countForm` is Polish's own, not `slavicCountForm`: Polish sends a compound ending in 1 to the genitive
     * plural (dwadzieścia jeden procent) where Russian keeps the singular. See the note in normalize.ts.
     *
     * SOURCED: procent · procenty · procent (the genitive plural of procent is the bare stem); dolar/funt/jen
     * decline regularly, euro is indeclinable. Polish takes NO connective between a magnitude and the currency
     * noun ("pięć milionów dolarów"), so `magnitudeConnective` is deliberately omitted.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
        // `i` ×846 in this corpus. The tier spaces it on both sides, because `B&B` is two
        // initialisms and joining them would make one token.
        // `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
        // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
        // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
        // One word, so `by` defaults to it; this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "razy" },
        Ampersand = "i",
        Percent = new[] { "procent", "procenty", "procent", "procenta" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dolar", "dolary", "dolarów", "dolara" },
            ["€"] = new[] { "euro" },
            ["£"] = new[] { "funt", "funty", "funtów", "funta" },
            ["¥"] = new[] { "jen", "jeny", "jenów", "jena" },
            // Polish's own currency, which could not be declared while the tier keyed currencies as single
            // characters — the Polish run reported exactly this gap and had to omit złoty.
            ["zł"] = new[] { "złoty", "złote", "złotych", "złotego" },
            ["PLN"] = new[] { "złoty", "złote", "złotych", "złotego" },
        },
        Magnitudes = new[] { "tysiąca", "tysięcy", "miliona", "milionów", "miliarda", "miliardów" },
        Units = Normalize.UNITS.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<string>)kv.Value, StringComparer.Ordinal),
        // MIGRATION TEST: km²/mm² composed by the shared tier. The adjective agrees, so it carries the
        // same three count forms the unit nouns do.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kwadratowy", "kwadratowe", "kwadratowych", "kwadratowego" },
            Cubed = new[] { "sześcienny", "sześcienne", "sześciennych", "sześciennego" },
        },
        CountForm = Normalize.PlCountForm,
    });

    // The number token carries its DECIMAL COMMA (Polish's decimal mark) so the comma is not read as clause
    // punctuation — `14,7` was coming out as a phrase break between "czternaście" and "siedem".
    /**
     * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
     * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
     * use, i.e. a foreign name.
     */
    private const string NATIVE_CLASS = "[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]";
    /**
     * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_CLASS`
     * above is the inventory — a word it rejects carries a letter this language does not use. See
     * `core/hostWord.ts` for why the inventory and the script boundary are two different questions.
     */
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    // ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
    // out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
    // rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
    // every gate: no digit or raw mark survives and nothing VANISHES.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+(?:,\\d+)?)|([.?!,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // order: Polish rewrites (grouping, abbreviations, ordinals, clock, ranges, signs) →
            // INITIALISMS (after abbreviations, so `m.in.` is not spelled EM-EN) → the shared symbol tier last
            // (it needs the number still adjacent to its unit/sign). Roman numerals arrive already converted
            // at the registry seam, so the roman-vs-initialism hazard cannot arise here.
            var normalized = SYMBOLS(Normalize.NormalizePolishInitialisms(Normalize.NormalizePolish(input)));
            return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var bits = m.Groups[2].Value.Split(',');
                    var intPart = bits[0];
                    var frac = bits.Length > 1 ? bits[1] : null;
                    foreach (var wd in PolishNumbers.NumberToWords(Js.Number(intPart)).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                    if (frac is not null)
                    {
                        sink.Emit(PhonemizeWord("przecinek")); // the Polish name of the decimal comma
                        foreach (var d in Js.CodePoints(frac))
                            foreach (var wd in PolishNumbers.NumberToWords(Js.Number(d)).Split(' '))
                                sink.Emit(PhonemizeWord(wd));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Polish phonemizer. */
    public static ILanguage CreatePolish() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("polish", CreatePolish);
        Registry.RegisterRomanPolicy("pl", RomanOrdinals.ROMAN_POLICY);
    }
}
