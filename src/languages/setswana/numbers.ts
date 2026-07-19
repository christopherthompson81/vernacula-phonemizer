/**
 * Setswana cardinal number → words (space-separated; each runs through the g2p). Uses the Mistry Cycle 29
 * bo-counting series (bongwe … botlhano; 8/9 = the two-word "bofera …" bent-finger forms). Tens and hundreds
 * multiply with the ma- forms ("masome a mabedi" = 20, "makgolo a mararo" = 300; 7/8/9 → participial supang /
 * ferang …); additive parts join descending with ⟨le⟩ "and". Thousands (dikete tse …) are best-effort; ≥10⁶ or
 * unsafe integers degrade to digit-by-digit. Numbers are unmeasured (the referee is word-only) — best effort.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n === 10) return N.ten;
    const t = Math.floor(n / 10);
    const u = n % 10;
    // 11-19 = "lesome le <unit>"; 20-99 = "masome a <mult>" (+ " le <unit>")
    const tens = t === 1 ? N.ten : `${N.tensWord} ${N.of} ${N.mult[t]}`;
    return u ? `${tens} ${N.and} ${N.units[u]}` : tens;
}

function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundred = h === 1 ? N.hundred : `${N.hundredsWord} ${N.of} ${N.mult[h]}`;
    return r ? `${hundred} ${N.and} ${below100(r)}` : hundred;
}

export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e6)
        return [...String(Math.abs(n))].map((d) => (d === "0" ? N.zero : N.units[Number(d)])).join(" ");
    if (n === 0) return N.zero;
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    // 1000 = sekete; k×1000 = "dikete tse <di-mult>" for 2..9; 10..999 thousands → "dikete tse " + below1000
    const thousand = th === 1
        ? N.thousand
        : `${N.thousandsWord} ${N.these} ${th < 10 ? N.diMult[th]! : below1000(th)}`;
    return r ? `${thousand} ${N.and} ${below1000(r)}` : thousand;
}
