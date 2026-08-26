/**
 * Kazakh Roman-numeral reading — ORDINAL. `XIX ғасыр` is *он тоғызыншы ғасыр*; tables rather than a
 * suffixing rule, because жиырмасыншы/қырқыншы are irregular and the number manifest holds IPA, not spelling.
 * Ported from src/languages/kazakh/romanOrdinals.ts — see that file for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kazakh;

public static class RomanOrdinals
{
    /** 1–9 ordinals, Cyrillic orthography. */
    private static readonly string[] ORD_UNITS =
    [
        "", "бірінші", "екінші", "үшінші", "төртінші", "бесінші", "алтыншы", "жетінші", "сегізінші", "тоғызыншы",
    ];

    /** Whole tens — жиырмасыншы and қырқыншы are the irregular ones. */
    private static readonly string[] ORD_TENS =
    [
        "", "оныншы", "жиырмасыншы", "отызыншы", "қырқыншы", "елуінші", "алпысыншы", "жетпісінші", "сексенінші",
        "тоқсаныншы",
    ];

    /** Cardinal tens in ORTHOGRAPHY (kazakh.jsonc stores these as IPA, so they cannot be imported). */
    private static readonly string[] TENS_CARDINAL =
    [
        "", "он", "жиырма", "отыз", "қырық", "елу", "алпыс", "жетпіс", "сексен", "тоқсан",
    ];

    /** Integer → Kazakh ordinal. Compounds put the tens in the CARDINAL and suffix only the unit
     *  (19 → он тоғызыншы, 21 → жиырма бірінші). `null` above 100 falls back to the cardinal. */
    public static string? Ordinal(int n)
    {
        if (n < 1 || n > 100) return null;
        if (n == 100) return "жүзінші";
        if (n < 10) return ORD_UNITS[n];
        int t = n / 10, u = n % 10;
        return u == 0 ? ORD_TENS[t] : $"{TENS_CARDINAL[t]} {ORD_UNITS[u]}";
    }

    /** Agglutinative, so unanchored at the end: `ғасыр` also matches ғасырда, ғасырдың, ғасырлар, ғасырға. */
    private static readonly JsRe CONTEXT =
        JsRegex.Compile("^(ғасыр|мыңжылдық|жылдық|съезд|конгресс|сынып)", "iu");

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
