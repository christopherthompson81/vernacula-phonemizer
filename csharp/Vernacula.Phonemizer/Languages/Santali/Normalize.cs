/**
 * Santali / ᱥᱟᱱᱛᱟᱲᱤ (sat) text normalization — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Ported from src/languages/santali/normalize.ts, whose header carries the whole evidence base: the
 * script and digit censuses that decided this layer is Ol-Chiki-only and `\p{Nd}`-keyed (an ASCII `\d`
 * would miss 93% of the corpus's digits), the two defects that dominate — the ASCII PERIOD standing in
 * for ⟨ᱹ GAAHLAA⟩ (246×) and the ASCII HYPHEN for ⟨ᱼ PHAARKAA⟩ (99×) — the sourcing for every word
 * emitted, and every class declined with its count (the decimal word on register, the clock, the math
 * signs on SYNTAX rather than vocabulary, the minus, °F and the coordinate degrees).
 * Nothing is re-derived here.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Santali;

public static class Normalize
{
    /** Ol Chiki LETTERS and signs — U+1C5A–U+1C7D, exactly the class Santali.cs's `TOKEN` claims. */
    private const string OL = "\\u1C5A-\\u1C7D";
    /** One Ol Chiki letter or sign, as a bare class for lookarounds. */
    private const string O = "[" + OL + "]";
    /** The Ol Chiki VOWEL letters — ᱚ ᱟ ᱤ ᱩ ᱮ ᱳ. ⟨ᱹ GAAHLAA⟩ is a vowel diacritic and cannot attach to
     *  anything else, which is what makes step 2's consonant test sound. */
    private const string VOWEL = "[\\u1C5A\\u1C5F\\u1C64\\u1C69\\u1C6E\\u1C73]";
    /** ⟨ᱟ⟩ U+1C5F alone — the vowel step 7's dot rule keys on. 226 of the 246 vowel-preceded dots follow
     *  it, and every non-ᱟ dotted token in the corpus is an INITIALISM; see the TS for the measurement
     *  that narrowed this from the whole vowel class (which glued `ᱯᱤ.ᱮᱥ` shut). */
    private const string A = "\\u1C5F";
    /** Any Unicode decimal digit — `\p{Nd}`, so Ol Chiki ᱐-᱙ counts. NEVER `\d` (93% of this corpus). */
    private const string D = "\\p{Nd}";

    private const string GAAHLAA = "ᱹ";
    private const string MU_GAHLA = "ᱺ";
    private const string PHAARKAA = "ᱼ";
    private const string RELAA = "ᱻ";

    // Step 1. ZWSP, ZWNJ, ZWJ, LRM, RLM, PDF — spelled as escapes here; the TS writes them literally.
    private static readonly JsRe INVISIBLES = JsRegex.Compile(
        $"(?<={O})[\\u200B\\u200C\\u200D\\u200E\\u200F\\u202C](?={O})", "gu");
    private static readonly JsRe NBSP_ENTITY = JsRegex.Compile("&nbsp;", "gu");

    // Step 2. ⚠ The lookbehind allows ⟨ᱸ MU⟩/⟨ᱹ GAAHLAA⟩/⟨ᱺ MU-GAHLA⟩ (U+1C78–1C7A) between the vowel
    // LETTER and the RELAA — those two signs are TRANSPARENT here, and a bare one-character guard read
    // one of them as a consonant and rewrote a legitimate length mark away.
    private static readonly JsRe RELAA_AFTER_CONSONANT = JsRegex.Compile(
        $"(?<={O})(?<!{VOWEL}[\\u1C78-\\u1C7A]?){RELAA}", "gu");

    // Step 2b. An orphan sign is a punctuation mark somebody typed with the wrong key.
    private static readonly JsRe ORPHAN_MU_GAHLA = JsRegex.Compile($"(?<!{O}){MU_GAHLA}", "gu");
    private static readonly JsRe ORPHAN_GAAHLAA_RUN = JsRegex.Compile($"(?<!{O}){GAAHLAA}{{2,}}", "gu");

    // Step 3. A digit-flanked ⟨ᱹ GAAHLAA⟩ is a decimal separator (×16), folded onto the `.` behaviour.
    private static readonly JsRe GAAHLAA_DECIMAL = JsRegex.Compile($"(?<={D}){GAAHLAA}(?={D})", "gu");

    // Step 4. De-group. ⚠ `{2,3}` and repeated, because BOTH conventions are present: western 3-3-3 and
    // the language's own Indian 2-2-3. And a grouping comma may not follow a lone `0`.
    private static readonly JsRe GROUPED = JsRegex.Compile(
        $"(?<={D})(?<!(?<!{D})0)(?:,(?={D}{{2,3}}(?!{D})))", "gu");

    // Step 5. The native dotted unit abbreviations `ᱠ.ᱢ.` and `ᱢ.`, which no Latin-keyed table can reach.
    private static readonly JsRe KM_DOTTED = JsRegex.Compile(
        $"(?<!{D})({D}+(?:\\.{D}+)?)\\s*(?<!{O})ᱠ\\.ᱢ\\.?(?!{O})", "gu");
    private static readonly JsRe M_DOTTED = JsRegex.Compile(
        $"(?<!{D})({D}+(?:\\.{D}+)?)\\s*(?<!{O})ᱢ\\.(?!{O})", "gu");

    // Step 5b. `sq mi` — the imperial gloss this corpus puts after every metric area, and it read as
    // garbage in English too (*sk mˈiː*). Both words attested in exactly this slot.
    private static readonly JsRe SQ_MI = JsRegex.Compile(
        $"(?<={D})\\s*sq\\s*mi(?![\\p{{sc=Latn}}])", "gu");

    // Step 6. The ASCII hyphen as ⟨ᱼ PHAARKAA⟩, narrowly — only the finite-verb enclitic.
    private static readonly JsRe HYPHEN_ENCLITIC = JsRegex.Compile(
        $"(?<={O})-(ᱟᱜ?|ᱟᱭ|ᱮ)(?![{OL}])", "gu");

    // Step 7. The ASCII period as ⟨ᱹ GAAHLAA⟩, and the dotted initialism.
    private static readonly JsRe DOT_GAAHLAA_INNER = JsRegex.Compile($"(?<={A})\\.(?={O})", "gu");
    private static readonly JsRe DOT_GAAHLAA_FINAL = JsRegex.Compile($"(?<={O}{O}{A})\\.(?![{OL}.])", "gu");
    private static readonly JsRe DOT_INITIALISM = JsRegex.Compile($"(?<={O})\\.(?=\\s*{O})", "gu");
    private static readonly JsRe DOT_INITIALISM_END = JsRegex.Compile(
        $"(?<={O})\\.(?!\\s*[{OL}])(?=\\s|$|[),])", "gu");

    // Step 8. Ranges — the attested infix `ᱠᱷᱚᱱ`. ⚠ The guards are the point: the SAME corpus writes
    // `᱑ - ᱐ = ᱑` and `᱐ - ᱑ = -᱑`, so any match with an arithmetic operator in view is refused; a left
    // operand preceded by a colon is refused (the clock field); and the right-hand colon guard is a colon
    // followed by a DIGIT, never a colon-space-name (which is an awards list).
    private const string RANGE_DASH = "[-–—" + PHAARKAA + "]";
    private static readonly JsRe RANGE = JsRegex.Compile(
        $"(?<![-+×÷=<>]\\s?)(?<![:.]{D}{{0,4}})(?<!{D})({D}+(?:\\.{D}+)?)\\s?{RANGE_DASH}\\s?({D}+(?:\\.{D}+)?)"
        + $"(?!\\s?[-+×÷=<>])(?!{D})(?!:{D})", "gu");

    // Step 9. `°C` — the scale name, and only that one. `°F` and the coordinate `°N/E/S/W` are refused
    // WHOLE: no Fahrenheit word and no sourced direction words, and half a reading is worse than none.
    private static readonly JsRe DEG_C = JsRegex.Compile($"({D})\\s*°\\s*C(?![\\p{{sc=Latn}}])", "gui");
    // Step 9b. The bare `°`, where the noun after it is already Santali — the corpus's DOMINANT shape.
    private static readonly JsRe DEG_BARE = JsRegex.Compile(
        $"({D})\\s*°(?![\\p{{sc=Latn}}{D}′″'\"])", "gu");

    /**
     * Step 10 — the shared symbol tier. Trap 47's test is "can the tier SAY it?", and for Santali it can:
     * percent, currency and units are all POSTPOSED after the numeral, the exponent word is an invariant
     * modifier, and there is no number agreement to express. ⚠ `UnspacedScript` is NOT set: Santali is
     * spaced and Ol Chiki letters are `\p{L}`, so the tier's own guards are right here.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // Postposed. The NATIVE calque `ᱥᱟᱭᱠᱚᱲᱟ` ("per hundred", on the engine's own ᱥᱟᱭ = 100) beat the
        // loan on every axis — see the TS header.
        Percent = ["ᱥᱟᱭᱠᱚᱲᱟ"],
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            // ⚠ `US$` and `HK$` are their own keys because a bare `$` is letter-bounded on the left and
            // cannot match inside a code prefix. The TS relies on insertion order; here the ordering is
            // the TIER's, not this Dictionary's — `NormalizeSymbols` sorts the keys longest-first itself,
            // which is what makes `US$` win over `$` regardless of enumeration order.
            // Both emit the plain dollar noun — no Santali name for the Hong Kong dollar is attested.
            ["US$"] = ["ᱰᱚᱞᱟᱨ"],
            ["HK$"] = ["ᱰᱚᱞᱟᱨ"],
            ["$"] = ["ᱰᱚᱞᱟᱨ"],
            ["৳"] = ["ᱴᱟᱠᱟ"],
            ["₹"] = ["ᱴᱟᱠᱟ"],
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            // ⚠ BARE `m` IS DELIBERATELY ABSENT (trap 46) — the Ol Chiki `ᱢ.` form is what this corpus
            // writes and step 5 claims it. `cm` is robustness for plausible input, not a measured repair.
            ["km"] = ["ᱠᱤᱞᱚᱢᱤᱴᱚᱨ"],
            ["cm"] = ["ᱥᱮᱱᱴᱤᱢᱤᱴᱚᱨ"],
            ["mm"] = ["ᱢᱤᱞᱤᱢᱤᱴᱚᱨ"],
            ["ft"] = ["ᱯᱷᱤᱴ"],
        },
        // `ᱵᱚᱨᱜᱚ` PRECEDES its noun — `ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ`. ⚠ `Cubed` is OMITTED, not guessed: no cube word is
        // attested and `km³` is ×0 here, so the tier re-emits `³` where the leak gate can see it.
        ExponentWords = new ExponentWordsDef
        {
            Squared = ["ᱵᱚᱨᱜᱚ"],
            Position = ExponentPosition.Before,
        },
    });

    /**
     * Santali text normalization. A numbered, ORDER-DEPENDENT sequence; the TS states the coupling that
     * pins each step where it is.
     */
    public static string NormalizeSantali(string input)
    {
        var s = input;

        // 1. INVISIBLES AND MARKUP RESIDUE. Each invisible ENDS THE WORD and is dropped (`ᱦᱚ‌ᱲ` → *hɔ ɽ*);
        //    Ol Chiki is an alphabet with no ligature for them to control. `&nbsp;` is repaired FIRST,
        //    because step 10's tier matches a unit only when a number is ADJACENT.
        s = Rewrite(s, INVISIBLES, "");
        s = Rewrite(s, NBSP_ENTITY, " ");

        // 2. ⟨ᱻ RELAA⟩ AFTER A CONSONANT is a keyboard slip for ⟨ᱼ PHAARKAA⟩ — adjacent code points, both
        //    hyphen-shaped. NARROWED to the consonant case: after a VOWEL, RELAA may be doing its own job
        //    as the length mark, and Santali.cs reads it there.
        s = Rewrite(s, RELAA_AFTER_CONSONANT, PHAARKAA);

        // 2b. An ORPHAN sign is punctuation typed with the wrong key: a standalone ⟨ᱺ⟩ is a COLON (the
        //     glyph is two dots), a run of standalone ⟨ᱹ⟩ is an ELLIPSIS. Narrow on the left edge, because
        //     both are ordinary and frequent when ATTACHED. A SINGLE orphan ⟨ᱹ⟩ is deliberately not
        //     claimed — it is an initialism dot glued to the next segment, already harmless.
        s = Rewrite(s, ORPHAN_MU_GAHLA, ":");
        s = Rewrite(s, ORPHAN_GAAHLAA_RUN, "…");

        // 3. A DIGIT-FLANKED ⟨ᱹ GAAHLAA⟩ IS A DECIMAL SEPARATOR. Today the ᱹ form reads as NOTHING, so
        //    `᱓᱐ᱹ᱑` silently merges. Folded onto the `.` behaviour rather than given a word.
        s = Rewrite(s, GAAHLAA_DECIMAL, ".");

        // 4. DE-GROUP — first among the number rules: a grouping comma is otherwise clause punctuation and
        //    `᱑᱐,᱐᱐᱐` reads *ɡel , sun*, the quantity destroyed rather than merely paused.
        s = Rewrite(s, GROUPED, "");

        // 5. THE NATIVE DOTTED UNIT ABBREVIATIONS, above steps 6/7 because those spend the dots.
        s = Rewrite(s, KM_DOTTED, "$1 ᱠᱤᱞᱚᱢᱤᱴᱚᱨ");
        s = Rewrite(s, M_DOTTED, "$1 ᱢᱤᱴᱚᱨ");

        // 5b. `sq mi`, ABOVE the symbol tier so the pair never reaches it as two unrelated fragments.
        s = Rewrite(s, SQ_MI, " ᱵᱚᱨᱜᱚ ᱢᱟᱭᱤᱞ");

        // 6. THE ASCII HYPHEN AS ⟨ᱼ PHAARKAA⟩, narrowly — only the finite-verb enclitic (70 of the 99
        //    hyphens). The ~29 genuine compound hyphens are left alone. Above step 8, which is
        //    DIGIT-flanked where this is LETTER-flanked, so the disjointness is checkable.
        s = Rewrite(s, HYPHEN_ENCLITIC, PHAARKAA + "$1");

        // 7. THE ASCII PERIOD AS ⟨ᱹ GAAHLAA⟩, AND THE DOTTED INITIALISM. The discriminator is the
        //    language's own phonology: GAAHLAA is a VOWEL diacritic. Where the two arms overlap they
        //    CONVERGE — `gahla` maps i→i and u→u, so the substitution is a no-op and its only effect is
        //    the spurious break going away.
        s = Rewrite(s, DOT_GAAHLAA_INNER, GAAHLAA);
        s = Rewrite(s, DOT_GAAHLAA_FINAL, GAAHLAA);
        s = Rewrite(s, DOT_INITIALISM, " ");
        s = Rewrite(s, DOT_INITIALISM_END, " ");

        // 8. RANGES — the attested infix `ᱠᱷᱚᱱ`, always BETWEEN the two numerals in every corpus instance.
        s = Rewrite(s, RANGE, "$1 ᱠᱷᱚᱱ $2");

        // 9. `°C`, ordered AFTER step 8 so a span is already a span, and BEFORE step 10 so the tier never
        //    sees a bare `C` to reason about.
        s = Rewrite(s, DEG_C, "$1 ᱰᱤᱜᱨᱤ ᱥᱮᱞᱥᱤᱭᱚᱥ");
        // 9b. The bare `°` — refused before a Latin letter, a digit, or an arc-minute/second mark.
        s = Rewrite(s, DEG_BARE, "$1 ᱰᱤᱜᱨᱤ");

        // 10. THE SHARED SYMBOL TIER — %, currency, units, ².
        return SYMBOLS(s);
    }
}
