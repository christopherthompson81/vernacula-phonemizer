/**
 * Finnish cardinal number compositor. Finnish AGGLUTINATES: everything below 1000 is written as ONE concatenated word
 * (kaksikymmentäyksi = 21, kaksisataakolmekymmentäneljä = 234), and the magnitude words are joined for ⟨tuhat⟩
 * (kaksituhatta = 2000) but written separately for ⟨miljoona⟩ (kaksi miljoonaa = 2000000) — standard orthography. The
 * partitive stems (kymmentä / sataa / tuhatta / miljoonaa) are used when a count precedes the magnitude. The returned
 * space-separated word(s) are each phonemized downstream by phonemizeWord.
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** 1–99 as one concatenated Finnish word (never called with 0). */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n === 10) return N.ten;
    if (n < 20) return N.units[n - 10]! + N.teenSuffix; // 11–19: unit + "toista"
    const t = Math.floor(n / 10);
    const o = n % 10;
    return N.units[t]! + N.tensStem + (o ? N.units[o]! : ""); // 20–99: unit + "kymmentä" [+ ones]
}

/** 1–999 as one concatenated Finnish word. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundred = h === 1 ? N.hundred : N.units[h]! + N.hundredStem; // 100=sata, 200=kaksisataa
    return hundred + (r ? below100(r) : "");
}

/** Read a raw digit STRING digit-by-digit (nolla / yksi / …) — the fallback for out-of-range or over-long numbers.
 *  Operates on the string (not a float) so no precision is lost and an exponential String(Number) can't leak e/+. */
export function readDigits(digits: string): string {
    return digits.split("").map((d) => (Number(d) === 0 ? N.zero : N.units[digitIndex(d)] ?? d)).join(" ");
}

/** A non-negative integer → its Finnish cardinal reading (space-separated at the tuhat/miljoona magnitude joints).
 *  Callers with a raw digit string longer than 9 digits should use readDigits directly (a float would already be lossy). */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) return readDigits(raw ?? String(n)); // out of range → digit-by-digit
    if (n === 0) return N.zero;
    const parts: string[] = [];
    const mil = Math.floor(n / 1e6);
    const after = n % 1e6;
    if (mil > 0) {
        if (mil === 1) parts.push(N.million); // "miljoona"
        else { parts.push(below1000(mil)); parts.push(N.millionStem); } // "kaksi", "miljoonaa" (written separately)
    }
    const th = Math.floor(after / 1000);
    const rem = after % 1000;
    if (th > 0) parts.push(th === 1 ? N.thousand : below1000(th) + N.thousandStem); // "tuhat" / "kaksituhatta" (joined)
    if (rem > 0) parts.push(below1000(rem));
    return parts.join(" ");
}
