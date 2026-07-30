/**
 * Tashelhit / Shilha (shi) cardinal number → words, in the Berber Latin alphabet. **SYSTEM: MOROCCAN ARABIC LOAN
 * numerals, with NATIVE Berber kept for 1–3.** This is a deliberate, contested choice and the reasoning is below.
 *
 * ★★ FIRST, A CORRECTION WORTH RECORDING. The usual claim — "Berber has native 1–10 but Arabic loans take over
 *   above 3" — is the CENTRAL MOROCCAN / TARIFIYT / KABYLE picture, and it is **wrong for Tashelhit**. Tashelhit is
 *   one of the few Northern Berber languages that preserves the full native decade 1–10 *and* a native VIGESIMAL
 *   system for 11–99 (Kossmann 2013:307–308, citing Aspinion 1953:254ff. and Galand 1988:230; independently
 *   corroborated by the Peace Corps 2011 supplementary lesson):
 *     native 1–10 (m/f): yan/yat · sin/snat · kraḍ/kraṭṭ · kkuẓ/kkuẓt · smmus/smmust · sḍis/sḍist · sa/sat ·
 *                        tam~ttam/tamt · tẓa~tẓẓa/tẓat · mraw/mrawt
 *     native vigesimal: 11–19 = digit + `d` + mraw (ttam d mrawt = 18) · 30 = ɛcrin d mraw · 40 = sin id-ɛcrin
 *                       (2×20) · 90 = kkuẓ id-ɛcrin d mraw
 *   So the native system is richer than the brief assumed. It is nevertheless **recessive**, and — decisively —
 *   **even the native system borrows at 100 and 1000** (mya, alf). There is NO native Tashelhit decimal system
 *   above 10; the old literary `timiḍi` 100 / `ifḍ` 1000 are genuine 18th-century Tashelhit (van den Boogert
 *   1997:286–287) but obsolete, and `agim` 1000 is Tuareg/Kabyle, not Tashelhit at all.
 *
 * ★★ WHY THE ARABIC SYSTEM IS THE DEFAULT ANYWAY. The sole practical teaching resource for the language states it
 *   flatly — Peace Corps/Morocco, *Tashlheet Textbook* (2011), p. 37, verbatim:
 *       "In TashlHeet we usually use Arabic numbers except for the numbers: one, two and three."
 *   Its main numerals chapter teaches native 1–3 and then Arabic from 4 up; the native decade and the vigesimal
 *   system are relegated to a back-of-book supplementary lesson. Kossmann's chapter on Berber numerals reaches the
 *   same conclusion about actual usage. And the Arabic series is the **only** system with complete, uncontested
 *   coverage from 1 to 10⁹ — the native one runs out at 99 and was never current at 100+.
 *   Cutting at 3 rather than at 10 therefore matches the one source that describes real speech, and it keeps the
 *   voice recognisably Tashelhit rather than Darija at the frequencies that matter most.
 *   A "purist" mode (native decade + vigesimal) would be a legitimate flag-gated addition, but it must not be the
 *   default: it is recessive, regionally variable, and cannot reach 100.
 *
 * ★ SOURCES
 *   - **Peace Corps/Morocco, *Tashlheet Textbook* (2011), pp. 37–44 and 210–212** — the loan table, the "except
 *     one, two and three" rule, and the supplementary native/vigesimal lesson. (Its OCR renders ɛ as an Arabic
 *     ʿayn and ḥ as a Cyrillic н; those are normalised here.)
 *   - **Kossmann, *The Arabic Influence on Northern Berber* (Brill 2013), §9.3, pp. 306–312** — the native decade,
 *     the vigesimal system, the `id-ɛcrin` plural, and the 100/1000 borrowing even in the native system.
 *   - Aspinion, *Apprenons le berbère* (1953), pp. 254ff. and Galand (1988:230), both via Kossmann's verbatim
 *     quotation (the archive.org Aspinion is image-only).
 *   - van den Boogert (1997:286–287) for the obsolete literary timiḍi/ifḍ.
 *   - Wikipedia "Shilha language" (Numerals); Wikivoyage Tashelhit phrasebook.
 *   - **WIKTIONARY CAVEAT — deliberately NOT followed.** `Module:number_list/data/shi` builds its tens with a
 *     vigesimal loop spelling `idaw ɛcrin`; `idaw` is a nonstandard rendering of the plural marker `id-`, and its
 *     `numbers[100] = {"mya", "smmus idaw ɛcrin", "timiḍi"}` is an editor's extrapolation, not an attestation.
 *     Kossmann's `id-ɛcrin` is preferred, and none of that module's composed forms are used here.
 *
 * ★ ORTHOGRAPHY. The forms below are in the **Berber Latin alphabet**, which is what tashelhit.ts's Latin
 *   grapheme map consumes (ɛ→ʕ, ḍ→dˤ, ṣ→sˤ, ḥ→ħ, c→ʃ). The engine also accepts Neo-Tifinagh and — by design —
 *   yields IDENTICAL IPA from either script, so emitting Latin is not a script choice with phonetic consequences;
 *   it is simply the script the loan numerals are conventionally written in in the sources.
 *
 * ★ COMPOSITION (Moroccan Arabic)
 *   - **units-first inside the final tens+units pair**, joined by `u`: 45 = `xmsa u rbɛin`, 21 = `waḥd u ɛcrin`.
 *   - everything else runs largest → smallest, also joined by `u`: 345 = `tlt mya u xmsa u rbɛin`.
 *   - hundreds: 100 `mya`, 200 the DUAL `myatayn`, 300–900 the SHORT stem + `mya` (`tlt mya`).
 *   - thousands: 1000 `alf`, 2000 the DUAL `alfayn`, 3000–10000 the SHORT stem + the PLURAL `alaf` (`tlt alaf`),
 *     and from 11 000 up the singular again (`tnac alf`) — the standard Arabic count-triggered number agreement.
 *   - GENDER: native numerals agree with the counted noun (yan/yat), Arabic loans do not. A bare digit has no
 *     noun, so the **masculine** is used; this is the same counting-form compromise the Maltese engine makes.
 *
 * SIMPLIFICATIONS / SEAMS (flagged, none invented):
 *   - **The 1–3 native / 4+ Arabic split leaves one visible seam.** Inside a tens+units compound the sources give
 *     Arabic `waḥd` (1) and `tnayn` (2) rather than native yan/sin — so 21 is `waḥd u ɛcrin`. For **3** no Arabic
 *     free form is attested in the sources consulted (only the bound `tlt-` / `tlatin` / `tltac`), so the compound
 *     slot keeps native `kraḍ`: 33 = `kraḍ u tlatin`. Synthesising `tlata` from the bound stem would be inventing
 *     a numeral, so we don't. This is the least-supported corner of the table and the first place to revisit.
 *   - 10⁶ `mlyun` / 10⁹ `mlyar` are attested as lexemes with the plurals `mlayn` / `mlayr`, but no source spells
 *     out a counted example, so the 3–10 → plural / 11+ → singular pattern is applied to them **by analogy** with
 *     the well-attested alf/alaf behaviour. No dual is attested for either, so 2 000 000 uses the plural
 *     (`tnayn mlayn`) rather than an invented *mlyunayn.
 *   - 0 = `ṣifr` (the Arabic loan, which is what Wiktionary's shi module uses). The Peace Corps textbook has no
 *     zero entry at all. `amya` is an IRCAM standardised-Amazigh neologism belonging to the school/Neo-Tifinagh
 *     register, not to colloquial Tashelhit, so it is not generated.
 *   - ATTESTED RANGE / FALLBACK: 0 … 10¹²−1 (the Arabic loan series is complete and uncontested across that
 *     span). At 10¹² and above, and for any non-safe integer, this falls back to DIGIT-BY-DIGIT.
 */

