/**
 * Luxembourgish cardinal number → words. Units-FIRST and fused like German (eenanzwanzeg = 21, fënnefandrësseg =
 * 35), with magnitude groups juxtaposed rather than chained by a conjunction. The composition is the shared
 * units-first Germanic algorithm — see ../danish/unitsFirstNumbers.ts (housed in the Danish dir only because
 * src/core/ was locked during the number fan-out; it is language-neutral). Covers 0 … <10¹².
 *
 * What is Luxembourgish-SPECIFIC here is the EIFELER REGEL (n-deletion): the connector is written "an" before a
 * tens word beginning with ⟨n d t z h⟩ or a vowel, but "a" before any other consonant. Wikipedia's own numeral
 * examples are the proof pair — fënnefa̲n̲drësseg (35, before ⟨d⟩) vs fënnefa̲véierzeg (45, before ⟨v⟩).
 *
 * Source for the number words: see the cited provenance on the `numbers` block in luxembourgish.jsonc.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import { unitsFirstNumberToWords, type UnitsFirstDef } from "../danish/unitsFirstNumbers.ts";

// luxembourgish.ts holds its own narrow view of the manifest (digraphs/graphemes); this module reads only the
// `numbers` block, so it declares its own slice rather than importing from luxembourgish.ts (which imports THIS
// module — a shared manifest.ts would be the alternative, but lb has none).
interface LuxNumbersDef {
    numbers: {
        ones: string[];
        tens: string[];
        compoundOnes: string[];
        connector: string;
        hundred: { one: string; word: string };
        thousand: { one: string; word: string };
        million: { one: string; plural: string };
        billion: { one: string; plural: string };
    };
}
const N = loadManifest<LuxNumbersDef>(import.meta.url, "luxembourgish.jsonc").numbers;

// The EIFELER REGEL: a final ⟨n⟩ survives before ⟨n d t z h⟩ and before a vowel, and is deleted before every other
// consonant. ⟨u⟩ is listed as a vowel head for completeness even though no tens word begins with it.
const N_KEEPERS = new Set([..."ndtzh", ..."aeiouäëéèáâôûüy"]);

/**
 * The EIFELER REGEL as a text→text operation: a word-final ⟨n⟩ survives before ⟨n d t z h⟩ and before a
 * vowel, and is deleted before any other consonant. Before a PAUSE (nothing following) the ⟨n⟩ is kept.
 *
 * Exported because normalize.ts needs exactly the same rule for the words IT emits — the ordinal ending
 * (*vum éischte**n** Dag* but *am drëtte Joerhonnert*), the fraction numerator (*een Drëttel* but *ee
 * Fënneftel*) and the left operand of a range joined by *bis* (*siwe bis aacht*). One definition, three
 * callers, so the connector below and the ordinal ending can never drift apart.
 */
export function applyEifelerRegel(word: string, following: string): string {
    if (!word.endsWith("n")) return word;
    const c = following[0]?.toLowerCase();
    if (c === undefined) return word; // before a pause the ⟨n⟩ is retained
    return N_KEEPERS.has(c) ? word : word.slice(0, -1);
}

const DEF: UnitsFirstDef = {
    ones: N.ones,
    tens: N.tens,
    compoundOnes: N.compoundOnes,
    // "an" → "a" when the following tens word starts with a consonant outside the n/d/t/z/h set.
    connector: (_unit, tensWord) => applyEifelerRegel(N.connector, tensWord),
    hundred: N.hundred,
    thousand: N.thousand,
    million: N.million,
    billion: N.billion,
    mulJoin: "", // German-style closed compounds: zweehonnert, zwielefdausend
    hundredRemJoin: "", // dräihonnertfënnefavéierzeg
    groupJoin: " ", // magnitude groups are separate words: "zwielefdausend dräihonnert…"
};

/** Non-negative integer (< 10¹²) → Luxembourgish words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    return unitsFirstNumberToWords(n, DEF);
}
