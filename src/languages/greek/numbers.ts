/**
 * Modern Greek cardinal number → words (space-separated; each runs through the g2p). Simplified counting form
 * (δέκα = 10, tens[]/hundreds[] tables, χίλια = 1000); the full gender/case agreement is contextual and not
 * modelled. Covers 0 … <10¹²; larger / non-finite → digit-by-digit. Numbers are unmeasured (the referees are
 * word-only) — best-effort.
 *
 * the 10⁶ ceiling was raised because the corpus's `5.000.000` (a period-grouped number, de-grouped by
 * normalize.ts step 7) fell off it and read as seven digit names — «πέντε μηδέν μηδέν μηδέν μηδέν μηδέν
 * μηδέν». εκατομμύριο/δισεκατομμύριο take the same singular-vs-plural shape as χίλια/χιλιάδες.
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    const t = Math.floor(n / 10);
    const u = n % 10;
    // 10–19 are LEXICAL words (έντεκα, δώδεκα, δεκατρία …), not δέκα + unit. Composing them read 11 as
    // «δέκα ένα» on 59 of 1,969 FLEURS texts (#1510).
    if (t === 1) return N.teens[u]!;
    const tens = N.tens[t]!;
    return u ? `${tens} ${N.units[u]}` : tens;
}

function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    // ⚠ 100 IS εκατό ALONE and εκατόν BEFORE A REMAINDER (εκατόν ένα, εκατόν έντεκα); the other hundreds
    // do not change. `hundreds[1]` is the bare form, `hundred` the one that takes a remainder (#1510).
    if (!r) return N.hundreds[h]!;
    return `${h === 1 ? N.hundred : N.hundreds[h]!} ${below100(r)}`;
}

/**
 * The multiplier of χιλιάδες agrees with it, and χιλιάδα is FEMININE: «πεντακόσιες χιλιάδες», «τρεις
 * χιλιάδες» — not the neuter πεντακόσια / τρία the tables hold. Only 1, 3, 4 (13 and 14 with them) and the
 * hundreds inflect; everything else is invariant. Exposed by the digit de-grouping, which made the corpus's 50
 * period-grouped numbers (1.000, 783.562) reach this path as whole integers for the first time.
 */
const FEMININE: Readonly<Record<string, string>> = {
    "ένα": "μία", "τρία": "τρεις", "τέσσερα": "τέσσερις", "δεκατρία": "δεκατρείς", "δεκατέσσερα": "δεκατέσσερις",
};
const feminine = (s: string): string =>
    s.split(" ").map((w) => FEMININE[w] ?? w.replace(/όσια$/u, "όσιες")).join(" ");

function below1e6(n: number): string {
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const thousand = th === 1 ? N.thousand : `${feminine(below1000(th))} χιλιάδες`;
    return r ? `${thousand} ${below1000(r)}` : thousand;
}

export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((d) => N.units[digitIndex(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!;
    for (const [value, one, many] of [
        [1e9, "ένα δισεκατομμύριο", "δισεκατομμύρια"],
        [1e6, "ένα εκατομμύριο", "εκατομμύρια"],
    ] as const) {
        if (n >= value) {
            const q = Math.floor(n / value);
            const r = n % value;
            const head = q === 1 ? one : `${below1e6(q)} ${many}`;
            return r ? `${head} ${numberToWords(r)}` : head;
        }
    }
    return below1e6(n);
}