// 0–10. 1–3 are NATIVE Berber (masculine); 4–10 are the Moroccan Arabic loans.
const UNITS = [
    "ṣifr", // 0 — Arabic loan; no native Berber zero
    "yan", // 1 native (also the indefinite article; never `waḥd` standalone)
    "sin", // 2 native
    "kraḍ", // 3 native
    "rbɛa", // 4 Arabic
    "xmsa", // 5
    "stta", // 6
    "sbɛa", // 7
    "tmnya", // 8
    "tsɛud", // 9
    "ɛcra", // 10
];
// The forms a unit takes INSIDE a tens+units compound: Arabic waḥd/tnayn replace native yan/sin. 3 keeps native
// kraḍ because no free Arabic form for 3 is attested in the sources — see the SEAMS note in the header.
const COMPOUND_UNITS = UNITS.map((w, i) => (i === 1 ? "waḥd" : i === 2 ? "tnayn" : w));
// 11–19, the Moroccan Arabic teens.
const TEENS = ["ḥdac", "tnac", "tltac", "rbɛtac", "xmstac", "sttac", "sbɛtac", "tmntac", "tsɛtac"];
// Round tens, keyed by the tens DIGIT. 20 `ɛcrin` is an Arabic loan with no native competitor at all.
const TENS: Record<number, string> = {
    2: "ɛcrin",
    3: "tlatin",
    4: "rbɛin",
    5: "xmsin",
    6: "sttin",
    7: "sbɛin",
    8: "tmanin",
    9: "tsɛin",
};
// The SHORT (bound) stems used before mya / alaf: tlt mya, xms alaf.
const SHORT: Record<number, string> = { 3: "tlt", 4: "rbɛ", 5: "xms", 6: "stt", 7: "sbɛ", 8: "tmn", 9: "tsɛ", 10: "ɛcr" };
const AND = "u";
const HUNDRED = "mya",
    HUNDRED_DUAL = "myatayn";
