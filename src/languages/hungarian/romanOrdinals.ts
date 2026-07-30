/**
 * Hungarian Roman-numeral reading. A century is read as an ORDINAL: `XIX. század` is *tizenkilencedik század*;
 * the cardinal *tizenkilenc század* would mean "nineteen centuries". Sources: Hungarian orthography — a Roman
 * numeral followed by a PERIOD is itself the ordinal marker (the period is what "th" is in English), so
 * `XIX.` = *tizenkilencedik*; the spelled form is attested as a book title ("A tizenkilencedik század
 * története", Magyar századok series).
 *
 * FORM: Hungarian has no gender or adjectival case agreement, so the single form *-dik* is unconditionally
 * correct for every context — century, district, congress, anniversary, regnal name alike. This is the only
 * language in this group with no agreement limitation to declare.
 *
 * THE PERIOD, which sits between the numeral and the context word (`XIX. század`):
 *  - Matching is unaffected: the shared pass looks at the next WORD, skipping intervening non-letters, so
 *    `század` is still seen and the ordinal fires.
 *  - The period itself SURVIVES into the output, where the engine renders it as a clause pause —
 *    `tizenkilencedik . ˈsaːzɒd`. That artefact is pre-existing, not introduced here: `XIX. század` already
 *    phonemizes to `ˈtizɛŋkilɛnt͡s . ˈsaːzɒd` today with no policy at all. This contract (a table/rule plus two
 *    context regexes) cannot consume a character outside the numeral token, so removing it would take either a
 *    core change or a Hungarian-side pre-pass that swallows the ordinal period — deliberately left alone.
 *  - Consequence: the ordinal WORD is correct; the phrase carries a spurious pause. Net improvement over the
 *    cardinal, which is the wrong word *and* keeps the pause.
 */
import type { RomanPolicy } from "../../core/roman.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** Standalone 1–9. 1 is the irregular *első* (not *egyedik*). */
const ORD_UNITS: readonly string[] = [
    "", "első", "második", "harmadik", "negyedik", "ötödik", "hatodik", "hetedik", "nyolcadik", "kilencedik",
];

/** 1–9 as the FINAL element of a compound: 21 → huszon+egyedik, 12 → tizen+kettedik. *első* → *egyedik*. */
const ORD_UNITS_COMBINING: readonly string[] = [
    "", "egyedik", "kettedik", "harmadik", "negyedik", "ötödik", "hatodik", "hetedik", "nyolcadik",
    "kilencedik",
];

/** Whole tens: tizedik, huszadik, then the regular cardinal + -dik with the linking vowel (harmincadik). */
const ORD_TENS: readonly string[] = [
    "", "tizedik", "huszadik", "harmincadik", "negyvenedik", "ötvenedik", "hatvanadik", "hetvenedik",
    "nyolcvanadik", "kilencvenedik",
];

/**
 * Integer → Hungarian ordinal. Compounds are ONE word: the combining tens prefix (tizen-, huszon- from the
 * language's own `tensPrefix` data, plain cardinal tens from 30 up) directly concatenated with the combining
 * unit ordinal — tizenkilencedik, huszonharmadik, negyvenötödik. `undefined` above 100 falls back to the
 * cardinal.
 */
function ordinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 100) return undefined;
    if (n === 100) return "századik";
    if (n < 10) return ORD_UNITS[n];
    const t = Math.floor(n / 10),
        u = n % 10;
    if (u === 0) return ORD_TENS[t];
    const prefix = N.tensPrefix[String(t * 10)] ?? N.tens[t]; // tizen- / huszon- / harminc- / negyven- …
    return prefix === undefined ? undefined : `${prefix}${ORD_UNITS_COMBINING[u]}`;
}

/**
 * Hungarian is agglutinative, so the context patterns are UNANCHORED at the end: `század` also matches
 * században, századi, századtól, századok, századokban. Covered: (év)század, évezred, évforduló, kerület
 * (Budapest districts — "XIII. kerület" is one of the highest-frequency ordinal Romans in Hungarian text),
 * kongresszus, fejezet, olimpia.
 */
const CONTEXT = /^((év)?század|évezred|évfordul|kerület|kongresszus|fejezet|olimpi)/iu;

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    ordinalAfter: CONTEXT,
};
