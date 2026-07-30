/**
 * CATALAN (ca) Roman-numeral reading.
 *
 * Researched independently of Spanish, and the answer is *not* simply "same as Spanish" — Catalan's rule is
 * stated in terms of POSITION, and it is the cleanest statement of it in the whole Romance set. Optimot
 * (Generalitat de Catalunya), fitxa «Ús i lectura de les xifres romanes»:
 *   • before its noun → ORDINAL, at any value: «quan van davant del nom a què fan referència, es llegeixen
 *     com a ordinals» — *el III Festival de Dansa* ("tercer"), *la XXV Olimpíada* ("vint-i-cinquena");
 *   • after its noun → CARDINAL: «quan van darrere del nom se solen llegir com a cardinals, tot i que els
 *     nombres inferiors a onze també es poden llegir com a ordinals» — *el segle III* ("tres" o "tercer"),
 *     *el volum X* ("deu" o "desè");
 *   • personal names → ordinal below eleven, cardinal above: *Joan Carles I* ("primer"), *Enric VIII*
 *     ("vuitè"), *Benet XIII* ("tretze").
 *   → https://aplicacions.llengua.gencat.cat/llc/AppJava/index.html (Optimot, fitxa 16169)
 * ésAdir (the broadcast standard) agrees on the reading of the high numbers: «Pius XII ("dotze")», «Lluís
 * XIV ("catorze")».  → https://esadir.cat/entrades/fitxa/id/5050
 *
 * A CENTURY IS THEREFORE A CARDINAL: `segle XVIII` is postposed, so *segle divuit* — what the existing
 * shared pass already produces. `segle` is not in the triggers below.
 *
 * WHAT THIS FILE IS FOR: the PRENOMINAL ordinal, which Optimot marks as ordinal with no upper bound —
 * `XL aniversari` is *quarantè aniversari*, `L aniversari` *cinquantè*, where the cardinal pass would say
 * *quaranta* / *cinquanta*. Hence `ordinal` is a function over all n and only `ordinalAfter` (the noun that
 * FOLLOWS the numeral) is populated.
 *
 * WHY REGNAL IS OUT OF SCOPE, explicitly: Optimot's personal-name rule is ordinal < XI / cardinal ≥ XI, but
 * the policy exposes ONE ordinal function shared by every context and the prenominal-event context needs an
 * ordinal at 40 and 50. Bounding the function at ten would break the case this file exists for; leaving it
 * unbounded and adding regnal names would produce *Lluís catorzè* against both sources. Documented
 * shortcoming: `Enric VIII` keeps the cardinal — and in practice is not converted at all, `VI`/`XI` being on
 * the shared pass's global collision list and `I` below its two-character minimum.
 *
 * FORM: derived from Catalan's own cardinal compositor (`numberToWords`), because the Catalan ordinal above
 * ten is the cardinal plus `-è` (vint → vintè, quaranta → quarantè, cinquanta → cinquantè, vint i cinc →
 * vint i cinquè). Only 1–4 and 10 are genuinely irregular, but 1–10 is tabulated for legibility. Note the
 * compositor emits the orthographic hyphens of *vint-i-cinquè* as spaces, by the same deliberate convention
 * as the cardinals in ./numbers.ts (each word must reach the g2p separately).
 *
 * AGREEMENT: masculine singular (`-è`). Every trigger noun is masculine. LIMITATION: feminine heads need
 * `-ena` — Optimot's own *la XXV Olimpíada* is *vint-i-cinquena*, *la III edició* *tercera* — so feminine
 * nouns are kept OUT of the trigger list and keep the cardinal reading rather than acquiring a wrong-gender
 * ordinal.
 */
import type { RomanPolicy } from "../../core/roman.ts";
import { numberToWords } from "./numbers.ts";

/** 1–10; *primer/segon/tercer/quart* and *desè* are not derivable from the cardinal. */
const IRREGULAR: Readonly<Record<number, string>> = {
    1: "primer", 2: "segon", 3: "tercer", 4: "quart", 5: "cinquè",
    6: "sisè", 7: "setè", 8: "vuitè", 9: "novè", 10: "desè",
};

/** Cardinal final word → its ordinal stem, where `-è` cannot simply be appended. */
function ordinalizeWord(w: string): string {
    if (w.endsWith("cinc")) return `${w.slice(0, -1)}què`; // cinc → cinquè, vint i cinc → vint i cinquè
    if (w.endsWith("nou")) return `${w.slice(0, -1)}vè`; // nou → novè, dinou → dinovè
    if (w.endsWith("deu")) return `${w.slice(0, -1)}sè`; // deu → desè, cent deu → cent desè
    if (w === "cents") return "centè"; // dos cents → dos centè (orthographically dos-centè)
    if (/[aeiou]$/u.test(w)) return `${w.slice(0, -1)}è`; // quaranta → quarantè, onze → onzè
    return `${w}è`; // vint → vintè, cent → centè, mil → milè
}

/** Catalan masculine ordinal for any n a Roman numeral can encode. */
function catalanOrdinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1) return undefined;
    const irr = IRREGULAR[n];
    if (irr !== undefined) return irr;
    const words = numberToWords(n).split(" ");
    words[words.length - 1] = ordinalizeWord(words[words.length - 1]!);
    return words.join(" ");
}

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal: catalanOrdinal,
    /**
     * Noun AFTER the numeral — Optimot's prenominal case, ordinal at any value. Masculine nouns only (see
     * AGREEMENT). `segle` is absent on purpose: it precedes its numeral, where the same source makes the
     * reading a cardinal.
     */
    ordinalAfter:
        /^(aniversari|centenari|congrés|congres|encontre|festival|campionat|certamen|concurs|premi|saló|salo|simposi|col·loqui|seminari|torneig|cicle|volum|capítol|capitol|cant|acte|article|batalló|regiment|govern)$/iu,
};
