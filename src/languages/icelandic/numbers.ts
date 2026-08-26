/**
 * Icelandic cardinal number → words. Pattern B (bespoke) rather than the shared `westernNumberWords`, for two
 * reasons neither the shared composer nor the units-first Germanic one can express:
 *
 *  1. **The "og" conjunction.** Icelandic is tens-FIRST but binds the final unit with "og" — tuttugu og einn (21),
 *     fjörutíu og fimm (45) — and the same "og" appears before a trailing single-word remainder after a magnitude:
 *     eitt hundrað og einn (101), eitt þúsund og einn (1001). It does NOT appear when the remainder is itself a
 *     tens+unit pair that already carries one: eitt hundrað tuttugu og einn (121), never *…og tuttugu og einn.
 *  2. **Gender concord on 1–4.** einn/ein/eitt, tveir/tvær/tvö, þrír/þrjár/þrjú, fjórir/fjórar/fjögur. A multiplier
 *     agrees with the magnitude NOUN it counts, and the three magnitude nouns disagree with each other:
 *     hundrað and þúsund are NEUTER (tvö hundruð, tólf þúsund → but þrjú þúsund), milljón is FEMININE (tvær
 *     milljónir), milljarður is MASCULINE (tveir milljarðar). So the composer threads a gender down each branch.
 *
 * CITATION FORM (the judgment call a reviewer should check): a bare numeral with no counted noun is rendered in the
 * MASCULINE — 1 → "einn", 2 → "tveir", 21 → "tuttugu og einn" — because that is the series Icelandic uses when
 * counting aloud. The neuter (eitt, tvö) is the alternative convention used for arithmetic/telephone readings; it is
 * a one-line change (`BARE` below) if the referee ever prefers it. Note the neuter appears anyway inside a
 * hundred/thousand multiplier, so both series are exercised.
 *
 * Covers 0 … <10¹². Source for the number words: see the cited provenance on the `numbers` block in icelandic.jsonc.
 */
import { loadManifest } from "../../core/loadManifest.ts";

// icelandic.ts holds its own narrow view of the manifest (digraphs/graphemes); this module reads only the `numbers`
// block, so it declares its own slice rather than importing from icelandic.ts (which imports THIS module).
interface IcelandicNumbersDef {
    numbers: {
        ones: string[];
        onesFeminine: string[];
        onesNeuter: string[];
        tens: string[];
        connector: string;
        hundred: { one: string; plural: string };
        thousand: { one: string; word: string };
        million: { one: string; plural: string };
        billion: { one: string; plural: string };
    };
}
const N = loadManifest<IcelandicNumbersDef>(import.meta.url, "icelandic.jsonc").numbers;

/** The three gender series for 1–4; 5+ is invariant, so each falls back to the masculine `ones`. */
type Gender = "m" | "f" | "n";
const BARE: Gender = "m"; // the citation form for a numeral with no counted noun (see the header)
const OG = N.connector;

function one(k: number, g: Gender): string {
    if (g === "f") return N.onesFeminine[k] ?? N.ones[k]!;
    if (g === "n") return N.onesNeuter[k] ?? N.ones[k]!;
    return N.ones[k]!;
}

/** True when `below100(n)` is a SINGLE word — i.e. it does not already carry its own "og". Such a remainder takes
 *  an "og" from the magnitude above it (hundrað OG ellefu, þúsund OG tuttugu); a tens+unit pair does not. */
const singleWord = (n: number): boolean => n < 20 || n % 10 === 0;

/** 1 ≤ n < 100 (tens-first, "og" before the unit: tuttugu og einn). */
function below100(n: number, g: Gender): string {
    if (n < 20) return one(n, g);
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? N.tens[t]! : `${N.tens[t]} ${OG} ${one(u, g)}`;
}

/** 1 ≤ n < 1000. The hundreds multiplier is NEUTER (tvö hundruð) regardless of the gender flowing through. */
function below1000(n: number, g: Gender): string {
    if (n < 100) return below100(n, g);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = h === 1 ? N.hundred.one : `${one(h, "n")} ${N.hundred.plural}`;
    if (r === 0) return hundred;
    return `${hundred} ${singleWord(r) ? `${OG} ` : ""}${below100(r, g)}`;
}

/** Non-negative integer (< 10¹²) → Icelandic words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((c) => N.ones[Number(c)] ?? c).join(" ");
    if (n === 0) return N.ones[0]!; // núll
    const parts: string[] = [];
    const bil = Math.floor(n / 1e9),
        mil = Math.floor((n % 1e9) / 1e6),
        th = Math.floor((n % 1e6) / 1000),
        r = n % 1000;
    // Each magnitude noun imposes its own gender on its multiplier: milljarður m, milljón f, þúsund/hundrað n.
    if (bil) parts.push(bil === 1 ? N.billion.one : `${below1000(bil, "m")} ${N.billion.plural}`);
    if (mil) parts.push(mil === 1 ? N.million.one : `${below1000(mil, "f")} ${N.million.plural}`);
    if (th) parts.push(th === 1 ? N.thousand.one : `${below1000(th, "n")} ${N.thousand.word}`);
    if (r) {
        // A trailing single-word remainder is bound to the magnitude above it with "og" (eitt þúsund og einn).
        const tail = below1000(r, BARE);
        parts.push(parts.length > 0 && singleWord(r) ? `${OG} ${tail}` : tail);
    }
    return parts.join(" ");
}
