/**
 * SPANISH (es) Roman-numeral reading.
 *
 * A CENTURY IS A CARDINAL — the existing shared pass is already right, and this file deliberately does not
 * touch it. RAE, *Ortografía de la lengua española*, «Lectura de los números romanos»: «Del siglo XI en
 * adelante, solo es normal su lectura como cardinales: siglo XI (siglo *once*), siglo XVIII (siglo
 * *dieciocho*), siglo XXI (siglo *veintiuno*)»; only I–X may also be read as ordinals («se leen
 * indistintamente como cardinales o como ordinales, con preferencia culta por estos últimos»).
 *   → https://www.rae.es/ortografía/lectura-de-los-números-romanos
 * The same rule governs regnal names: ordinal up to X (*Juan Carlos I* = *primero*, *Carlos III* =
 * *tercero*), cardinal from XI on (*Luis XIV* = *catorce*, *Benedicto XVI* = *dieciséis*). So `siglo XVIII`
 * → *siglo dieciocho*, which is exactly what the cardinal pass already produces. No century noun and no
 * regnal name appears in the triggers below.
 *
 * WHAT THIS FILE IS FOR: the *prenominal* ordinal — a Roman numeral placed BEFORE its noun in the name of
 * an edition, anniversary or congress, which is read as an ordinal at ANY value. `XL aniversario` is
 * *cuadragésimo aniversario* and `L aniversario` is *quincuagésimo aniversario*; the cardinal pass reads
 * those as *cuarenta* / *cincuenta*, which is wrong. That is why `ordinal` is a function over all n and not
 * a century-sized table, and why only `ordinalAfter` (the noun that FOLLOWS the numeral) is populated.
 *
 * WHY REGNAL IS OUT OF SCOPE, explicitly: the norm above is ordinal ≤ X / cardinal ≥ XI, but the policy
 * exposes ONE ordinal function shared by every context, and the prenominal-event context needs an ordinal
 * at 40 and 50. Bounding the function at ten would break the case this file exists for; leaving it
 * unbounded and adding regnal names would produce *Luis decimocuarto* against the RAE. Documented
 * shortcoming: `Carlos III` keeps the cardinal *tres*. (Two of the frequent regnal values are unreachable
 * anyway — the shared pass never converts the single letter `I`, and `VI` is on its global collision list.)
 *
 * FORM: the -ésimo series is NOT derivable from Spanish's cardinal compositor (*vigésimo* has no cardinal
 * *veinte* inside it), so unlike Italian/Catalan this is authored ordinal data: units, teens, the -ésimo
 * tens and the hundreds, composed in RAE's separated spelling (*vigésimo primero*, *cuadragésimo
 * segundo*). Above one thousand it returns `undefined` and the cardinal stands, which is also the right
 * reading for a Roman-numeral year.
 *
 * AGREEMENT: masculine singular. Every trigger noun below is masculine, so the reading agrees.
 * LIMITATION: feminine heads need -ésima — *la XXV Olimpiada* is *vigésima quinta*, *la III edición* is
 * *tercera* — so feminine nouns are kept OUT of the trigger list and keep the cardinal reading rather than
 * acquiring a wrong-gender ordinal.
 */
import type { RomanPolicy } from "../../core/roman.ts";
import { MANIFEST } from "./manifest.ts";

/** The masculine ordinal tables (spanish.jsonc `ordinals`). Shared with normalize.ts, which reads them for
 *  the ordinal INDICATORS (1º / 1ª / 1er) and for fractions — one table, three callers. */
const ORD = MANIFEST.ordinals;

/** Spanish masculine ordinal, 1 … 1000; `undefined` above that (a Roman-numeral year reads as a cardinal).
 *  Exported so normalize.ts can reuse it for the ordinal INDICATORS (1º/1ª/1er) and for fractions. */
export function spanishOrdinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 1000) return undefined;
    if (n === 1000) return ORD.thousandth;
    if (n < 10) return ORD.units[n];
    if (n < 20) return ORD.teens[n - 10];
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return u === 0 ? ORD.tens[t] : `${ORD.tens[t]} ${ORD.units[u]}`;
    }
    const h = Math.floor(n / 100), r = n % 100;
    return r === 0 ? ORD.hundreds[h] : `${ORD.hundreds[h]} ${spanishOrdinal(r)}`;
}

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal: spanishOrdinal,
    /**
     * Noun AFTER the numeral — the prenominal ordinal of event and edition names, the one Spanish context
     * that is genuinely ordinal at any value. Masculine nouns only (see AGREEMENT). `siglo` is absent on
     * purpose: it precedes its numeral, and it is a cardinal anyway.
     */
    ordinalAfter:
        /^(aniversario|centenario|congreso|encuentro|festival|campeonato|certamen|concurso|premio|salón|simposio|coloquio|seminario|torneo|foro|ciclo|volumen|capítulo|tomo|canto|acto|artículo|batallón|regimiento|gobierno)$/iu,
};
