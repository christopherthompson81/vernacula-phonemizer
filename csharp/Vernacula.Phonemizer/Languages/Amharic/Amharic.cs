/**
 * Native Amharic / አማርኛ (am) text phonemizer — canonical IPA. Ethiopian Semitic, written in
 * the Ge'ez/Fidäl SYLLABARY-abugida: each codepoint is a whole CV syllable (the vowel is baked into the glyph),
 * so the g2p is a flat lookup (fidel.tsv, one Ethiopic codepoint → its CV) rather than a Brahmic matra/virama
 * engine. Two features are UNWRITTEN: GEMINATION (phonemic but unmarked — rendered single, folded vs the referee)
 * and the 6th-order vowel [ɨ], which is epenthetic and DELETED word-finally (ሁለት→hulət) and before a vowel.
 * Ejectives kʼ tʼ t͡ʃʼ pʼ t͡sʼ.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Amharic;

public sealed class AmharicNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    public string TeenPrefix { get; init; } = "";
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
}

public sealed class AmharicDef
{
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public AmharicNumbersDef Numbers { get; init; } = new();
}

/** Read a Latin run with another language's engine — injected from the registry. */
public delegate string ForeignPhonemizer(string latin);

public sealed class AmharicPhonemizer : ILanguage
{
    private static readonly AmharicDef DEF = LoadManifest.Load<AmharicDef>("languages/amharic", "amharic.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static AmharicNumbersDef NUM => DEF.Numbers;

    /** One Amharic word → canonical IPA: fidel→CV lookup + 6th-order ɨ deletion (shared Ge'ez engine). */
    public static readonly Func<string, string> PhonemizeWord = Geez.MakeGeezG2P("languages/amharic", "fidel.tsv");

    // ── Numbers (decimal; Amharic) ────────────────────────────────────────────────
    private static string NumberToText(double n)
    {
        if (n < 0) return "";
        if (n < 10) return NUM.Units[(int)n];
        if (n == 10) return NUM.Ten;
        if (n < 20) return $"{NUM.TeenPrefix} {NUM.Units[(int)n - 10]}";
        if (n < 100)
        {
            int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
            // ⚠ THE TENS ARE KEYED "20".."90", not "2".."9". Looking up the digit alone returns undefined and the
            // ten is silently DROPPED — 25 reads "amɨst", 1998 reads thousand-nine-hundred-EIGHT.
            return NUM.Tens[Js.NumberToString(t * 10)] + (u != 0 ? $" {NUM.Units[u]}" : "");
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100), r = n % 100;
            return $"{(h > 1 ? NUM.Units[(int)h] + " " : "")}{NUM.Hundred}{(r != 0 ? " " + NumberToText(r) : "")}";
        }
        if (n < 1_000_000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            return $"{(th > 1 ? NumberToText(th) + " " : "")}{NUM.Thousand}{(r != 0 ? " " + NumberToText(r) : "")}";
        }
        // ⚠ Scales above ሺ are European loans (ሚሊዮን / ቢሊዮን) and, unlike the bare ሺ / መቶ, KEEP their multiplier at
        // 1 — 10⁶ is አንድ ሚሊዮን. Without a composer for them the digit string is emitted raw, and the fidel g2p then
        // renders it as EMPTY IPA.
        foreach (var (value, scale) in new (double, string)[] { (1_000_000_000d, NUM.Billion), (1_000_000d, NUM.Million) })
        {
            if (n >= value)
            {
                double q = Math.Floor(n / value), r = n % value;
                return $"{NumberToText(q)} {scale}{(r != 0 ? " " + NumberToText(r) : "")}";
            }
        }
        return Js.NumberToString(n);
    }

    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // ⚠ OUT OF RANGE MUST STILL BE READ. Returning `digits` leaks ASCII into the IPA — the 10¹² cap is a
        // limit of the authored magnitude words, not a reason to stop speaking. Digit-at-a-time, the same
        // fallback the fleet uses at the 2^53 cliff.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return string.Join(" ", Js.CodePoints(digits).Select(c => PhonemizeWord(NumberToText(Js.Number(c)))));
        return string.Join(" ", NumberToText(n).Split(' ').Select(w => PhonemizeWord(w)));
    }

    // Ethiopic letters (U+1200–U+135A, incl. combining marks) · Arabic digits · Ethiopic + ASCII punctuation.
    //
    // ⚠ THE LETTER CLASS MUST NOT REACH THE PUNCTUATION SUB-BLOCK. This is the known hazard for a script whose
    // punctuation lives inside its own Unicode block — Burmese and Khmer each dropped EVERY sentence boundary that
    // way. Here the class ends at ፚ = U+135A while ። ፣ ፤ ፥ ፦ ፧ ፨ are U+1362–U+1368, above the range, so the letter
    // branch cannot swallow them. DO NOT widen this to the full block without moving the punctuation branch ahead
    // of it.
    private static readonly JsRe TOKEN = JsRegex.Compile("([ሀ-ፚ]+)|(\\d+)|([።፣፤፥፦፧፨.?!,;:])", "gu");

    // በመቶ "in a hundred" is the standard percent construction, postposed; the currency and unit words are the
    // standard loans, emitted in Ge'ez script and read by the ordinary fidel g2p.
    // ⚠ THE MAGNITUDE LIST IS LOAD-BEARING: text writes "US$14.7 ቢሊዮን", and without it the currency noun is
    // inserted BEFORE the written magnitude. ቢልየን is a spelling variant listed so it is MATCHED, not emitted.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — this language is one of the fourteen that
        // still had no word declared, so `&` was DROPPED outright. እና is ×1545 TOKEN in its own corpus.
        Ampersand = "እና",
        // `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
        // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS.
        Multiply = new MultiplyDef { Times = "በ" },
        Percent = new[] { "በመቶ" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "ዶላር" }, ["¥"] = new[] { "የን" }, ["£"] = new[] { "ፓውንድ" },
        },
        // `5 km` read as *amɨst ˈʊkm*: no km or m was declared at all. Verified in am_et:
        // ሜትር ×15, ኪሎ ሜትር ×3, ኪሎ ግራም ×3.
        // NOTED, NOT CHANGED: the corpus writes ኪሎ ሜትር and ኪሎ ግራም with a SPACE, and the ኪሎግራም already declared
        // here occurs ×0. Both are current Amharic and the space does not change the reading.
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["kg"] = new[] { "ኪሎግራም" }, ["km"] = new[] { "ኪሎ ሜትር" }, ["m"] = new[] { "ሜትር" },
        },
        // THE TWO POWERS SIT ON OPPOSITE SIDES, which is why `position` takes a per-power record. This corpus
        // writes `783,562 ስኩዌር ኪ.ሜ.` (×4, word BEFORE) and `120-160 ሜትር ኪዩብ` (×3, word AFTER).
        // ⚠ ካሬ ×8 is NOT the squared word to use, despite outnumbering ስኩዌር: every instance is the SQUARE MILE
        // in the parenthetical gloss beside a square-kilometre figure.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "ስኩዌር" },
            Cubed = new[] { "ኪዩብ" },
            Position = new ExponentPositionSpec { Squared = ExponentPosition.Before, Cubed = ExponentPosition.After },
        },
        Magnitudes = new[] { "ሚሊዮን", "ቢሊዮን", "ቢልየን", "ትሪሊዮን" },
    });

    /** Text normalization. SYMBOLS is threaded through it — the ordering is load-bearing (normalize.ts §9). */
    private static readonly Func<string, string> NORMALIZE = Normalize.MakeAmharicNormalizer(NumberToText, SYMBOLS);

    private readonly ForeignPhonemizer? _foreign;

    public AmharicPhonemizer(ForeignPhonemizer? foreign = null) => _foreign = foreign;

    public string Text(string input)
    {
        return Clauses.AssembleClauses(NORMALIZE(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(Number(m.Groups[2].Value));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Amharic phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateAmharic(ForeignPhonemizer? foreign = null) => new AmharicPhonemizer(foreign);

    // TS: createAmharic(readAsEnglish) — the registry threads its English reader in.
    internal static void RegisterSelf() =>
        Registry.Register("amharic", () => CreateAmharic(latin => Registry.ReadAsEnglish(latin)));
}
