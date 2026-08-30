/**
 * Igbo cardinal number → words (space-separated; each runs through the g2p).
 *
 * ⚠ WHAT THIS REPLACES. Igbo had no number compositor, so `igbo.ts` handed every digit run to the `foreign`
 * fallback — which the registry wires to the ENGLISH phonemizer. `1945` read *wˈʌn θˈaᶷzənd nˈaᶦn hˈʌndɹəd
 * fˈɔːɹt̬i fˈaᶦv*: fluent English inside Igbo speech. A dropped symbol loses information; this asserted the wrong
 * language, which for TTS is the worse failure.
 *
 * THE SYSTEM, read off a 558,991-line ig.wikipedia dump (see igbo.jsonc for the counts):
 *   · MAGNITUDE FIRST, multiplier second — `iri abụọ` (ten·two) is 20. Settled by counting both orders in every
 *     magnitude, 11:1 to 275:1; one phrase (`otu nde`) looks like the opposite and is the multiplier-1 irregular.
 *   · `na` joins the parts: `iri na otu` (2,056 hits) is 11, `narị asatọ na iri asaa na atọ` is 873.
 *   · Magnitudes: iri 10, narị 100, puku 1000, nde 10⁶, ijeri 10⁹.
 *
 * The corpus writes large numbers out in full, which is how the whole structure was verified rather than inferred:
 *     "otu nde, puku narị anọ na otu, narị asatọ na iri asaa na atọ" = 1,401,873
 *
 * ⚠ ABOVE 10¹² AND FOR NON-FINITE INPUT IT READS DIGIT BY DIGIT, in Igbo units — the same fallback chichewa's
 * compositor uses above its own ceiling. That is a deliberate floor: an unidiomatic Igbo reading of a huge number
 * is a smaller error than a confident English one, and it is the property that guarantees no digit ever escapes to
 * the foreign path again.
 *
 * ⚠ AND IGBO HAS NO INDEPENDENT REFEREE — wikipron ibo_latn, epitran ibo-Latn and the kaikki extract are all 404.
 * Nothing external can score a composed numeral. The corpus attestations above are the evidence, and the anchor is
 * the adjudicated gold in test/igbo.test.ts. Treat a change here as unverifiable except against those.
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** A magnitude and its multiplier: `iri abụọ`, and the irregular `otu narị` when the multiplier is 1. */
function scaled(magnitude: string, multiplier: number): string {
    return multiplier === 1 ? `${N.one} ${magnitude}` : `${magnitude} ${N.units[multiplier]!}`;
}

/** 1 ≤ n < 100. `iri` alone is 10; `iri abụọ` is 20; `na` joins a unit remainder. */
function below100(n: number): string {
    if (n < 10) return n === 1 ? N.one : N.units[n]!;
    const t = Math.floor(n / 10), u = n % 10;
    const tens = t === 1 ? N.ten : `${N.ten} ${N.units[t]!}`;
    return u === 0 ? tens : `${tens} ${N.and} ${u === 1 ? N.one : N.units[u]!}`;
}

/** 1 ≤ n < 1000. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100), r = n % 100;
    const hundreds = scaled(N.hundred, h);
    return r === 0 ? hundreds : `${hundreds} ${N.and} ${below100(r)}`;
}

/**
 * A magnitude group and its remainder. The multiplier of a large magnitude is itself a full number — the corpus's
 * `puku narị anọ na otu` is thousand × (four hundred and one) — so this recurses through `below1000`.
 */
function group(n: number, size: number, magnitude: string): string {
    const count = Math.floor(n / size), rest = n % size;
    const head = count === 1 ? `${N.one} ${magnitude}` : `${magnitude} ${below1000(count)}`;
    return rest === 0 ? head : `${head} ${N.and} ${toWords(rest)}`;
}

/** Digit-by-digit, in Igbo units — the floor that keeps any digit from reaching the English fallback. */
function digits(s: string): string {
    return [...s].map((d) => (d === "0" ? N.zero : d === "1" ? N.one : N.units[digitIndex(d)] ?? d))
        .filter(Boolean).join(" ");
}

function toWords(n: number): string {
    if (n === 0) return N.zero;
    if (n < 1000) return below1000(n);
    if (n < 1_000_000) return group(n, 1000, N.thousand);
    if (n < 1_000_000_000) return group(n, 1_000_000, N.million);
    if (n < 1_000_000_000_000) return group(n, 1_000_000_000, N.billion);
    return "";
}

/** An Igbo cardinal for `n`, or a digit-by-digit reading when it is out of range or not a finite integer. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return digits(raw ?? String(n));
    const words = toWords(n);
    return words === "" ? digits(raw ?? String(n)) : words;
}
