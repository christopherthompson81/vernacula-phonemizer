/**
 * Bavarian cardinal number → words. Units-FIRST and fused like German, but with the connector reduced from ⟨und⟩ to
 * a bare linking ⟨-a-⟩: oanazwånzg = 21, fimfazwånzg = 25, dreihundadfimfafiazg = 345. The composition is the
 * shared units-first Germanic algorithm — see ../danish/unitsFirstNumbers.ts (housed in the Danish dir only because
 * src/core/ was locked during the number fan-out; it is language-neutral). Covers 0 … <10¹².
 *
 * Source for the number words + the spelling-variant choices made: see the cited provenance on the `numbers` block
 * in bavarian.jsonc (Bavarian has no codified orthography, so every numeral had 2–4 attested spellings).
 */
import { loadManifest } from "../../core/loadManifest.ts";
import { unitsFirstNumberToWords, type UnitsFirstDef } from "../danish/unitsFirstNumbers.ts";

// bavarian.ts holds its own narrow view of the manifest (digraphs/graphemes); this module reads only the `numbers`
// block, so it declares its own slice rather than importing from bavarian.ts (which imports THIS module).
interface BarNumbersDef {
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
const N = loadManifest<BarNumbersDef>(import.meta.url, "bavarian.jsonc").numbers;

const DEF: UnitsFirstDef = {
    ones: N.ones,
    tens: N.tens,
    compoundOnes: N.compoundOnes,
    connector: () => N.connector, // the reduced linker ⟨-a-⟩ — invariant
    hundred: N.hundred,
    thousand: N.thousand,
    million: N.million,
    billion: N.billion,
    // Bavarian has no codified orthography, so the multi-word spelling ("drei hundad fimfafiazg") is chosen over the
    // German-style closed one ("dreihundadfimfafiazg"). Two reasons: nothing standardises the closed form here, and
    // the closed form walks straight into a compound-boundary artifact — Bavarian's post-vocalic ⟨h⟩ is a silent
    // length marker, so *dreihundad scans as [d̥rɑɛ̯undɑd̥] with the ⟨h⟩ of hundad swallowed. Only 21–99 stays fused
    // (oanazwånzg), which is where the source's own spellings are unambiguous.
    mulJoin: " ",
    hundredRemJoin: " ",
    groupJoin: " ",
};

/** Non-negative integer (< 10¹²) → Bavarian words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    return unitsFirstNumberToWords(n, DEF, raw);
}
