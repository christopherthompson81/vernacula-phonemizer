/**
 * Telugu cardinal number → words, Indian grouping (వెయ్యి 10³ / లక్ష 10⁵ / కోటి 10⁷).
 *
 * THE COMPOSITION NOW LIVES IN `core/numbers.ts` as `dravidianNumberWords`, shared with Kannada and
 * Malayalam; this file keeps the Telugu-only parts — the century year reading and the ordinal
 * morphology. The migration is BYTE-IDENTICAL over the te_in corpus (0/1978 utterances changed).
 *
 * WHY TELUGU CANNOT USE THE SHARED `indicNumberWords` COMPOSER. Two independent reasons, both of which
 * made every one of the 627 numerals in the te_in corpus wrong before this file existed:
 *
 *   1. ORDER. The shared composer's un-authored 21-99 fallback emits UNIT then TENS (the Hindi
 *      ekchālīs shape). Telugu is TENS then UNIT, so 93% read *మూడు తొంభై — "three ninety".
 *   2. MAGNITUDE AGREEMENT. The shared composer writes `units[h] + hundred` unconditionally, so
 *      100 read *ఒకటి వంద and 1000 read *ఒకటి వెయ్యి ("one hundred", "one thousand", with the
 *      numeral spelled out — a form no speaker uses). Telugu instead inflects the magnitude noun:
 *        count 1               → bare        వంద / వెయ్యి / లక్ష / కోటి
 *        count > 1             → plural      రెండు వందలు, ముప్పై వేలు
 *        count > 1 + remainder → obl. plural రెండు వందల యాభై, రెండు వేల పదకొండు
 *        count 1 + remainder, hundreds only  → suppletive stem నూట (నూట యాభై = 150)
 *
 * EVIDENCE for the four forms — corpus text and, where the text alone could not settle it, the FLEURS
 * audio read back through Parakeet (read back from audio):
 *   · "దాదాపు మూడు వేల"  (corpus)  — oblique plural వేల before a remainder/noun
 *   · 2011 → "రెండు వేల పదకొండు"   (audio, 14062468540202204867) — NOT *రెండు వెయ్యి పదకొండు
 *   · 150  → "నూట యాభై"            (audio, 15009446377620036374) — the suppletive నూట
 *   · 200  → "రెండు వందల"          (same utterance)
 *   · 400  → "నాలుగు వందల"         (audio, 17734440130091015092 + 3701404004770268839, two readers)
 *   · 30000 → "ముప్పై వేల"         (same two readers)
 *
 * YEARS ARE READ AS CENTURIES in the 1100-1999 band — పంతొమ్మిది వందల డెబ్బై ఆరు for 1976, not
 * *వెయ్యి తొమ్మిది వందల డెబ్బై ఆరు. That is a READING choice the transcript cannot express, so it was
 * arbitrated on the audio and came back unanimous across four recordings of three different sentences:
 *   1976 ×2 readers → పంతొమ్మిది వందల డెబ్బై ఆరు   (4109835095717580820, 15464403826497019680)
 *   1966 ×2 readers → పంతొమ్మిది వందల అరవై ఆరు     (17734440130091015092, 3701404004770268839)
 *   1989           → పంతొమ్మిది వందల ఎనభై తొమ్మిది (3131782175864347195)
 * The 2000s take the ordinary cardinal (2011 → రెండు వేల పదకొండు, audio above), which is what the
 * compositor already produces — so only the 1100-1999 band gets `yearToWords`.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Telugu;

public static class TeluguNumbersComposer
{
    private static TeluguNumbers N => Manifest.MANIFEST.Numbers;

    /** Non-negative integer → Telugu words. */
    public static string NumberToWords(double n) => string.Join(" ", Numbers.DravidianNumberWords(n, N));

    /** True for the band that takes the century reading; see the header. */
    public static bool IsCenturyYear(double n) => n >= 1100 && n <= 1999;

    /** 1100-1999 read as centuries: 1976 → పంతొమ్మిది వందల డెబ్బై ఆరు. Audio-arbitrated (header). */
    public static string YearToWords(double n)
    {
        if (!IsCenturyYear(n)) return NumberToWords(n);
        double century = Math.Floor(n / 100), rest = n % 100;
        // The hundred noun agrees as it would for any count above one — వందల before a remainder, వందలు bare.
        var h = N.MagnitudeForms.Hundred;
        var hundred = rest > 0 ? h.PluralOblique : h.Plural;
        var parts = new List<string> { NumberToWords(century), hundred ?? "" };
        if (rest > 0) parts.Add(NumberToWords(rest));
        return string.Join(" ", parts);
    }

    /**
     * The ORDINAL stem of a cardinal word. Telugu forms ordinals by attaching వ to the LAST word of the
     * cardinal, after a regular final-vowel adjustment. Emitted apart, వ reaches the g2p as a stray
     * syllable [ʋa] carrying its own primary stress.
     *
     *   -ు  → drop it        పది→పద-, ఎనిమిది→ఎనిమిద-, రెండు→రెండ-, పదిహేను→పదిహేన-
     *   -ి  → drop it        ఒకటి→ఒకట-, కోటి→కోట-
     *   -ై  → -య్య           ఇరవై→ఇరవయ్య-  ← attested verbatim in this corpus as ఇరవయ్యవ ("20th century")
     *   else (inherent -a)   వంద→వంద-, లక్ష→లక్ష-
     */
    public static string OrdinalStem(string word)
    {
        if (word.EndsWith("ు", StringComparison.Ordinal) || word.EndsWith("ి", StringComparison.Ordinal))
            return word[..^1];
        if (word.EndsWith("ై", StringComparison.Ordinal)) return $"{word[..^1]}య్య";
        return word;
    }

    /** N + వ, fused onto the final cardinal word (18వ → పద్దెనిమిదవ, 20వ → ఇరవయ్యవ). */
    public static string OrdinalToWords(double n, string suffix = "వ")
    {
        var words = (IsCenturyYear(n) ? YearToWords(n) : NumberToWords(n)).Split(' ');
        var last = words.Length > 0 ? words[^1] : null;
        if (last is null || last == "") return "";
        words[^1] = $"{OrdinalStem(last)}{suffix}";
        return string.Join(" ", words);
    }
}
