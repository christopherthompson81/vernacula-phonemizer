/**
 * Standard Malay (zsm) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * WHY THIS FILE EXISTS AT ALL. `zsm` is served by the INDONESIAN engine as a labelled approximation (the two
 * are standardisations of one Malayic language and share the reformed Latin orthography), so it also
 * inherited Indonesian's normalization layer — and that layer encodes Indonesian's ORTHOGRAPHIC conventions,
 * which are not Malay's. This file runs as a PRE-PASS in front of it (see malay.ts) and claims only the
 * shapes where the ms_my corpus measurably disagrees with Indonesian. Everything else is deliberately left
 * to the inherited layer: a Malay file that re-states Indonesian for no measured reason is worse than the
 * alias. Each rule below states what it claims and why the inherited layer could not.
 *
 * THE INVERSION THAT SHAPES THIS FILE. Indonesian groups thousands with a PERIOD and writes the decimal
 * COMMA (9.000 / 1,5). The ms_my corpus — translated from the English FLEURS set — uses the ENGLISH
 * convention: comma thousands and a dot decimal. So the inherited layer read every Malay number with the
 * separators swapped: `1,400 orang` came out *satu koma empat nol nol orang* ("one point four zero zero"),
 * and `5,000,000` came out *lima koma nol nol nol , nol* — digits lost AND a bogus clause pause.
 *
 * Measured over the ms_my corpus (1,908 utterances, column 3): comma-thousands ×39, dot-decimals ×19,
 * clocks ×16 (6 dot, 10 colon), colon-not-a-clock ×3, hyphen ranges ×15, `A.S.` ×8, `SM` after a year ×4,
 * `%` ×4, `Dr.` ×4, rate ×4, `&` ×3, exponent ×2, `Ghz` ×2, degrees ×2, `No.`/`En.`/`US$` ×1 each.
 *
 * ORDERING is load-bearing throughout; each step states its coupling. The two that matter most: every rule
 * that consumes a GLUED unit (`2.4Ghz`, `160km/j`, `19,500km²`) runs BEFORE the decimal rule, because the
 * version-dot guard is "a letter follows the fraction digits" and a glued unit looks exactly like that; and
 * the clock runs before the range, because a range endpoint may be a clock (a range endpoint may itself be a clock).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Malay;

public static class Normalize
{
    /** Dotted abbreviations where MALAY differs from Indonesian's table. `dsb.`/`dll.` are identical in both and
     *  stay with the inherited layer. Sourced: nombor ×11, doktor ×1, Encik ×1 in ms_my. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["dr"] = "doktor",   // Indonesian: dokter
        ["no"] = "nombor",   // Indonesian: nomor
        ["en"] = "Encik",    // no Indonesian entry at all — read as the bare letter pair plus a phrase break
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** RATES. Malay forms the denominator with the `se-` prefix (`batu sejam` ×4, `kilometer sesaat` ×2 in the
     *  corpus) where Indonesian says `per jam` / `per detik`. Keyed on the whole slash unit, so a bare `s` or
     *  `j` can never match standalone (normalizeSymbols' `rateDenominators` lesson). `ela/meter` is NOT here:
     *  it is an alternation ("keep 100 yards/metres away"), not a rate, and has no sourced reading. */
    private static readonly IReadOnlyDictionary<string, string> RATE_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km/j"] = "kilometer sejam", ["km/jam"] = "kilometer sejam", ["batu/jam"] = "batu sejam",
        ["km/s"] = "kilometer sesaat", ["m/s"] = "meter sesaat", ["m/saat"] = "meter sesaat",
        ["Mbit/s"] = "megabit sesaat", ["kbit/s"] = "kilobit sesaat",
        // The corpus's own slashless abbreviations of the same two rates, read as `bsd͡ʒ` and `ʔmd͡ʒ` before.
        ["bsj"] = "batu sejam", ["kmj"] = "kilometer sejam",
    };
    private static readonly string RATE_ALT = string.Join("|", RATE_WORD.Keys.OrderByDescending(k => k.Length));

    /** Frequency units, glued to their number in the corpus (`2.4Ghz`, `5.0Ghz`) and previously read as `ɣz`.
     *  Unit BORROWINGS: absent from every in-repo Malay source, which is the class §5e excludes from the
     *  sourcing check by measurement — kilogram and millimetre are unattested in some thirty languages and
     *  perfectly correct. */
    private static readonly IReadOnlyDictionary<string, string> FREQ_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ghz"] = "gigahertz", ["mhz"] = "megahertz", ["khz"] = "kilohertz", ["hz"] = "hertz",
    };

    /** Compass letters after a degree sign: `35°W` was read as the glued `dərˈad͡ʒatw`. */
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["n"] = "utara", ["s"] = "selatan", ["e"] = "timur", ["w"] = "barat",
    };

    private const string L = "(?<![\\p{L}\\p{M}])"; // ⚠ never `\b`: it is ASCII-defined and finds no boundary against non-Latin script
    private const string R = "(?![\\p{L}\\p{M}])";

    /** A clock is only a clock when something says so, and in this corpus something always does: `pukul`/`jam`
     *  earlier in the clause, or a meridiem / zone / part-of-day word just after. All 16 clocks carry one; the
     *  three colon forms that are NOT clocks (rugby 21:20, aspect ratio 3:2, degree class 2:2) carry none.
     *  Bare `am` is excluded on purpose — it is the Malay word "am" (general), ×3 in this corpus. */
    private const string CLOCK_BEFORE = "(?<=" + L + "(?:pukul|jam)" + R + "[^.!?]{0,24})";
    private const string MERIDIEM = "a\\.m\\.|p\\.m\\.|pm";
    private const string CLOCK_AFTER = "(?=[^.!?]{0,12}?(?:" + MERIDIEM + "|pg|pagi|petang|malam|GMT|UTC|MDT|waktu)" + R + ")";

    /** Malay says the part of the day, not the Latin abbreviation: `pukul 1.15 pagi`, `pukul 10.08 malam`.
     *  12 a.m./p.m. have ZERO corpus instances and are here so the adversarial neighbour is not wrong;
     *  `tengah malam` is attested ×1 and `tengah hari` composed from `tengah` + `hari` on its model. */
    private static string MeridiemWord(double hour, string mark)
    {
        var pm = mark.ToLowerInvariant().StartsWith("p", StringComparison.Ordinal);
        if (hour == 12) return pm ? "tengah hari" : "tengah malam";
        if (!pm) return "pagi";
        return hour >= 1 && hour <= 6 ? "petang" : "malam";
    }

    /** Nouns that mark a hyphenated pair as a RANGE rather than a score. Every corpus range is followed by one
     *  (or is a year pair); every corpus SCORE — 5-3, 6-6, 7-2, 26 - 00 — is followed by none, which is what
     *  keeps `hingga` out of them. ⚠ Widened only for shapes that were actually counted — a guard alternative with no attested
     *  instance behind it is a guess wearing the costume of evidence. */
    private static readonly string RANGE_NOUN = string.Join("|", new[]
    {
        "minit", "jam", "saat", "hari", "malam", "petang", "pagi", "bulan", "minggu", "tahun", "abad",
        "km", "kilometer", "meter", "sentimeter", "milimeter", "batu", "ela", "inci", "kaki", "kg", "kilogram",
        "juta", "bilion", "ribu", "peratus", "darjah", "kali", "orang", "ekor", "pm", "GMT", "UTC", "MDT",
    });

    private const string MAGNITUDE = "ribu|juta|bilion|billion|trilion";
    private static readonly IReadOnlyDictionary<string, string> CURRENCY_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["$"] = "dolar", ["€"] = "euro", ["£"] = "pound", ["¥"] = "yen",
    };
    private const string AMOUNT = "\\d[\\d.]*(?:\\s+(?:" + MAGNITUDE + "))?";
    private const string NUM = "\\d+(?:\\.\\d+)?";

    private static readonly IReadOnlyDictionary<string, string> CUBED = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kilometer", ["cm"] = "sentimeter", ["mm"] = "milimeter",
    };
    private static readonly string CUBE_ALT = string.Join("|", CUBED.Keys.OrderByDescending(k => k.Length));

    private const string CLOCK_BODY = "([01]?\\d|2[0-3])[.:]\\s?([0-5]\\d)(?![\\d]|\\.\\d)";

    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*(?:&amp;|&(?!\\w+;))\\s*", "gu");
    private static readonly JsRe COMMA_THOUSANDS = JsRegex.Compile("(?<!\\d)(\\d{1,3}(?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMA_G = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOT_G = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe CURRENCY_CODE_PREFIX = JsRegex.Compile($"({L}(?:US|AS|HK|NZ|CAD?))\\$(?=\\d)", "gu");
    private static readonly JsRe CURRENCY_REDUNDANT =
        JsRegex.Compile($"[$€£¥]\\s?(?={AMOUNT}\\s+(?:AUD|USD|MYR|SGD|EUR|GBP|JPY|NZD|CAD|HKD){R})", "gu");
    private static readonly JsRe CURRENCY_MAGNITUDE =
        JsRegex.Compile($"([$€£¥])\\s?(\\d[\\d.]*)(\\s+(?:{MAGNITUDE})){R}", "gu");
    private static readonly JsRe CURRENCY_DECIMAL = JsRegex.Compile("([$€£¥])\\s?(\\d+\\.\\d+)", "gu");
    private static readonly JsRe PERCENT_REDUNDANT = JsRegex.Compile("(\\d)\\s?%(?=\\s*peratus)", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d)\\s?%", "gu");
    private static readonly JsRe ERA_SM = JsRegex.Compile($"(\\d)(\\s*)SM{R}", "gu");
    private static readonly JsRe DOTTED_CAPS_MID = JsRegex.Compile("(?<![\\p{L}\\p{M}.])((?:[A-Z]\\.){2,})(?=\\s+\\p{L})", "gu");
    private static readonly JsRe DOTTED_CAPS_END = JsRegex.Compile("(?<![\\p{L}\\p{M}.])((?:[A-Z]\\.){2,})(?=\\s*(?:[,;:!?)]|$))", "gu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"{L}({ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"{L}({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?)]|$))", "giu");
    private static readonly JsRe NOMBOR = JsRegex.Compile($"{L}no\\.\\s?(?=\\d)", "giu");
    private static readonly JsRe RATE_RE = JsRegex.Compile($"(\\d)\\s?({RATE_ALT}){R}", "gu");
    private static readonly JsRe KM2_GLUED = JsRegex.Compile($"(?<=\\d)km[²2]{R}", "gu");
    private static readonly JsRe KM2_BARE = JsRegex.Compile($"{L}km[²2]{R}", "gu");
    private static readonly JsRe M2 = JsRegex.Compile("(\\d\\s?)m²", "gu");
    private static readonly JsRe CUBE_GLUED = JsRegex.Compile($"(?<=\\d)\\s?({CUBE_ALT})[³3]{R}", "gu");
    private static readonly JsRe CUBE_BARE = JsRegex.Compile($"{L}({CUBE_ALT})[³3]{R}", "gu");
    private static readonly JsRe M3 = JsRegex.Compile("(\\d\\s?)m³", "gu");
    private static readonly JsRe FREQ = JsRegex.Compile($"(\\d)\\s?(GHz|Ghz|gHz|ghz|MHz|Mhz|mhz|kHz|khz|Hz){R}", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?°\\s?([NSEWnsew])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe CLOCK_MERIDIEM = JsRegex.Compile(
        $"(?<![\\d.:]){CLOCK_BODY}\\s?({MERIDIEM})(?![\\p{{L}}\\p{{M}}])(?!\\s*(?:pagi|petang|malam|tengah))", "gu");
    private static readonly JsRe CLOCK_MARKED_BEFORE = JsRegex.Compile($"{CLOCK_BEFORE}(?<![\\d.:]){CLOCK_BODY}", "gu");
    private static readonly JsRe CLOCK_MARKED_AFTER = JsRegex.Compile($"(?<![\\d.:]){CLOCK_BODY}{CLOCK_AFTER}", "gu");
    private static readonly JsRe BARE_HOUR_MERIDIEM = JsRegex.Compile(
        $"(?<![\\d.:])(\\d{{1,2}})\\s?({MERIDIEM})(?![\\p{{L}}\\p{{M}}])(?!\\s*(?:pagi|petang|malam|tengah))", "gu");
    private static readonly JsRe PG = JsRegex.Compile($"(?<=\\d[^.!?]{{0,20}}){L}pg\\.?{R}", "gu");
    private static readonly JsRe COLON_ZERO = JsRegex.Compile("(?<![\\d.:])([01]?\\d|2[0-3]):00(?![\\d.:])", "gu");
    private static readonly JsRe COLON_PAIR = JsRegex.Compile("(?<![\\d.:])(\\d{1,4}):(\\d{1,4})(?!\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(?=\\d)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s*<\\s*(?=\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s*>\\s*(?=\\d)", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("(\\S)\\s*=\\s*(?=\\S)", "gu");
    private static readonly JsRe RANGE_MEASURE =
        JsRegex.Compile($"(?<![\\d.])({NUM})\\s?[-–]\\s?({NUM})(?=\\s*(?:{RANGE_NOUN}){R})", "gu");
    private static readonly JsRe RANGE_YEARS = JsRegex.Compile("(?<!\\d)([12]\\d{3})\\s?[-–]\\s?([12]\\d{3})(?!\\d)", "gu");
    private static readonly JsRe VERSION_DOT = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)([a-z])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d])", "gu");

    /** Malay is not a mutating or case-marking language, so no agreement is lost by rewriting DIGITS: `hingga` and the
     *  clock rewrites can be applied to DIGITS without any agreement being lost, and every operand is
     *  re-emitted verbatim (a rule that CONSUMES a word must put it back). Every rule below emits DIGITS where a number is involved and lets the
     *  engine's own number path speak them, which keeps this layer free of the number words entirely. */
    public static string NormalizeMalay(string input)
    {
        var s = input;

        // 1) AMPERSAND, including the HTML entity the corpus actually writes (`Seni &amp; Sains`, `Qatar
        //    Airways &amp; Turkish Airlines`, `B&B`). The sign was DROPPED outright — the leak classes are blind
        //    to a symbol that vanishes, so this is a silent content loss. Malay `dan` ×874.
        s = AMPERSAND.Replace(s, " dan ");

        // 2) COMMA THOUSANDS — first, before any other rule can read the grouping comma as clause punctuation
        //    or (worse) as Indonesian's decimal comma. The leading `(?<!\d)` anchor matters: without it
        //    `1990,300` would match at `990,300`. Exactly three digits per group, so a decimal comma cannot be
        //    caught by accident (this corpus writes none, but Indonesian's convention leaks in translation).
        s = COMMA_THOUSANDS.Replace(s, m => COMMA_G.Replace(m.Value, ""));

        // 3) `US$30` — the shared symbol tier is keyed on a sign at a token boundary, so a `$` glued behind
        //    letters was swallowed and the amount lost its currency word entirely (`uɛs tiga puluh`). One space
        //    is the whole fix; `US` is written, so it stays written (a REDUNDANT symbol is a permissible drop: say each thing once).
        s = CURRENCY_CODE_PREFIX.Replace(s, "$1 $");
        //    …and A MAGNITUDE WORD AFTER THE AMOUNT has to be got out from between the number and its currency.
        //    The tier keys the currency word on the sign's ADJACENCY TO THE DIGITS, so it lands inside the
        //    quantity: `$2.3 bilion` read *dua perpuluhan tiga DOLAR bilion* and `$45 juta` *empat puluh lima
        //    DOLAR juta* — both contradicted by the corpus's own spelled-out order, `bilion dolar` ×4 and `juta
        //    dolar` ×4 against `dolar bilion` ×0. `billion` is in the class because this corpus writes the
        //    English spelling once, in `US $14.7 billion`.
        //    MOVING THE SIGN DOES NOT WORK and was measured: `2.3 bilion $` is no longer digit-adjacent, so the
        //    tier drops the sign and the currency VANISHES — a DROP is worse than a word out of order. So the
        //    sign is consumed here and re-emitted as a word. The words are not this layer's invention: they are
        //    verbatim the INHERITED TIER'S OWN currency table (indonesian.ts `currency`), which is the point —
        //    the reading is unchanged, only its position is, and no Malay currency name is claimed.
        //    Trap 12 takes precedence over both: where a CURRENCY CODE follows, the sentence has already named
        //    the currency (`$45 juta AUD`) and a word here would say it twice, so the sign is simply dropped.
        s = CURRENCY_REDUNDANT.Replace(s, "");
        s = CURRENCY_MAGNITUDE.Replace(s, m =>
            $"{m.Groups[2].Value}{m.Groups[3].Value} {CURRENCY_WORD[m.Groups[1].Value]}");
        //    A bare DECIMAL amount still has to move, for the same reason at a smaller scale: without it step 15
        //    splits the number and the tier only sees the integer part, so `$1.50` read *satu DOLAR perpuluhan
        //    lima nol*. An integer amount is left alone — the tier already reads `$1000` as *seribu dolar*.
        s = CURRENCY_DECIMAL.Replace(s, "$2 $1");

        // 4) PERCENT. Malay says `peratus` (×15 in this corpus, spelled out after the number); Indonesian's tier
        //    says `persen`, which ms_my never writes (×0). Claimed here so the inherited tier never sees a `%`.
        //    ⚠ THIS IS AN ARCHITECTURAL CONSTRAINT, NOT AN IDIOMATIC ONE, and the distinction matters when reading
        //    the rest of this file: `peratus` is not local because Malay's percent is somehow unlike the tier's
        //    shape — it is postposed and invariant, exactly what the tier declares. It is local because this
        //    language is a PRE-PASS over the whole Indonesian engine (malay.ts) and therefore cannot OVERRIDE the
        //    inherited `SymbolData`; the only way to say a different word is to consume the symbol first. The same
        //    is true of the unit and exponent rules below. If Malay ever needs its own tier, the fix is to give it
        //    one, not to add more pre-emption here.
        //    Trap 12 first: where a sentence writes both the sign and the word, the sign is DELETED — leaving it
        //    for the inherited tier would say it twice, and in the wrong dialect (`lapan puluh persen peratus`).
        s = PERCENT_REDUNDANT.Replace(s, "$1");
        s = PERCENT.Replace(s, "$1 peratus");

        // 5) ERA MARKER, before the generic abbreviation step. `323 SM`, `5000 SM`:
        //    the letters were spelled `ɛsɛm`. The corpus spells the expansion itself ×3 (`abad ke-10 sebelum
        //    Masihi`), which is where the wording comes from. A preceding number is required, so an `SM` that
        //    is some other initialism cannot be claimed.
        s = ERA_SM.Replace(s, "$1$2sebelum Masihi");

        // 6) DOTTED FORMS, multi-dot before single-dot so no interior dot survives as a phrase break.
        //    6a) `A.S.` ×8 (Amerika Syarikat) read as `ˈa . s .` — two spurious pauses mid-sentence. Collapsing
        //        the dots hands the letter run to the existing initialism path. Two branches, because at a
        //        clause end the last dot really is the sentence end and must stay a pause.
        s = DOTTED_CAPS_MID.Replace(s, m => DOT_G.Replace(m.Groups[1].Value, ""));
        s = DOTTED_CAPS_END.Replace(s, m => $"{DOT_G.Replace(m.Groups[1].Value, "")}.");
        //    6b) The three abbreviations whose MALAY wording differs from Indonesian's table. Same two-branch
        //        shape: the dot is consumed mid-sentence, kept at a clause end.
        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");
        //    6c) `No.` before a DIGIT (`angkasawan No. 11`) — a letter-lookahead rule cannot claim it, and the
        //        inherited layer has its own digit branch that would otherwise win with Indonesian's `nomor`.
        s = NOMBOR.Replace(s, "nombor ");

        // 7) RATES, before the shared tier claims the bare `km` and before step 15 could read the slash unit's
        //    letters as a version suffix. `160km/j` read with Indonesian's `per jam`; `batu/jam` lost its slash.
        s = RATE_RE.Replace(s, m => $"{m.Groups[1].Value} {RATE_WORD[m.Groups[2].Value]}");

        // 8) EXPONENT. `3,850 km²` and `19,500km²` read as `ʔm` — the unit was not claimed (no adjacent digit
        //    after de-grouping in `juta km2`) and the `²` was dropped. Both the superscript and the ASCII form,
        //    because a rule matching only `²` leaves the ASCII form to be read as a NUMBER. The bare `m²` arm
        //    requires a preceding digit so `M2` cannot match.
        s = KM2_GLUED.Replace(s, " kilometer persegi"); // glued: `19,500km²`
        s = KM2_BARE.Replace(s, "kilometer persegi");
        s = M2.Replace(s, "$1meter persegi");
        //     CUBED, and this is a REAL Malay/Indonesian divergence rather than a shared word — which is the whole
        //     reason this file exists. Malay says `padu`, Indonesian `kubik`, and in ms_my:
        //       meter padu ×2  "Luno membawa 120–160 meter padu bahan bakar di atas kapal"
        //       kubik      ×0
        //     `isi padu` ×2 in the same corpus is "volume" (`isi padu air` — the volume of water), which is the
        //     same root in its ordinary sense and not the measure word; the collocation with the unit noun is the
        //     evidence, as everywhere else in this sweep. `m³` previously lost the `³` outright.
        //     COVERS EVERY UNIT, not just `m`: a first pass wrote the `m³` arm alone and left `5 km³` reading as a
        //     bare *lima kilometer* with the `³` gone, because the km arms above handle only `[²2]` and nothing
        //     behind this file supplies a cube word at all — the tier Malay inherits is Indonesian's, whose
        //     `exponentWords` has `squared` only. So the squared arms can fall through to the tier and the cubed
        //     ones cannot.
        //     The MULTI-LETTER keys take the ASCII `3` as the km² arms take the ASCII `2`; bare `m` stays
        //     SUPERSCRIPT-ONLY and digit-anchored, for the reason the comment above gives about `M2` — `M3` is a
        //     motorway (`M3 lebuhraya`) and a BMW, so `5 m3` is deliberately left to read as a number.
        s = CUBE_GLUED.Replace(s, m => $" {CUBED[m.Groups[1].Value.ToLowerInvariant()]} padu");
        s = CUBE_BARE.Replace(s, m => $"{CUBED[m.Groups[1].Value.ToLowerInvariant()]} padu");
        s = M3.Replace(s, "$1meter padu");

        // 9) FREQUENCY, before the decimal rule: `2.4Ghz` is a decimal GLUED to its unit, and step 15's
        //    version-dot guard is exactly "a letter follows the fraction", so the unit has to be words first.
        s = FREQ.Replace(s, m => $"{m.Groups[1].Value} {FREQ_WORD[m.Groups[2].Value.ToLowerInvariant()]}");

        // 10) DEGREES. Malay `darjah` (×3, incl. the angular `beberapa darjah di utara khatulistiwa`), not
        //     Indonesian's `derajat`. The compass arm fixes `35°W` → `dərˈad͡ʒatw`, a glued non-word.
        s = DEG_C.Replace(s, "$1 darjah Celsius");
        s = DEG_F.Replace(s, "$1 darjah Fahrenheit");
        s = DEG_COMPASS.Replace(s, m => $"{m.Groups[1].Value} darjah {COMPASS[m.Groups[2].Value.ToLowerInvariant()]}");
        s = DEG.Replace(s, "$1 darjah");

        // 11) CLOCK, before the decimal rule (a dot clock must not become a decimal, and `3.50 m` must not
        //     become a clock — both were happening) and before the range rule (an endpoint may be a clock).
        //     Two departures from the inherited Indonesian rule, both measured:
        //       • NO JOINER. Indonesian reads `pukul 8.46` as *pukul delapan lewat empat puluh enam*, but Malay
        //         `lewat` means "late / via" — its two corpus instances are `Lewat pada hari Ahad` and `pada
        //         lewat tahun 2015`, never "past the hour". Malay juxtaposes: *pukul lapan empat puluh enam*.
        //         A word being real is not a word fitting the slot (the Fula `hakkunde` lesson).
        //       • THE MARKER GUARD. Malay's dot is the DECIMAL point, so digit-count cannot separate a clock
        //         from a decimal the way it does in Indonesian; and a colon pair may be a score. Requiring
        //         `pukul`/`jam` in the clause or a meridiem/zone/part-of-day word after separates all 16 clocks
        //         from `3.50 m`, `6.34 inci`, `21:20`, `3:2` and `2:2`. The separator may be followed by a
        //         space, because the corpus writes one mangled clock that way (`Antara 10: 00-11: 00 pm MDT`).
        //     The trailing `(?!\.?\d)` keeps a sports time (`4:41.30`) out, and the leading class stops the scan
        //     restarting inside one. A meridiem, when present, is CONSUMED and re-emitted as its Malay word.
        string Clock(string h, string min, string? mark)
        {
            var mv = Js.Number(min);
            var time = mv == 0 ? $"{Js.NumberToString(Js.Number(h))}" : $"{Js.NumberToString(Js.Number(h))} {Js.NumberToString(mv)}";
            return mark is null ? time : $"{time} {MeridiemWord(Js.Number(h), mark)}";
        }
        //     The pass REPEATS to a fixed point because of one corpus sentence, `antara pukul 06.30 dan 07.30`:
        //     the `pukul` window is bounded by `[^.!?]` (it must not cross a sentence end), and the FIRST clock's
        //     own dot closes that window for the second. Once pass 1 has rewritten it to `pukul 6 30 dan 07.30`
        //     the dot is gone and pass 2 claims the coordinated second clock. Bounded, and idempotent after.
        for (var pass = 0; pass < 4; pass++)
        {
            var before = s;
            s = CLOCK_MERIDIEM.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value));
            s = CLOCK_MARKED_BEFORE.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value, null));
            s = CLOCK_MARKED_AFTER.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value, null));
            if (s == before) break;
        }

        // 12) A BARE hour with a meridiem (`8 p.m.`) — zero corpus instances, but it is the adversarial
        //     neighbour of the clock above and read `p . m .` before. ⚠ Zero corpus instances is not evidence of correctness — it is
        //     absence of evidence, and the adversarial neighbour of a rule that DOES fire needs covering.
        s = BARE_HOUR_MERIDIEM.Replace(s, m =>
            $"{m.Groups[1].Value} {MeridiemWord(Js.Number(m.Groups[1].Value), m.Groups[2].Value)}");
        //     …and `pg`, the corpus's abbreviation for `pagi`, which read as the bare letters `pɡ`. Only after a
        //     number in the same clause, so an unrelated `pg` cannot be claimed.
        s = PG.Replace(s, "pagi");

        // 13) A COLON PAIR THAT SURVIVED step 11 is not a clock: the corpus's three are a rugby score (21:20),
        //     an aspect ratio (3:2) and a UK degree class (2:2). They read with a spurious clause pause, and
        //     21:20 was additionally claimed as a clock by the inherited rule. No single Malay word fits all
        //     three senses (`kepada` is right for the ratio, wrong for the degree class), so the MARK is
        //     dropped and both operands kept — a wrong word is worse than a dropped sign.
        //     The trailing guard is only `(?!\d)`, so a sentence period survives (`dikatakan 3:2.` keeps its
        //     pause) AND a sports time is claimed here too (`4:41.30` → `4 41.30`, then a decimal). That last
        //     part is not optional: leaving the colon in place let the INHERITED clock rule claim `4:41` once
        //     step 15 had rewritten the hundredths away from it — the guard that protects a sports time in
        //     Indonesian is the following `.30`, which no longer exists by then.
        //     One exception, on the COLON only (a colon is never a decimal point, so no `$1.00` can be caught):
        //     an unmarked `H:00` is a clock whatever else it might be, and juxtaposing its zero minutes said
        //     *dua puluh satu NOL*. The hour alone is the same reading the marked rule gives.
        s = COLON_ZERO.Replace(s, "$1");
        s = COLON_PAIR.Replace(s, "$1 $2");

        // 13b) ARITHMETIC AND COMPARISON SIGNS, dropped silently by the shared tier (in Indonesian too). ⚠ Zero
        //      instances in this corpus, which is not evidence of correctness — and the corpus does
        //      supply every word: it spells the multiplication infix itself in `format 6 kali 6 sm` and
        //      `negatif 56 kali 56 mm`, and writes `sama dengan` ×11, `kurang daripada` ×3, `lebih daripada`
        //      ×11. `<`/`>`/`×` are claimed ONLY between digits, because this corpus's text still carries HTML
        //      tags (`<i>`, `<sup>`) and a bare `<` rule would eat them.
        s = TIMES.Replace(s, "$1 kali ");
        s = LESS_THAN.Replace(s, "$1 kurang daripada ");
        s = GREATER_THAN.Replace(s, "$1 lebih daripada ");
        s = EQUALS_RE.Replace(s, "$1 sama dengan ");

        // 14) RANGES with `hingga` (×23 in this corpus, as the infix between two quantities). The hyphen was
        //     silently dropped, so `10-60 minit` read *sepuluh enam puluh minit*. Fires ONLY for a pair that a
        //     measure/period noun follows, or a pair of four-digit years — which is what keeps it out of the
        //     four sports scores (5-3, 6-6, 7-2, 26 - 00), none of which has either. Operands are re-emitted
        //     verbatim and the class ends in a digit, so a following clause comma cannot be eaten.
        s = RANGE_MEASURE.Replace(s, "$1 hingga $2");
        //     The year arm's trailing guard is `(?!\d)` and NOT `(?![\d.,])`: `sejak 1995-1996, apabila` ends on
        //     a clause comma, and excluding it left the corpus's commonest year range unjoined.
        s = RANGE_YEARS.Replace(s, "$1 hingga $2");

        // 15) DECIMALS, LAST — every rule that consumes a glued unit has run, so a letter still stuck to the
        //     fraction now means a VERSION (`802.11a/b/g/n`), not a unit. Malay reads the point as
        //     `perpuluhan` and the fraction DIGIT BY DIGIT — hence the space between the digits, so `.50`
        //     reads *lima nol* and not *lima puluh* (fifty).
        //     `\d{1,3}.000` is EXCLUDED: the corpus's one `9.000 orang` is Indonesian-convention thousands
        //     grouping in a translated sentence, and the inherited tokenizer already reads it as *sembilan
        //     ribu*. The exclusion is narrowed to an ALL-ZERO group rather than any three digits, because the
        //     adversarial neighbour of that instance is a real three-place decimal (`3.141`), which nobody
        //     writes as `3.000` — a fraction of exactly `000` is a grouped thousand, never a measurement.
        //     A trailing sentence period survives untouched (`Rajah 1.1.` keeps its pause).
        //     The version's trailing letter is re-emitted behind a HYPHEN, which the tokenizer drops and which
        //     breaks the number-adjacency the shared unit tier matches on: `802.11g` read *sebelas GRAM* before
        //     (and still would as `11 g`), the confidently-wrong-word failure the `rateDenominators` note
        //     describes. `11-g` reads the bare letter, which is what the standard's name is.
        //     THE VERSION DOT IS `titik`, NOT `perpuluhan`: `802.11` is not a quantity, so the dot is the
        //     PUNCTUATION MARK rather than a decimal separator, and Malay names the two separately.
        s = VERSION_DOT.Replace(s, "$1 titik $2-$3");
        s = DECIMAL_RE.Replace(s, m =>
        {
            var intPart = m.Groups[1].Value;
            var frac = m.Groups[2].Value;
            return intPart.Length <= 3 && frac == "000"
                ? m.Value
                : $"{intPart} perpuluhan {string.Join(" ", Js.CodePoints(frac))}";
        });

        return s;
    }
}
