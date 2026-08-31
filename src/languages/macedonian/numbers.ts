/**
 * Macedonian (mk) number WORDS — cardinal and ordinal, shared by the engine (macedonian.ts) and the
 * normalization layer (normalize.ts). Macedonian cardinals join tens+units and hundreds+remainder with
 * "и" (дваесет и еден = 21, сто и деведесет = 190); илјада (thousand) is feminine, so the 2 multiplier
 * becomes "две" (две илјади). Ordinals are formed from the cardinal by ordinalizing ONLY the last
 * element: 190 → "сто и деведесетти", 1970 → "илјада деветстотини и седумдесетти". The written
 * N-суффикс convention (17-ти, 18-тиот, 37-ма) is resolved here via `mkOrdinal` + gender/definiteness
 * transforms — see normalize.ts, where the suffix rules live.
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    teens: string[];
    tens: Record<string, string>;
    hundreds: Record<string, string>;
    thousand: string;
    thousands: string;
    million: string;
    millions: string;
    and: string;
}
const NUM = loadManifest<{ numbers: NumbersDef }>(import.meta.url, "macedonian.jsonc").numbers;

/** Build the Macedonian words for n; "и" precedes the final component (дваесет и еден; сто и еден). */
export function numberToText(n: number, raw?: string): string {
    // ⚠ A NON-INTEGER IS REFUSED EXPLICITLY, AND THAT CLOSES A CROSS-ENGINE DIVERGENCE AT AN UNREACHABLE
    // BOUNDARY (found porting to C#). Without it, `units[0.5]` is a property lookup that yields `undefined`
    // here — the `!` below is a lie for that input — while a typed port must truncate the index and answer
    // *нула*. No caller can produce it: every one passes a `\d+` capture, a `Math.floor`, or a `%` of
    // integers. Refusing it makes the two engines agree by construction instead of by luck, and makes the
    // assertions on the next four lines true.
    if (n < 0 || !Number.isInteger(n)) return "";
    if (n < 10) return NUM.units[n]!;
    if (n === 10) return NUM.ten;
    if (n < 20) return NUM.teens[n - 11]!;
    if (n < 100) {
        const t = NUM.tens[String(Math.floor(n / 10) * 10)]!, u = n % 10;
        return u ? `${t} ${NUM.and} ${NUM.units[u]}` : t;
    }
    if (n < 1000) {
        const h = NUM.hundreds[String(Math.floor(n / 100))]!, r = n % 100;
        if (!r) return h;
        return `${h} ${r < 20 || r % 10 === 0 ? NUM.and + " " : ""}${numberToText(r)}`;
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000), r = n % 1000;
        // The multiplier of the FEMININE илјада takes feminine "две" for 2 (две илјади, not два).
        const thCount = numberToText(th).split(" ").map((x) => (x === NUM.units[2] ? "две" : x)).join(" ");
        const thWord = th === 1 ? NUM.thousand : `${thCount} ${NUM.thousands}`;
        if (!r) return thWord;
        return `${thWord} ${r < 100 || r % 100 === 0 ? NUM.and + " " : ""}${numberToText(r)}`;
    }
    if (n < 1_000_000_000) {
        const mil = Math.floor(n / 1_000_000), r = n % 1_000_000;
        const milWord = mil === 1 ? NUM.million : `${numberToText(mil)} ${NUM.millions}`; // милион is masculine
        return r ? `${milWord} ${numberToText(r)}` : milWord;
    }
    return [...(raw ?? String(n))].filter((c) => c >= "0" && c <= "9").map((d) => NUM.units[Number(d)]!).join(" ");
}

/** Masculine-indefinite ordinal words 1–19. */
const ORD = [
    "", "први", "втори", "трети", "четврти", "петти", "шести", "седми", "осми", "деветти",
    "десетти", "единаесетти", "дванаесетти", "тринаесетти", "четиринаесетти", "петнаесетти",
    "шеснаесетти", "седумнаесетти", "осумнаесетти", "деветнаесетти",
];
const ORD_TENS: Record<string, string> = {
    "20": "дваесетти", "30": "триесетти", "40": "четириесетти", "50": "педесетти",
    "60": "шеесетти", "70": "седумдесетти", "80": "осумдесетти", "90": "деведесетти",
};
const HUND_ORD: Record<string, string> = {
    "1": "стоти", "2": "двестоти", "3": "тристоти", "4": "четиристоти", "5": "петстоти",
    "6": "шестоти", "7": "седумстоти", "8": "осумстоти", "9": "деветстоти",
};

/**
 * Integer → the masculine-indefinite nominative ordinal, ordinalizing only the LAST element:
 * 190 → "сто и деведесетти", 1970 → "илјада деветстотини и седумдесетти". Undefined out of the
 * supported range (the corpus's ordinal contexts — suffixes, centuries, dates — are all < 10000).
 */
export function mkOrdinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 9999) return undefined;
    if (n < 20) return ORD[n]!;
    if (n < 100) {
        const t = Math.floor(n / 10) * 10, u = n % 10;
        return u ? `${NUM.tens[String(t)]} ${NUM.and} ${ORD[u]}` : ORD_TENS[String(t)]!;
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        if (!r) return HUND_ORD[String(h)]!;
        return `${NUM.hundreds[String(h)]} ${r < 20 || r % 10 === 0 ? NUM.and + " " : ""}${mkOrdinal(r)}`;
    }
    const th = Math.floor(n / 1000), r = n % 1000;
    if (r === 0) return th === 1 ? "илјадити" : `${numberToText(th)} илјадити`;
    const thWord = th === 1 ? NUM.thousand : `${numberToText(th)} ${NUM.thousands}`;
    return `${thWord} ${r < 100 || r % 100 === 0 ? NUM.and + " " : ""}${mkOrdinal(r)}`;
}
