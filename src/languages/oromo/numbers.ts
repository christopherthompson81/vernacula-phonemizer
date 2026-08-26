/**
 * Oromo number → words.
 *
 * ⚠ ATTESTATION VARIES BY CLASS, and the weakest pieces are marked, because Oromo compounding is the
 * part a reader should not assume is settled:
 *   [c] ones 1–10 and the TEENS LINKER "kudha", the tens digdama/soddoma, dhibba (100), kuma (1000)
 *       and miliyoona: attested in the FLEURS om_et source text itself and/or the kaikki human set.
 *   [t] jaatama/torbaatama: the Kamisee thesis attests the stems (jáatàm, torbáatàm).
 *   [r] afurtama/shantama/saddeettama/sagaltama and the TENS+UNIT linker -ii (digdamii tokko):
 *       standard Qubee reference forms, NOT corpus-attested here — the lowest-confidence pieces,
 *       same flag-and-state treatment as the Egyptian fused hundreds.
 *   "zeeroo" (0): the loan used in Ethiopian school usage; native duwwaa means "empty", not the digit.
 */
const ONES = [
    "zeeroo", "tokko", "lama", "sadii", "afur", "shan", "jaha", "torba", "saddeet", "sagal", "kudhan",
];
// Round tens 20–90. Stems: [c] digdama soddoma; [t] jaatama torbaatama; [r] the rest.
const TENS: Record<number, string> = {
    2: "digdama", 3: "soddoma", 4: "afurtama", 5: "shantama",
    6: "jaatama", 7: "torbaatama", 8: "saddeettama", 9: "sagaltama",
};
/** Tens linking form before a unit: digdama → digdamii ([r] — the reference linker). */
const link = (tens: string): string => tens.replace(/a$/, "ii");

function below100(n: number): string {
    if (n <= 10) return ONES[n]!;
    if (n < 20) return `kudha ${ONES[n - 10]!}`; // [c] the attested teens linker
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? TENS[t]! : `${link(TENS[t]!)} ${ONES[u]!}`;
}

function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100), r = n % 100;
    const head = h === 1 ? "dhibba" : `dhibba ${ONES[h]!}`; // dhibba lama = 200 (head noun + count)
    return r === 0 ? head : `${head} ${below100(r)}`;
}

/** Non-negative integer → Oromo words; out of range → digit-by-digit (digits only). */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) {
        return [...(raw ?? String(Math.abs(n)))].filter((c) => c >= "0" && c <= "9").map((d) => ONES[Number(d)]!).join(" ");
    }
    if (n === 0) return ONES[0]!;
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000), r = n % 1000;
        // below1000, NOT below100: a thousands count of 100 or more (783,562 → kuma dhibba torba
        // saddeettamii sadii …) reached `TENS[78]`, which is undefined, and CRASHED. It was unreachable
        // only because the tokenizer split a grouped number at the comma; de-grouping in
        // normalize.ts exposed it on the corpus's own `783,562` and `291,773`.
        const head = th === 1 ? "kuma" : `kuma ${below1000(th)}`; // kuma shan = 5,000 (corpus: kuma + count)
        return r === 0 ? head : `${head} ${below1000(r)}`;
    }
    const m = Math.floor(n / 1e6), r = n % 1e6;
    const head = m === 1 ? "miliyoona" : `miliyoona ${below1000(m)}`; // [c] miliyoona
    return r === 0 ? head : `${head} ${numberToWords(r)}`;
}
