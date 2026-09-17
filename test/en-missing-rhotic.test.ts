/**
 * A WORD SPELLED WITH ⟨r⟩ AND NO RHOTIC PHONE AT ALL is almost always a dropped /r/, and a dropped /r/ is
 * one of the most audible defects a GenAm lexicon can carry.
 *
 * Found by diagnosing the dict-vs-gold audit's `+R` bucket (#1334 follow-up): `housewarming` was
 * `hˈaᶷswɔːmɪŋ`, `marjoram` `mˈɑːd͡ʒɚəm`, `backstreet` `bˈækstˌiːt`, `forgings` `fˈɔːd͡ʒɪŋz`, `kardashian`
 * `kʰˈɑːd̬əʃˌeᶦn`. 30 rows repaired — 8 confirmed by misaki gold, the rest by the spelling, which fixes the
 * insertion point exactly (the ⟨r⟩ says where the phone goes).
 *
 * ⚠ THE TEST IS WRITTEN AS AN ALLOW-LIST, NOT A COUNT, because the exceptions are principled and each one
 * names a real orthographic rule. A new r-less row is a defect until someone argues it into this list.
 *
 * ⚠ AND THE `+R` BUCKET WAS NOT ALL DEFECTS — 20 of its rows were gold writing a GEMINATE `ɹɹ`
 * (`irrelevant` ɪɹɹˈɛləvənt, `irrevocable`, `forerunner`). English has no geminate consonants; our single
 * `ɹ` is right and gold is wrong there. Those were refused, which is why this test is about ZERO rhotics
 * rather than about counting ⟨r⟩ against /r/.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DICT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "languages", "english", "g2p-dict.tsv");

/** Every row allowed to be spelled with ⟨r⟩ and carry no rhotic, with the rule that licenses it. */
const SILENT_R = new Map<string, string>([
    // French ⟨-ier⟩ is /jeɪ/ — the r is not pronounced in the English reading of the name either.
    ["bouvier", "French -ier"], ["dossier", "French -ier"], ["dossiers", "French -ier"],
    ["gaudier", "French -ier"], ["gaultier", "French -ier"], ["liotier", "French -ier"],
    ["olivier", "French -ier"], ["touvier", "French -ier"], ["boucher", "French -er"],
    // Polish ⟨rz⟩ is a single fricative /ʒ/ (or /ʂ/), never a rhotic plus anything.
    ["andrzejewski", "Polish rz = /ʒ/"], ["biedrzycki", "Polish rz = /ʒ/"], ["drzewiecki", "Polish rz = /ʒ/"],
    // French loans whose English reading drops the /r/ of the onset cluster.
    ["croissant", "French, /kwɑː-/ attested in English"], ["croissants", "French, /kwɑː-/ attested"],
    ["trois", "French /twɑː/"],
    // An abbreviation whose EXPANSION has no r: Mrs = "missus".
    ["mrs", "abbreviation gloss — 'missus'"],
]);

describe("no dropped /r/ in the English dictionary", () => {
    test("a word spelled with ⟨r⟩ has a rhotic phone, unless a documented rule says otherwise", () => {
        const offenders: string[] = [];
        for (const l of readFileSync(DICT, "utf8").split("\n")) {
            if (l.startsWith("#") || !l.includes("\t")) continue;
            const [w, ph] = l.split("\t");
            if (!w!.includes("r")) continue;
            const phones = ph!.split(" ");
            if (phones.some((p) => p === "R" || p.replace(/[0-2]$/u, "") === "ER")) continue;
            if (SILENT_R.has(w!)) continue;
            offenders.push(`${w}: ${ph}`);
        }
        expect(offenders).toEqual([]);
    });

    // ⚠ AND THE ALLOW-LIST MUST NOT ROT: a name that later gains an /r/ should leave this list rather than
    // sit here licensing nothing, which is how the curation waivers in #1334 grew without anyone noticing.
    test("every allow-listed word is still r-less in the dict", () => {
        const rows = new Map<string, string[]>();
        for (const l of readFileSync(DICT, "utf8").split("\n")) {
            if (l.startsWith("#") || !l.includes("\t")) continue;
            const [w, ph] = l.split("\t");
            rows.set(w!, ph!.split(" "));
        }
        const stale: string[] = [];
        for (const w of SILENT_R.keys()) {
            const ph = rows.get(w);
            if (!ph) { stale.push(`${w} (no longer in the dict)`); continue; }
            if (ph.some((p) => p === "R" || p.replace(/[0-2]$/u, "") === "ER")) stale.push(`${w} (now has a rhotic)`);
        }
        expect(stale).toEqual([]);
    });
});
