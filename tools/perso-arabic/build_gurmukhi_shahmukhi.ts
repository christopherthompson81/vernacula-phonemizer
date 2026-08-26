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
 *   curl kaikki Punjabi dump → $DUMPS/kaikki-Punjabi.jsonl ; npx tsx build_gurmukhi_shahmukhi.ts
 * Output: ../../data/languages/punjabi/crossscript.tsv (shahmukhi-word ⇥ gold-IPA) — shipped directly.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWordCore } from "../../src/languages/punjabi/punjabi.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DUMP = (process.env["DUMPS"] ?? ".") + "/kaikki-Punjabi.jsonl";
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
        let d: { word?: string; forms?: { form?: string; tags?: string[] }[] };
        try {
            d = JSON.parse(line);
        } catch {
            continue;
        }
        entries++;
        // BOTH DIRECTIONS: a pair may be recorded as a GURMUKHI headword carrying a Shahmukhi form, or as a
        // SHAHMUKHI headword carrying a Gurmukhi form — Wiktionary does both, and reading only the first
        // direction left ~1,500 real pairs on the table (4,327 of 5,868 seen; found sizing the fresh dump).
        let gur: string | undefined;
        let shah: string | undefined;
        if (d.word && GURMUKHI.test(d.word)) {
            gur = d.word;
            shah = d.forms?.find((f) => f.form && f.tags?.includes("Shahmukhi") && PERSO_ARABIC.test(f.form))?.form;
        } else if (d.word && PERSO_ARABIC.test(d.word)) {
            shah = d.word;
            gur = d.forms?.find((f) => f.form && f.form.length > 1 && GURMUKHI.test(f.form))?.form;
        }
        if (!gur || !shah) continue;
        const shahForm = { form: shah };
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
    // OPTIONAL SECOND SOURCE: pa↔pnb Wikipedia TITLE pairs (Wikidata sitelinks, $DUMPS/pa-pnb-titles.tsv —
    // 18,930 articles live on both wikis). A title pair names the same TOPIC, not necessarily the same words
    // (ਮਹਾਤਮਾ ਗਾਂਧੀ ↔ موہن داس گاندھی is Mahatma vs Mohandas), so titles are word-aligned POSITIONALLY only
    // when token counts match, and every word pair must clear the SAME consonant-skeleton gate as a kaikki
    // pair — a topic-synonym or re-worded title differs in its plain consonants and is dropped.
    const TITLES = (process.env["DUMPS"] ?? ".") + "/pa-pnb-titles.tsv";
    let tSeen = 0, tKept = 0;
    if (existsSync(TITLES)) {
        for (const line of readFileSync(TITLES, "utf8").split("\n")) {
            const m = /^"(.+)"@pa\t"(.+)"@pnb$/u.exec(line.trim());
            if (!m) continue;
            const gw = m[1]!.split(/[\s\u2010-\u2015-]+/u).filter((t) => /^[਀-੿]+$/u.test(t));
            const sw = m[2]!.split(/[\s\u2010-\u2015-]+/u).filter((t) => PERSO_ARABIC.test(t));
            if (gw.length === 0 || gw.length !== sw.length) continue;
            for (let k = 0; k < gw.length; k++) {
                tSeen++;
                const skel = sw[k]!.normalize("NFC").replace(HARAKAT, "").trim();
                if ([...skel].length < 2 || seen.has(skel) || !SHAHMUKHI_WORD.test(skel)) continue;
                const ipa = phonemizeWordCore(gw[k]!).trim();
                if (!ipa) continue;
                if (consSkel(phonemizeWordCore(skel)) !== consSkel(ipa)) { gated++; continue; }
                seen.add(skel);
                rows.push(`${skel}\t${ipa}`);
                tKept++;
            }
        }
        console.log(`titles: ${tSeen} aligned word pairs → kept ${tKept}`);
    }
    rows.sort();
    const header = [
        "# Punjabi CROSS-SCRIPT restoration lexicon — real Shahmukhi spelling ⇥ GOLD canonical IPA.",
        "# The IPA comes from the VOWELED Gurmukhi sister-spelling (kaikki dual-script pairs) via our Gurmukhi g2p,",
        "# so it restores the short vowels + majhūl و/ی + retroflex ن/ݨ the Shahmukhi abjad drops. CC-BY-SA (kaikki).",
        "# SECOND SOURCE: pa↔pnb Wikipedia TITLE pairs (Wikidata sitelinks; 18,930 dual-wiki articles), word-aligned",
        "# positionally when token counts match — every pair clears the same skeleton gate (a re-worded title",
        "# differs in its plain consonants and is dropped: ਮਹਾਤਮਾ/موہن). Titles are CC-BY-SA like the rest.",
        "# Consonant-skeleton gated. Regenerate: tools/perso-arabic/build_gurmukhi_shahmukhi.ts",
    ].join("\n");
    writeFileSync(
        join(HERE, "../../data/languages/punjabi/crossscript.tsv"),
        header + "\n" + rows.join("\n") + "\n",
    );
    console.log(
        `Gurmukhi entries ${entries}, with Shahmukhi form ${withShah} → kept ${kept} (gated out ${gated} skeleton-mismatches)`,
    );
    console.log(`  wrote data/languages/punjabi/crossscript.tsv`);
}

main();
