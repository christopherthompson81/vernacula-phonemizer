/**
 * Danish cardinal number → words. Danish is the fleet's VIGESIMAL (base-20) outlier above 40 — halvtreds (50,
 * "half-third × 20"), tres (60), halvfjerds (70), firs (80), halvfems (90) — AND units-first with "og"
 * (enogtyve = 21, femoghalvfjerds = 75, nioghalvfems = 99). Because the modern tens are the CONTRACTED forms, the
 * base-20 arithmetic is entirely lexicalised: the table in danish.jsonc holds the tens and the composer below is
 * the ordinary units-first Germanic algorithm (see unitsFirstNumbers.ts). Values above 100 are written OPEN and
 * chained with "og" per Dansk Sprognævn ("to tusind og fem hundrede og otteogtredive" = 2538). Covers 0 … <10¹².
 *
 * Source for the number words: see the cited provenance on the `numbers` block in danish.jsonc.
 */
import { MANIFEST } from "./manifest.ts";
import { unitsFirstNumberToWords, type UnitsFirstDef } from "./unitsFirstNumbers.ts";

// Number words are authored DATA — consolidated in danish.jsonc; the shape below is the algorithm's configuration.
const N = MANIFEST.numbers;
const OG = ` ${N.connector} `; // Danish chains magnitude groups (and hundreds↔remainder) with a spaced "og"

const DEF: UnitsFirstDef = {
    ones: N.ones,
    tens: N.tens,
    connector: () => N.connector, // enogtyve — no sandhi, "og" is invariant in Danish compounds
    hundred: N.hundred,
    thousand: N.thousand,
    million: N.million,
    billion: N.billion,
    mulJoin: " ", // "to hundrede", "tolv tusind" — Danish writes these open
    hundredRemJoin: OG, // "fem hundrede og femoghalvfjerds"
    groupJoin: OG, // "tolv tusind og tre hundrede og femogfyrre"
};

/** Non-negative integer (< 10¹²) → Danish words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    return unitsFirstNumberToWords(n, DEF);
}
