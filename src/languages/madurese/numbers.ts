/**
 * Madurese cardinal number → words (space-separated; each runs through the g2p). Simplified counting form
 * (sapolo = 10, tens with polo, atos = 100, èbu = 1000, juta = 10⁶, miliar = 10⁹, triliun = 10¹²); the full
 * concord is contextual. Covers 0 … <10¹⁵; larger / non-safe / non-finite → digit-by-digit. Numbers are
 * unmeasured (no referee) — best-effort.
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n === 10) return N.ten;
    const t = Math.floor(n / 10);
    const u = n % 10;
    const tens = t === 1 ? N.ten : `${N.units[t]} ${N.tens}`;
    return u ? `${tens} ${N.and} ${N.units[u]}` : tens;
}

function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundred = h === 1 ? N.hundred : `${N.units[h]} ${N.hundred}`;
    return r ? `${hundred} ${N.and} ${below100(r)}` : hundred;
}

/**
 * THE MAGNITUDE SERIES, LARGEST FIRST — and both halves of it are evidence, not arithmetic.
 *
 * ⚠ THE WORD ORDER IS MULTIPLIER-THEN-MAGNITUDE, DESCENDING, which is the thing that had to be established
 * rather than assumed: `nya` (Chichewa) found a language whose digit-retaining order and spelled-out order
 * were opposites, and Madurese's Indonesian-adjacent neighbours do not all agree. The settling instance is
 * a whole composed numeral from a Madurese numeral description — 1,508,070 = *sajuta lèmaratos bâllu' èbu
 * pèttongpolo*, i.e. million-group, then thousand-group, then the remainder, each count BEFORE its
 * magnitude word (ruangbudaya.com, "Numeral dalam Bahasa Madura"). The corpus agrees wherever a figure and
 * a magnitude word are adjacent: `361 juta kilometer persegi`, `19,1 miliar`, `150 triliun` — never
 * *juta 361*.
 *
 * ⚠ THE SERIES STOPS AT 10¹² BECAUSE THE SOURCING DOES. juta/miliar/triliun are each attested twice over
 * (corpus + the numeral description, and `jutah`/`milyad` are dictionary headwords at
 * willnode.github.io/madura); a quadrillion is offered by ONE blog and by no corpus instance anywhere, so
 * it is not coined. Above 10¹⁵ the fallback below reads the digits one at a time — the fleet rule from
 * d38f00d / fdab9b1 and test/bignum-fallback.test.ts: refusing to COMPOSE is right, refusing to SPEAK is
 * not, and a numeral must never come out empty or as raw ASCII.
 */
const SCALES: readonly (readonly [number, string])[] = [
    [1e12, N.trillion],
    [1e9, N.billion],
    [1e6, N.million],
    [1e3, N.thousand],
];

/** The largest authored magnitude × 1000 — the first quantity this series cannot name. */
const CAP = 1e15;

export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= CAP)
        return [...(raw ?? String(Math.abs(n)))].map((d) => N.units[digitIndex(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!;
    for (const [value, word] of SCALES) {
        if (n < value) continue;
        const count = Math.floor(n / value);
        const r = n % value;
        // ⚠ A BARE MAGNITUDE AT COUNT 1, which is this file's existing house convention — `atos` for 100 and
        // `èbu` for 1000, never *settong atos*. The fuller counting forms fuse the prefix instead (saratos,
        // saèbu, sajuta, samilyar), so a leading "settong" would be wrong in either register.
        const head = count === 1 ? word : `${numberToWords(count)} ${word}`;
        return r ? `${head} ${N.and} ${numberToWords(r)}` : head;
    }
    return below1000(n);
}
