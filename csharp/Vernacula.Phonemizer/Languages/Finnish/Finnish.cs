/**
 * Finnish (fi) phonemizer — Standard Finnish (yleiskieli), the Latin orthography, canonical IPA. One of the
 * most PHONEMICALLY TRANSPARENT orthographies there is, so this is a greedy longest-match scan over the
 * grapheme table with three code rules: CONSONANT GEMINATION (a doubled consonant → [Cː]) and the
 * velar-nasal pair ⟨ng⟩→ŋː (a LONG velar nasal) and ⟨nk⟩→ŋk. Consonant GRADATION is already spelled out in
 * the orthography, and fixed word-initial stress is predictable and unwritten → not emitted.
 * Ported from src/languages/finnish/finnish.ts — see that file for the tier's field-by-field argument.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Finnish;

public static class FinnishPhonemizer
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly HashSet<string> VOWEL_LETTERS = new(Manifest.MANIFEST.VowelLetters);

    /** Phonemize a single Finnish word to canonical IPA (segmental; gemination + the velar-nasal rules;
     *  length and diphthong offglides emitted). */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word);
        var outp = new System.Text.StringBuilder();
        var i = 0;
        while (i < w.Length)
        {
            var c = w[i].ToString();
            var next = i + 1 < w.Length ? w[i + 1].ToString() : "";
            // ⟨ng⟩ → ŋː, consuming both letters — before gemination so the ⟨n⟩ is not mishandled.
            if (c == "n" && next == "g") { outp.Append("ŋː"); i += 2; continue; }
            // ⟨nk⟩ → ŋk: emit ŋ and let the k be scanned next, so kk-gemination still holds.
            if (c == "n" && next == "k") { outp.Append('ŋ'); i += 1; continue; }
            // consonant gemination: a doubled consonant letter → geminate [Cː].
            if (!VOWEL_LETTERS.Contains(c) && next == c && G.TryGetValue(c, out var gem) && gem.Length > 0)
            {
                outp.Append(gem).Append('ː');
                i += 2;
                continue;
            }
            var matched = false;
            foreach (var key in Manifest.GRAPHEME_KEYS)
            {
                if (i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0)
                {
                    outp.Append(G[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            // ⚠ NOT SILENTLY: a letter with no grapheme rule here still denotes a sound. Consulted only on
            // the MISS branch, after every grapheme has been tried.
            if (!matched)
            {
                outp.Append(LatinPhones.LatinPhone(w[i].ToString(), new PhoneOpts { Initial = i == 0, IncludeH = true }) ?? "");
                i += 1;
            }
        }
        return outp.ToString();
    }

    // A word (Finnish Latin letters incl. ä ö å + loan š ž) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a different question from TOKEN's script boundary above. */
    private const string NATIVE_CLASS = "[a-zäöåšž]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    /**
     * The shared symbol tier. Runs AFTER Normalize.cs, which is what lets that file keep its rewrites in
     * DIGITS — `13,6 cm` leaves it as `13 pilkku 6 cm`, so the number–unit adjacency is intact.
     *
     * ⚠ COUNT FORMS ARE `[singular, partitive]` AND THE DEFAULT SELECTOR IS EXACTLY RIGHT FOR FINNISH: a
     * counted noun is nominative after 1 and PARTITIVE after everything else.
     * ⚠ `km/h` AND `m/s` ARE COMPOUND KEYS, NOT `UnitPer` — the Finnish rate idiom takes the INESSIVE on the
     * denominator with no joining word at all, and `UnitPer` is one invariant string.
     * ⚠ BARE `m` IS DECLARED and the one-letter hazard was measured first; the residual exposure is a dotted
     * designation, which the tier's `NOT_VERSION` guard rejects by SEEING THE DOT — and this language's
     * normalizer never spends a decimal POINT (Finnish decimals use a comma), so the dot is still there.
     * ⚠ `°C` IS NOT ON THE TIER — Normalize.cs step 10 owns it, because it also reads the BARE `°`.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "prosentti", "prosenttia" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "dollari", "dollaria" }, ["€"] = new[] { "euro", "euroa" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            // Longest-first inside the tier; both rate keys compose the inessive denominator themselves.
            ["km/h"] = new[] { "kilometri tunnissa", "kilometriä tunnissa" },
            ["m/s"] = new[] { "metri sekunnissa", "metriä sekunnissa" },
            ["km"] = new[] { "kilometri", "kilometriä" },
            ["cm"] = new[] { "senttimetri", "senttimetriä" },
            ["mm"] = new[] { "millimetri", "millimetriä" },
            ["kg"] = new[] { "kilogramma", "kilogrammaa" },
            ["m"] = new[] { "metri", "metriä" },
        },
        // Finnish welds the measure word onto the FRONT as one compound — *neliökilometriä* — which is
        // `compound`, never `before` (that would give two tokens).
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "neliö" }, Cubed = new[] { "kuutio" }, Position = ExponentPosition.Compound,
        },
        // The magnitude hop. Finnish takes NO connective, so `MagnitudeConnective` stays undeclared.
        Magnitudes = new[] { "miljoona", "miljoonaa", "miljardi", "miljardia", "biljoona", "biljoonaa" },
        Ampersand = "ja",
        // The corpus's `×` is a dimension cross and a multiplier; Finnish says *kertaa* for both, so `by`
        // defaults to `times`.
        Multiply = new MultiplyDef { Times = "kertaa" },
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string rawInput)
        {
            var input = SYMBOLS(Normalize.NormalizeFinnishInitialisms(Normalize.NormalizeFinnish(rawInput)));
            return Clauses.AssembleClauses(input, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // ≤9 digits fits a safe integer → compose; longer → read the RAW STRING digit-by-digit so
                    // the float conversion cannot lose precision or go exponential.
                    var tok = m.Groups[2].Value;
                    var words = tok.Length <= 9 ? Numbers.NumberToWords(Js.Number(tok), tok) : Numbers.ReadDigits(tok);
                    foreach (var wd in words.Split(' ')) sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Finnish phonemizer (greedy g2p + gemination + the velar-nasal rules + cardinal numbers). */
    public static ILanguage CreateFinnish() => new Engine();

    internal static void RegisterSelf() => Registry.Register("finnish", () => CreateFinnish());
}
