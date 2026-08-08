/**
 * Southern Quechua (qu / Runasimi) cardinal number → words. DECIMAL and fully regular, so a small bespoke
 * compositor rather than a `NumbersDef`: the one non-Western feature is the LINKING SUFFIX. Quechua does not
 * juxtapose a remainder onto a round base — it marks it with the possessive/comitative suffix -yuq ‘having’
 * (chunka hukniyuq = ‘ten having-one’ = 11), whose allomorph is -niyuq after a CONSONANT-final stem and -yuq
 * after a VOWEL-final one. `renderNumber` maps whole strings through the G2P word-by-word, and the tens are
 * themselves two words (iskay chunka), so neither `westernNumberWords` nor a `compound` table fits.
 *
 * SOURCE: English Wiktionary, Quechua cardinal numerals (Category:Quechua numerals) — every base word and the
 * whole linking pattern is a lemma there, and the `cardinalbox` chains give the composition verbatim:
 *   huk 1, iskay 2, kimsa 3, tawa 4, pichqa 5, suqta 6, qanchis 7, pusaq 8, isqun 9, chunka 10,
 *   pachak 100, waranqa 1000, hunu 10⁶, lluna 10⁹; chusaq / ch'usaq (Cusco-Collao) 0.
 *   101 = "pachak hukniyuq"; 1,001 = "waranqa hukniyuq"; 1,000,001 = "hunu hukniyuq";
 *   999 = "isqun pachak isqun chunka isqunniyuq";
 *   999,999 = "isqun pachak isqun chunka isqunniyuq waranqa isqun pachak isqun chunka isqunniyuq";
 *   999,999,999 = "… hunu … waranqa …" (the ⟨lluna⟩ entry's predecessor).
 * Those chains fix three rules this file implements: (a) the leading "one" is DROPPED on a bare magnitude
 * (pachak, not *huk pachak — like Spanish cien / mil), (b) only the FINAL unit word of a group takes the
 * -yuq linker, and (c) the groups themselves are largest-first with no conjunction.
 *
 * ATTESTED RANGE: 0 … 999,999,999,999 (lluna = 10⁹ is the highest magnitude Wiktionary lemmatises). At 10¹²
 * and above there is no attested magnitude word, so this falls back to DIGIT-BY-DIGIT rather than invent one.
 *
 * VARIANTS not used, for the record: ⟨kinsa⟩ for kimsa and ⟨pisqa / phichqa⟩ for pichqa are attested regional
 * spellings; this file takes the standardised trilingual-orthography lemma forms, matching quechua.jsonc.
 * ⟨ch'usaq⟩ (Cusco-Collao, with the ejective) is preferred over ⟨chusaq⟩ because this engine is Cusco-Collao.
 */
import { MANIFEST } from "./manifest.ts";

// 0..9. Index 0 is the Cusco-Collao ejective spelling of 'zero/empty'.
const UNITS = ["ch'usaq", "huk", "iskay", "kimsa", "tawa", "pichqa", "suqta", "qanchis", "pusaq", "isqun"];
const TEN = "chunka", HUNDRED = "pachak", THOUSAND = "waranqa", MILLION = "hunu", BILLION = "lluna";
const VOWELS = new Set(MANIFEST.spellingVowels); // ORTHOGRAPHIC (quechua.jsonc), never core/ipa.ts

/** The -yuq linker with its allomorphy: -niyuq after a consonant (huk → hukniyuq), -yuq after a vowel
 *  (kimsa → kimsayuq). Wiktionary lemmatises all nine: hukniyuq, iskayniyuq, kimsayuq, tawayuq, pichqayuq,
 *  suqtayuq, qanchisniyuq, pusaqniyuq, isqunniyuq — matching exactly this rule (⟨y⟩ is a consonant here). */
function linked(u: number): string {
    const w = UNITS[u]!;
    return w + (VOWELS.has(w[w.length - 1]!) ? "yuq" : "niyuq");
}

/** A magnitude group: `count` × `word`, with the leading "one" dropped (pachak, waranqa — never *huk pachak). */
function times(count: number, word: string): string {
    return count === 1 ? word : `${group(count)} ${word}`;
}

/** 1 ≤ n < 100. 11 → "chunka hukniyuq", 20 → "iskay chunka", 21 → "iskay chunka hukniyuq". */
function below100(n: number): string {
    if (n < 10) return UNITS[n]!;
    const t = Math.floor(n / 10), u = n % 10;
    const tens = times(t, TEN);
    return u === 0 ? tens : `${tens} ${linked(u)}`;
}

/** 1 ≤ n < 1000. 101 → "pachak hukniyuq", 555 → "pichqa pachak pichqa chunka pichqayuq". */
function group(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100), r = n % 100;
    const head = times(h, HUNDRED);
    if (r === 0) return head;
    // A remainder below ten is a bare unit in FINAL position → it takes the linker (pachak hukniyuq).
    return `${head} ${r < 10 ? linked(r) : below100(r)}`;
}

/** Largest-first magnitude chain (…lluna …hunu …waranqa …), each group composed by `group`. */
function compose(n: number): string {
    for (const [scale, word] of [[1e9, BILLION], [1e6, MILLION], [1e3, THOUSAND]] as [number, string][]) {
        if (n < scale) continue;
        const c = Math.floor(n / scale), r = n % scale;
        const head = times(c, word);
        return r === 0 ? head : `${head} ${r < 10 ? linked(r) : compose(r)}`;
    }
    return group(n);
}

/** Non-negative integer → Southern Quechua words. 10¹² and above (no attested magnitude) → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) {
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9").map((d) => UNITS[Number(d)]!).join(" ");
    }
    return n === 0 ? UNITS[0]! : compose(n);
}
