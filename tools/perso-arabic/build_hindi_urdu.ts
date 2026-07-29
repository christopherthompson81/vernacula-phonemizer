/**
 * Hindi→Urdu cross-script data source — the big Urdu scaling lever, from REAL parallel spellings.
 *
 * Hindi and Urdu are one language (Hindustani) in two scripts; Wiktionary (kaikki) records both, so a Hindi entry
 * (Devanagari, VOWELED) carries the actual Urdu spelling (Perso-Arabic, abjad) as a form. We take that real Urdu
 * spelling as the skeleton and the GOLD IPA from our Hindi g2p (Devanagari writes the vowels), then harmonize the
 * Hindi IPA to the Urdu convention (aː→ɑː). invert_harakat.ts then mines the Urdu harakat that reproduces it.
 * Unlike a synthetic transliteration (which sank the Punjabi cross-script), these are the spellings people use.
 *
 *   curl kaikki Hindi dump → /tmp/hi_kaikki.jsonl ; npx tsx build_hindi_urdu.ts
 * Output: silver.hindiurdu.tsv (skeleton ⇥ urd ⇥ ipa) — NEW words not already in wikipron.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPhonemizer } from "../../src/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DUMP = "/tmp/hi_kaikki.jsonl";
const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/gu;
const PERSO_ARABIC = /^[؀-ۿݐ-ݿ]+$/u;

/** Harmonize Hindi g2p IPA to the Urdu convention (they're the same language; the one systematic diff is long-a). */
function harmonize(ipa: string): string {
    return ipa.replace(/aː/gu, "ɑː");
}

function main(): void {
    if (!existsSync(DUMP)) { console.error(`missing ${DUMP} — download the kaikki Hindi dump first`); process.exit(1); }
    const hi = getPhonemizer("hi");

    const seen = new Set<string>();
    const rows: string[] = [];
    let entries = 0, withUrdu = 0;
    for (const line of readFileSync(DUMP, "utf8").split("\n")) {
        if (!line) continue;
        let d: { word?: string; forms?: { form?: string; tags?: string[] }[] };
        try { d = JSON.parse(line); } catch { continue; }
        entries++;
        const dev = d.word;
        if (!dev) continue;
        const urduForm = d.forms?.find((f) => f.tags?.includes("Urdu") && f.form && PERSO_ARABIC.test(f.form));
        if (!urduForm?.form) continue;
        withUrdu++;
        const skel = urduForm.form.normalize("NFC").replace(HARAKAT, "");
        // ALL Urdu-spelling words (dedup only) — this is a LEXICON/COVERAGE source (real spellings + gold IPA).
        if ([...skel].length < 2 || seen.has(skel)) continue;
        const ipa = harmonize(hi.text(dev).trim());
        if (!ipa) continue;
        seen.add(skel);
        rows.push(`${skel}\turd\t${ipa}`);
    }

    writeFileSync(join(HERE, "silver.hindiurdu.tsv"), rows.join("\n") + (rows.length ? "\n" : ""));
    console.log(`Hindi entries ${entries}, with Urdu spelling ${withUrdu} → ${rows.length} urd pairs (all Urdu-spelling words)`);
    console.log(`  wrote silver.hindiurdu.tsv`);
}

main();
