/**
 * Build the Afrikaans SECONDARY referee from the RCRL Afrikaans Pronunciation Dictionary.
 *
 * af was single-source until this: the primary is en.wiktionary, and the "candidate 2nd referee" named in
 * `secondaryGap` for three PRs — wikipron afr_latn — turned out to be THE SAME en.wiktionary scrape (~2.1k rows,
 * matching the primary entry for entry). This one is genuinely independent: a speech-technology dictionary from the
 * Centre for Text Technology (NWU), with no Wiktionary lineage at all.
 *
 * Source: ttslab/za_lex `data/afr/` (van Niekerk, PRASA 2016/2017), which redistributes RCRL APD v1.4.1 in a flat
 * format plus the phone maps. CC BY-SA 2.5 ZA — share-alike, NOT NonCommercial, so it fences in the §3 stratum
 * (LICENSES/PROVENANCE.md) exactly like French's Lexique. Full provenance: referees/af.rcrl-apd.PROVENANCE.md.
 *
 * `pronundict.txt` is space-separated: WORD POS STRESS SYLLABLE-LENGTHS PHONE…
 *
 *     aaklige None 100 132 AA k l q x q
 *
 * STRESS is one digit per syllable over the alphabet 0/1/2 (1 = primary, 2 = secondary) and SYLLABLE-LENGTHS is the
 * phone count per syllable — verified to sum exactly to the phone count on all 27,428 rows, which is what lets this
 * emit ˈ, ˌ and syllable dots rather than a bare phone string. The hts phone alphabet is mapped to IPA by the dictionary's OWN `phonememap.ipa-hts.tsv`, so
 * the mapping is the publisher's, not ours.
 *
 * Run: `npx tsx tools/referee-eval/build-af-rcrl.ts`   (network; writes referees/af.rcrl-apd.tsv)
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://raw.githubusercontent.com/ttslab/za_lex/master/data/afr";
const HERE = dirname(fileURLToPath(import.meta.url));

/** Afrikaans orthography — letters + the diacritics the language writes, plus the internal apostrophe of ⟨'n⟩.
 *  ⚠ ⟨ö⟩ AND ⟨ä⟩ BELONG HERE. Omitting them silently dropped the whole DIAERESIS class the engine explicitly
 *  models (`diacriticVowels` maps ⟨ö⟩→[ø], and `vowelLetters` carries it): koördinasie, koördinate, koördineer,
 *  koördinering, koöperasies, koöperatief, koöpteer, geöriënteerde, kobraägtig, zebraägtig. Losing exactly the
 *  rows that exercise a modelled letter is the worst possible filter bug, so the class is derived from the
 *  language's own alphabet rather than typed out from memory. ⟨ò⟩ is included for the one row that uses it (nòg). */
const WORD_OK = /^['’a-zêôûîëïéèáàóúüöäòç-]+$/u;

async function get(file: string): Promise<string> {
    const r = await fetch(`${BASE}/${file}`);
    if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
    return r.text();
}

async function main(): Promise<void> {
    // The publisher's own phone map, read IPA→hts and inverted. Multi-character hts symbols (AA, qoeqy, hv, iq…)
    // are unambiguous because pronundict.txt is SPACE-separated — this is a token lookup, not a longest-match scan.
    const toIpa = new Map<string, string>();
    for (const line of (await get("phonememap.ipa-hts.tsv")).split("\n")) {
        const [ipa, hts] = line.split("\t");
        if (ipa && hts) toIpa.set(hts.trim(), ipa.trim());
    }

    const rows: string[] = [];
    // Counted separately, because the PROVENANCE sidecar makes a claim about WHICH filter dropped rows and a
    // single lumped counter could not support it.
    let skippedShort = 0, skippedOrthography = 0, skippedStructure = 0, skippedPhone = 0;
    const unknown = new Set<string>();
    for (const line of (await get("pronundict.txt")).split("\n")) {
        const f = line.trim().split(/\s+/u);
        if (f.length < 5) { skippedShort++; continue; }
        const [word, , stress, sylLens] = f as [string, string, string, string];
        const phones = f.slice(4);
        if (!WORD_OK.test(word)) { skippedOrthography++; continue; }
        // The two structure fields must agree with each other and with the phone count, or the row is not
        // syllabifiable and is dropped rather than guessed at.
        const lens = [...sylLens].map(Number);
        if (stress.length !== lens.length || lens.reduce((a, b) => a + b, 0) !== phones.length) { skippedStructure++; continue; }
        const ipa = phones.map((p) => toIpa.get(p));
        if (ipa.some((p) => p === undefined)) {
            phones.forEach((p, i) => { if (ipa[i] === undefined) unknown.add(p); });
            skippedPhone++;
            continue;
        }
        let at = 0;
        // ⚠ THE STRESS ALPHABET IS 0/1/2, NOT 0/1 — secondary stress is a real value in this source and
        // dropping it would quietly contradict both the TSV header and the sidecar, which advertise
        // reconstructed stress. Inert for today's eval (the backbone strips ˈ and ˌ alike), but Run 10 names
        // this file's stress fields as the next lever, so it is preserved rather than flattened.
        const MARK: Record<string, string> = { "1": "ˈ", "2": "ˌ" };
        const sylls = lens.map((n, i) => (MARK[stress[i]!] ?? "") + ipa.slice(at, (at += n)).join(""));
        rows.push(`${word}\t${sylls.join(".")}`);
    }

    const header = [
        "# Afrikaans (af) SECONDARY referee — RCRL Afrikaans Pronunciation Dictionary v1.4.1 (CTexT / North-West",
        "# University), via ttslab/za_lex data/afr (Multilingual Speech Technologies, NWU). CC BY-SA 2.5 ZA.",
        "# NON-WIKTIONARY, and that is the point: the primary (en.wiktionary) and wikipron afr are the same scrape.",
        "# Built by tools/referee-eval/build-af-rcrl.ts. IPA from the dictionary's own phonememap.ipa-hts.tsv;",
        "# ˈ and syllable dots reconstructed from its stress + syllable-length fields. Provenance sidecar:",
        "# af.rcrl-apd.PROVENANCE.md",
        `# ${rows.length} entries.`,
    ].join("\n");
    writeFileSync(join(HERE, "referees", "af.rcrl-apd.tsv"), `${header}\n${rows.join("\n")}\n`);
    console.log(
        `wrote ${rows.length} entries; skipped ${skippedShort} (short row), ${skippedOrthography} (orthography), ` +
        `${skippedStructure} (stress/syllable fields disagree), ${skippedPhone} (unmapped phone)`,
    );
    if (unknown.size) console.log(`unmapped phones: ${[...unknown].join(" ")}`);
}

void main();
