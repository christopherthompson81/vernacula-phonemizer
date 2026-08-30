/**
 * Tashelhit / Shilha (shi) TEXT NORMALIZATION — the pre-tokenizer pass. Pure text→text; no IPA.
 * Ported from src/languages/tashelhit/normalize.ts, where every reading's corpus attestation lives.
 *
 * ⚠ NO `percent` KEY, AND THAT ABSENCE IS THE DECLARATION: the reading of this sign is absent from shi text,
 * so the tier skips the arm rather than inventing a word, and the `%` is left where it was.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Tashelhit;

public static class Normalize
{
    /**
     * The shared SYMBOL tier. Every reading is a corpus or shi.wikipedia attestation READ IN CONTEXT in the
     * digit-adjacent slot — see the TypeScript header for the quote that settles each.
     *
     * ⚠ `m²`/`m³` ARE THEIR OWN KEYS FOR A REASON THAT IS THE LANGUAGE, NOT THE TIER: shi's metre LOSES ITS
     * FINAL VOWEL under a measure word (`1 351 m` → *mitru* standing alone, but `60,000 id mitr amkkuẓ`).
     * `ExponentWords` composes head + word and cannot change the head, so composing would read *mitru
     * amkkuẓ*. The kilometre has no such alternation and composes normally.
     * ⚠ `m³/s` IS ALSO ITS OWN KEY: after `m` the tier's alternation offers a denominator OR an exponent,
     * never both, so `24.3 m³/s` would strand the `/s`.
     * ⚠ ONE-LETTER KEYS: `m` IS DECLARED AND `s`/`n` ARE NOT — bare `s`/`n` after a decimal are ×60+ in this
     * corpus and every one is a COORDINATE hemisphere letter (`28.1 n`, `60.45 s`).
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = ["kilumitr"], ["m"] = ["mitru"], ["cm"] = ["santim"], ["mm"] = ["milimitr"],
            ["kg"] = ["kilugram"], ["g"] = ["gram"],
            ["m³/s"] = ["mitr mukaɛɛab ɣ tsnat"], ["m3/s"] = ["mitr mukaɛɛab ɣ tsnat"],
            ["m²"] = ["mitr amkkuẓ"], ["m2"] = ["mitr amkkuẓ"],
            ["m³"] = ["mitr mukaɛɛab"], ["m3"] = ["mitr mukaɛɛab"],
        },
        // shi's "per" is the locative `ɣ`, invariant across denominators. The time nouns are
        // DENOMINATOR-ONLY, never standalone units — declaring `h`/`s` in `Units` is the `Il-76s` hazard.
        RateDenominators = new Dictionary<string, string> { ["h"] = "tasragt", ["s"] = "tsnat" },
        UnitPer = "ɣ",
        // The measure word is POSTPOSED, and one measurement fixes both word and position: the wiki glosses
        // its own symbol, `510.072.000 km² (yikilumitren imkuẓn)`.
        ExponentWords = new ExponentWordsDef
        {
            Squared = ["amkkuẓ"], Cubed = ["mukaɛɛab"], Position = ExponentPosition.After,
        },
        // `id` is the Berber plural marker that precedes one of these (`2.15 id mlyun`), so the pair is
        // declared as one magnitude.
        Magnitudes = ["id mlyun", "id mlyar", "mlyun", "mlyar", "mlayn", "mlayr", "milyar", "mlyaṛ"],
        // ⚠ NO `MagnitudeConnective`, AND THAT IS MEASURED: shi writes the linker `n` after the PLURAL
        // magnitude and not after the singular one, and the field is ONE string for every magnitude.
        // ⚠ THE `€` ENTRIES AFTER THE FIRST ARE SUPPRESSION SPELLINGS, NOT COUNT FORMS — the tier's "the
        // text already says it" guard tests every declared form against what follows, and shi's corpus
        // writes the noun there as `n Wuṛu` (the linker plus the construct state), which the bare `uṛu`
        // does not match. `CountForm` is what keeps them from ever being SAID.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = ["dulaṛ"],
            ["€"] = ["uṛu", "n Wuṛu", "n Uṛu"],
        },
        // shi does not inflect these nouns for count in the quantified slot, so the selector is pinned to
        // the first entry — which is also what makes the extra `€` spellings safe.
        CountForm = _ => 0,
    });

    /**
     * THE ERA MARKERS. The corpus GLOSSES ITS OWN ABBREVIATION, which is the strongest attestation there is.
     * ⚠ Ḍ BEFORE D in both pairs; `\s?` because the corpus writes `D.Ɛ` and `D. T` both.
     * ⚠ This rule EXPANDS THE ABBREVIATION THE AUTHOR WROTE; it does not adjudicate the century — the source
     * text is itself inconsistent, and the distinction between the two markers is a single dot-below.
     */
    private static readonly (string Body, string Word)[] ERA =
    [
        ("Ḍ\\.\\s?T", "ḍarat tlalit"), ("D\\.\\s?T", "dat tlalit"),
        ("Ḍ\\.\\s?Ɛ", "ḍarat Ɛisa"), ("D\\.\\s?Ɛ", "dat Ɛisa"),
    ];

    private static readonly JsRe ENTITIES = JsRegex.Compile("&nbsp;|&#(?:x[0-9a-f]+|\\d+);", "giu");
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\\u200b\\u200c\\u200d\\u2060\\ufeff]", "gu");
    private static readonly JsRe DOTTED_RUN =
        JsRegex.Compile("(?<![\\p{L}\\p{M}.])((?:\\p{L}\\.){2,4})(?!\\p{L}\\.)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe SENTENCE_ENDS = JsRegex.Compile("^[ \\u00a0]*(?:$|\\p{Lu})", "u");
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?![\\d]|,\\d)(?!\\s?%)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:\\.\\d{3})+)(?![\\d]|\\.\\d)", "gu");
    // ⚠ U+066C ARABIC THOUSANDS SEPARATOR — Moroccan text mixes the digit sets, so it must de-group too.
    private static readonly JsRe GROUP_ARABIC =
        JsRegex.Compile("(?<![\\d\\u066c])([\\d\\u0660-\\u0669]{1,3})((?:\\u066c[\\d\\u0660-\\u0669]{3})+)(?![\\d\\u0660-\\u0669]|\\u066c[\\d\\u0660-\\u0669])", "gu");
    private static readonly JsRe ARABIC_SEP = JsRegex.Compile("\\u066c", "gu");
    // The SPACE form additionally has to reject a bare adjacency that is really two numbers; requiring every
    // group to be EXACTLY three digits does that.
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?![\\d]| \\d)", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");
    private static readonly JsRe DEG_BEFORE_SILS = JsRegex.Compile("°(?=[Ss]ils)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    // ⚠ THE BARE `°` IS CLAIMED ONLY WHERE IT IS A TEMPERATURE. The discriminator is the RIGHT context: a
    // coordinate degree is followed by its ARC-MINUTE, and a bearing by a direction word. Both are rejected.
    private static readonly JsRe DEG_BARE = JsRegex.Compile(
        "(\\d)\\s?°(?!\\s*\\d+\\s*[′'’])(?!\\s*(?:Ouest|Est|Nord|Sud|agafa|anẓul|iffus|ataram|agmuḍ)(?![\\p{L}\\p{M}]))",
        "gu");
    private static readonly JsRe DECIMAL =
        JsRegex.Compile("(?<![\\d.,])(\\d+)[.,](\\d+)(?![\\d]|[.,]\\d)", "gu");

    /**
     * Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period. `body` is a regex
     * for the abbreviation WITHOUT its final dot; the dot is consumed only when the sentence visibly
     * continues, and kept when what follows is the end of the input or a capital — so a real pause is never
     * deleted. Taken verbatim from the Bambara/Lingala layer.
     */
    private static string ExpandDotted(string s, string body, string word)
    {
        var atEnd = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){body}\\.(?=[ \\u00a0]*(?:$|\\p{{Lu}}))", "gu");
        var inline = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){body}\\.", "gu");
        return Rewrite(Rewrite(s, atEnd, $"{word}."), inline, word);
    }

    /** Every rule here emits DIGITS wherever a number is involved and lets Numbers.cs speak them. */
    public static string NormalizeTashelhit(string input)
    {
        // 1) NFC AT THE ENTRY, so a literal in this file matches whichever normalization the corpus used.
        //    shi's emphatics are dot-below letters with precomposed forms (ḍ ṭ ṣ ẓ ṛ ḥ), so the ERA literals
        //    and the unit word `amkkuẓ` are trap 11 in a Latin script.
        var s = Renormalize(input, System.Text.NormalizationForm.FormC);

        // 2) HTML ENTITIES AND ZERO-WIDTH MARKS. A rendering hint is not speech, and a zero-width space
        //    between a figure and its unit would break every adjacency the steps below match on.
        s = Rewrite(Rewrite(s, ENTITIES, " "), ZERO_WIDTH, "");

        // 3) ERA MARKERS, then DOTTED RUNS — before anything can read an interior dot as a phrase break.
        foreach (var (body, word) in ERA) s = ExpandDotted(s, body, word);
        //    ⚠ AND THE MARKER IS ALSO WRITTEN WITHOUT ITS FINAL DOT (`238 D.Ɛ immt …`), which `ExpandDotted`
        //    cannot see. Run AFTER the dotted pass, so what reaches here is only the dotless form.
        foreach (var (body, word) in ERA)
            s = Rewrite(s, JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){body}(?![\\p{{L}}\\p{{M}}.])", "gu"), word);

        //    THE GENERIC DOTTED RUN ONLY REMOVES THE DOTS — reading the LETTERS is a different problem and
        //    is blocked at the data layer (no letterName table exists for shi), so this fixes the spurious
        //    pause and leaves the letters where they were. ⚠ The final dot survives when the sentence ends.
        //    ⚠ The inner calls are `JsRe.Replace`/`IsMatch`: their subject is the MATCHED RUN and the text
        //    AFTER it, never the pipeline string.
        s = Rewrite(s, DOTTED_RUN, m =>
        {
            var body = DOTS.Replace(m.Value, "");
            var rest = s[(m.Index + m.Value.Length)..];
            return SENTENCE_ENDS.IsMatch(rest) ? $"{body}." : body;
        });

        // 4) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as
        //    clause punctuation and the tail as a separate number. shi.wikipedia uses all four separators,
        //    and BOTH the period and the comma are ALSO its decimal separators, so the discriminator is the
        //    whole rule (the counts, and the two known-wrong comma readings, are in the TypeScript).
        //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK.
        s = Rewrite(s, GROUP_COMMA, m => COMMAS.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_DOT, m => DOTS.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_ARABIC, m => ARABIC_SEP.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_SPACE, m => SPACES.Replace(m.Value, ""));

        // 5) UNITS AND DEGREES, BEFORE DECIMALS — the number-unit adjacency these match on is destroyed the
        //    moment a decimal is rewritten into spaced digits, and running here keeps the tier's version-dot
        //    guard honest, since step 6 has not yet spent the decimal point.
        //    ⚠ THE DEGREE ARM FIRST, because `°C` must not present a bare `C` downstream — the engine reads
        //    ⟨c⟩ as the shi grapheme /ʃ/, so `20°C` came out *ʕʃrin ʃ*: a dropped sign AND a wrong phoneme.
        //    ⚠ AND WHERE THE SCALE WORD IS ALREADY WRITTEN the sign must not add a second one.
        s = Rewrite(s, DEG_BEFORE_SILS, " taskflt n ");
        s = Rewrite(s, DEG_C, "$1 taskflt n Silsyus");
        s = Rewrite(s, DEG_BARE, "$1 n tskflt");

        //    THE UNIT, RATE, EXPONENT AND CURRENCY ARMS — the shared tier, with this language's readings as
        //    pure data. It inherits the measured guards (NOT_VERSION, case folding, the decimal tail inside
        //    the operand, the magnitude hop, the standalone-symbol pass) rather than a copy that can drift.
        s = SYMBOLS(s);

        // 6) DECIMALS, after units and after de-grouping. The integer part stays a number for the engine's
        //    own number path; THE FRACTIONAL DIGITS ARE EMITTED ONE AT A TIME AND THE SEPARATOR IS SPENT —
        //    no separator word is sourceable in shi. The defect repaired is the PAUSE inside a quantity.
        //    ⚠ THE DIGITS ARE SPACED, not concatenated, so `21.2` becomes `21 2` and reaches the tokenizer
        //    as two numerals rather than as `212`.
        s = Rewrite(s, DECIMAL, m =>
            $"{m.Groups[1].Value} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        return s;
    }
}
