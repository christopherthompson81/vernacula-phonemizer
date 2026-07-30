/**
 * Azerbaijani Roman-numeral reading. A century is read as an ORDINAL: `XIX əsr` is *on doqquzuncu əsr*; the
 * cardinal *on doqquz əsr* means "nineteen centuries", a different statement.
 *
 * SOURCES (this was the group where "plausibly ordinal" had to be checked rather than assumed):
 *  - az.wikipedia "Sıra sayı" (ordinal numeral) states that an ordinal may be written three ways — spelled out,
 *    Arabic numeral + hyphenated suffix (6-cı), or a ROMAN numeral with no suffix at all: *"Roma
 *    rəqəmlərindən sonra heç bir şəkilçi işlədilmir"*, with **"XX əsr"** and "IX sinif" as its own examples.
 *    That makes `XX əsr` an ordinal by the orthography's own account, not by analogy with Turkish.
 *  - The spelled reading is attested in running Azerbaijani text: "On doqquzuncu əsr Siyasi Elm
 *    Ensiklopediyası…" (az.wikipedia, Xalqçılıq), "…on doqquzuncu əsr boyunca…" (az.wikipedia), "On doqquzuncu
 *    əsr elminin obyektiv dünyası…" (az.wikiquote).
 *
 * FORM: Azerbaijani has no gender and the ordinal suffix does not vary by the head noun, so the single form is
 * unconditionally correct for every context, including regnal names. No agreement limitation.
 *
 * The ordinal is a clean SUFFIX, so this is a rule over the language's own cardinal data rather than a table:
 * four-way vowel harmony picks -ıncı / -inci / -uncu / -üncü, and a vowel-final stem drops the linking vowel
 * (iki → ikinci, altı → altıncı). Only the LAST element of a compound takes it: 19 → *on doqquzuncu*.
 */
import type { RomanPolicy } from "../../core/roman.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers; // ones: ["", bir, iki, …], tens: ["", on, iyirmi, …], hundred: yüz

const VOWELS = "aıeəiouöü";
/** Four-way harmony class of a stem, from its LAST vowel: back-unrounded, front-unrounded, back-rounded, … */
const HARMONY: Readonly<Record<string, "ı" | "i" | "u" | "ü">> = {
    a: "ı", ı: "ı", e: "i", ə: "i", i: "i", o: "u", u: "u", ö: "ü", ü: "ü",
};
const SUFFIX: Readonly<Record<string, string>> = { ı: "ncı", i: "nci", u: "ncu", ü: "ncü" };

/** Cardinal stem → ordinal: doqquz → doqquzuncu, dörd → dördüncü, iyirmi → iyirminci, yüz → yüzüncü. */
function suffixed(stem: string): string | undefined {
    let cls: "ı" | "i" | "u" | "ü" | undefined;
    for (const ch of stem) {
        const h = HARMONY[ch];
        if (h !== undefined) cls = h; // last vowel wins
    }
    if (cls === undefined) return undefined;
    const linking = VOWELS.includes(stem[stem.length - 1]!) ? "" : cls;
    return `${stem}${linking}${SUFFIX[cls]!}`;
}

/**
 * Integer → Azerbaijani ordinal. `undefined` above 100 falls back to the cardinal — Roman numerals in an
 * ordinal context do not reach past a hundred in running text.
 */
function ordinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 100) return undefined;
    if (n === 100) return suffixed(N.hundred);
    if (n < 10) return suffixed(N.ones[n]!);
    const t = Math.floor(n / 10),
        u = n % 10;
    const tens = N.tens[t];
    if (tens === undefined) return undefined;
    return u === 0 ? suffixed(tens) : `${tens} ${suffixed(N.ones[u]!)}`;
}

/**
 * Agglutinative, so the patterns are UNANCHORED at the end: `əsr` also matches əsrdə, əsrin, əsri, əsrlər,
 * əsrdən. Covered: əsr (century), yüzil/yüzillik (century, the native synonym), minillik (millennium),
 * ildönüm(ü) (anniversary), konqres, sinif (school grade — the orthography's own ordinal-Roman example).
 */
const CONTEXT = /^(əsr|yüzil|minillik|ildönüm|konqres|sinif)/iu;

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    ordinalAfter: CONTEXT,
};
