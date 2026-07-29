/**
 * Gurmukhi→Shahmukhi cross-script data source — the Punjabi scaling lever, from REAL parallel spellings (the
 * Hindi→Urdu method, ported to Punjabi's sister scripts).
 *
 * Punjabi is one language in two scripts: Gurmukhi (a fully-VOWELED abugida) and Shahmukhi (a vowel-dropping
 * abjad). Wiktionary (kaikki) records both, so a Gurmukhi entry carries the actual Shahmukhi spelling as a form.
 * We take that REAL Shahmukhi spelling as the key and the GOLD IPA from our Gurmukhi g2p (Gurmukhi writes the
 * short vowels, the majhūl و/ی distinction, AND ن vs retroflex ݨ — every axis the abjad drops). No IPA
 * harmonization is needed: Gurmukhi and Shahmukhi feed the SAME Punjabi engine, so their conventions are identical.
 * Unlike the earlier SYNTHETIC transliteration (crossscript_pa.ts, which sank on skeleton mismatch), these are the
 * spellings people actually use. A consonant-skeleton GATE drops mis-paired / bad-OCR forms.
 *
 *   curl kaikki Punjabi dump → /mnt/data/kaikki-Punjabi.jsonl ; npx tsx build_gurmukhi_shahmukhi.ts
 * Output: ../../src/languages/punjabi/crossscript.tsv (shahmukhi-word ⇥ gold-IPA) — shipped directly.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWordCore } from "../../src/languages/punjabi/punjabi.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DUMP = "/mnt/data/kaikki-Punjabi.jsonl";
// Diacritics ONLY (harakat + Quranic marks + tatweel) — explicit escapes so no base LETTER range is caught.
const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/gu;
const GURMUKHI = /[਀-੿]/u;
const PERSO_ARABIC = /[؀-ۿݐ-ݿ]/u;

const SHAHMUKHI_WORD = /^[؀-ۿݐ-ݿ]+$/u; // pure Perso-Arabic, single token (no spaces / Latin / digits)

/** Consonant skeleton of an IPA string — strip vowels, length, tone, stress, ties; fold retroflex→plain. Two
 *  spellings of the same word share this. Folding retroflex→plain is essential: Shahmukhi writes /ɳ/ with plain ن
 *  (→ our [n]) while the Gurmukhi partner has ਣ (→ [ɳ]) — that is the very ambiguity the cross-script FIXES, so the
 *  gate must not reject it; a real MISPAIR still differs in the plain consonants and is dropped. */
function consSkel(ipa: string): string {
    return ipa
        .normalize("NFD")
        .replace(/[əaɪiʊueɛoɔɐɑ]/gu, "")
        .replace(/[ˈˌːˑ˥˩˧˨˦̃̀͡-ͯ\s]/gu, "")
        .replace(/ɳ/gu, "n").replace(/ɭ/gu, "l").replace(/ʈ/gu, "t")
        .replace(/ɖ/gu, "d").replace(/ɽ/gu, "r")
        .normalize("NFC");
}

function main(): void {
    if (!existsSync(DUMP)) {
        console.error(`missing ${DUMP} — download the kaikki Punjabi dump first`);
        process.exit(1);
    }
    const seen = new Set<string>();
    const rows: string[] = [];
    let entries = 0,
        withShah = 0,
        kept = 0,
        gated = 0;
    for (const line of readFileSync(DUMP, "utf8").split("\n")) {
        if (!line) continue;
        let d: { word?: string; forms?: { form?: string }[] };
        try {
            d = JSON.parse(line);
        } catch {
            continue;
        }
        entries++;
        const gur = d.word;
        if (!gur || !GURMUKHI.test(gur)) continue;
        const shahForm = d.forms?.find(
            (f) => f.form && f.tags?.includes("Shahmukhi") && PERSO_ARABIC.test(f.form),
        );
        if (!shahForm?.form) continue;
        withShah++;
        const skel = shahForm.form.normalize("NFC").replace(HARAKAT, "").trim();
        if ([...skel].length < 2 || seen.has(skel) || !SHAHMUKHI_WORD.test(skel)) continue;
        const ipa = phonemizeWordCore(gur).trim(); // GOLD IPA from the voweled Gurmukhi
        if (!ipa) continue;
        // GATE: the Shahmukhi skeleton must describe the SAME consonantal word (only the abjad-dropped vowels differ).
        if (consSkel(phonemizeWordCore(skel)) !== consSkel(ipa)) {
            gated++;
            continue;
        }
        seen.add(skel);
        rows.push(`${skel}\t${ipa}`);
        kept++;
    }
    rows.sort();
    const header = [
        "# Punjabi CROSS-SCRIPT restoration lexicon — real Shahmukhi spelling ⇥ GOLD canonical IPA.",
        "# The IPA comes from the VOWELED Gurmukhi sister-spelling (kaikki dual-script pairs) via our Gurmukhi g2p,",
        "# so it restores the short vowels + majhūl و/ی + retroflex ن/ݨ the Shahmukhi abjad drops. CC-BY-SA (kaikki).",
        "# Consonant-skeleton gated. Regenerate: tools/perso-arabic/build_gurmukhi_shahmukhi.ts",
    ].join("\n");
    writeFileSync(
        join(HERE, "../../src/languages/punjabi/crossscript.tsv"),
        header + "\n" + rows.join("\n") + "\n",
    );
    console.log(
        `Gurmukhi entries ${entries}, with Shahmukhi form ${withShah} → kept ${kept} (gated out ${gated} skeleton-mismatches)`,
    );
    console.log(`  wrote src/languages/punjabi/crossscript.tsv`);
}

main();
