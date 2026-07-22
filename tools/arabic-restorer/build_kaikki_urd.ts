/**
 * Extract an INDEPENDENT Urdu short-vowel source from the kaikki Urdu (Wiktionary) dump. Urdu Wiktionary gives human
 * Urdu IPA with the correct Arabic-template short vowels (امام ɪmɑːm, اسلام ɪslɑːm) — independent of wikipron, so it
 * both fills coverage and cross-validates wikipron (Run 7: 98% agreement). Small (~885 skeletons) but high quality.
 *   curl -sL https://kaikki.org/dictionary/Urdu/kaikki.org-dictionary-Urdu.jsonl -o /tmp/ur_kaikki.jsonl
 *   npx tsx tools/arabic-restorer/build_kaikki_urd.ts   # → silver.kaikki-urd.tsv (skeleton ⇥ urd ⇥ ipa)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { stripHarakat } from "../../src/core/harakatLexicon.ts";

const DUMP = "/tmp/ur_kaikki.jsonl";
const OUT = `${import.meta.dirname}/silver.kaikki-urd.tsv`;

/** Clean a kaikki IPA string to our canonical convention: drop slashes/brackets/parens/syllable-dots/stress/ties,
 *  the superscript-schwa & non-syllabic marks, and map near-variants (r→ɾ, w→ʋ, ʕ→ʔ, ä→ɑ, ɐ→ə). */
function clean(ipa: string): string {
    return ipa
        .replace(/[/[\]()‿ˈˌˑ.\-]/gu, "")
        .replace(/[ᵊ̯̤]/gu, "")
        .replace(/r/gu, "ɾ").replace(/w/gu, "ʋ").replace(/ʕ/gu, "ʔ").replace(/ä/gu, "ɑ").replace(/ɐ/gu, "ə")
        .normalize("NFC");
}

if (!existsSync(DUMP)) { console.error(`missing ${DUMP} — fetch the kaikki Urdu dump first`); process.exit(1); }

// skeleton → count of each cleaned IPA (pick the most frequent reading per skeleton)
const byskel = new Map<string, Map<string, number>>();
for (const line of readFileSync(DUMP, "utf8").split("\n")) {
    if (!line) continue;
    let d: { word?: string; sounds?: { ipa?: string }[] };
    try { d = JSON.parse(line); } catch { continue; }
    const word = (d.word ?? "").normalize("NFC");
    if (/\s/u.test(word) || !d.sounds) continue; // single words only (skip multi-word phrase entries)
    const skel = stripHarakat(word);
    if ([...skel].length < 2) continue;
    for (const s of d.sounds) {
        if (!s.ipa) continue;
        const ipa = clean(s.ipa);
        if (!ipa || /\s/u.test(ipa)) continue; // skip phrase pronunciations
        const m = byskel.get(skel) ?? byskel.set(skel, new Map()).get(skel)!;
        m.set(ipa, (m.get(ipa) ?? 0) + 1);
    }
}

const rows: string[] = [];
for (const [skel, m] of byskel) {
    const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    rows.push(`${skel}\turd\t${best}`);
}
rows.sort();
writeFileSync(OUT, rows.join("\n") + (rows.length ? "\n" : ""));
process.stderr.write(`wrote ${rows.length} kaikki-urd (skeleton, IPA) pairs → silver.kaikki-urd.tsv\n`);