const THOUSAND = "alf",
    THOUSAND_DUAL = "alfayn",
    THOUSAND_PLURAL = "alaf";
const MILLION = "mlyun",
    MILLION_PLURAL = "mlayn";
const BILLION = "mlyar",
    BILLION_PLURAL = "mlayr";

/** 1 ≤ n < 100. Units-FIRST in the compound: xmsa u rbɛin = 45. */
function below100(n: number): string {
    if (n <= 10) return UNITS[n]!;
    if (n < 20) return TEENS[n - 11]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${COMPOUND_UNITS[u]} ${AND} ${TENS[t]}`;
}

/** 1 ≤ n < 1000. 100 mya · 200 myatayn (dual) · 300–900 SHORT + mya. */
function below1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return below100(n);
    const head = h === 1 ? HUNDRED : h === 2 ? HUNDRED_DUAL : `${SHORT[h]} ${HUNDRED}`;
    return r === 0 ? head : `${head} ${AND} ${below100(r)}`;
}

/** The thousands head: alf · alfayn (dual) · SHORT + alaf (3–10) · below1000 + alf (11+). */
function thousandsHead(th: number): string {
    if (th === 1) return THOUSAND;
    if (th === 2) return THOUSAND_DUAL;
    if (th <= 10) return `${SHORT[th]} ${THOUSAND_PLURAL}`;
    return `${below1000(th)} ${THOUSAND}`;
}

/** 1 ≤ n < 10⁶. */
function below1e6(n: number): string {
    const th = Math.floor(n / 1000),
        r = n % 1000;
    if (th === 0) return below1000(n);
    const head = thousandsHead(th);
    return r === 0 ? head : `${head} ${AND} ${below1000(r)}`;
}

/** A million/milliard head, on the alf/alaf model (see the header's by-analogy note). */
function bigHead(count: number, sg: string, pl: string): string {
    if (count === 1) return sg;
    if (count <= 10) return `${COMPOUND_UNITS[count]} ${pl}`;
    return `${below1000(count)} ${sg}`;
}

/** Read a digit string one digit at a time (the ≥10¹² / unsafe-integer fallback). */
export function readDigits(digits: string): string {
    return [...digits].map((d) => UNITS[Number(d)] ?? d).join(" ");
}

/**
 * Non-negative integer → Tashelhit cardinal words in the Berber Latin alphabet: Moroccan Arabic loans with native
 * Berber 1–3, largest→smallest joined by `u`, units-first in the final tens+units pair. ≥10¹² or non-safe →
 * digit-by-digit.
 */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) return readDigits(String(n));
    if (n === 0) return UNITS[0]!;
    if (n < 1e6) return below1e6(n);
    if (n < 1e9) {
        const m = Math.floor(n / 1e6),
            r = n % 1e6;
        const head = bigHead(m, MILLION, MILLION_PLURAL);
        return r === 0 ? head : `${head} ${AND} ${below1e6(r)}`;
    }
    const b = Math.floor(n / 1e9),
        r = n % 1e9;
    const head = bigHead(b, BILLION, BILLION_PLURAL);
    return r === 0 ? head : `${head} ${AND} ${numberToWords(r)}`;
}
