/**
 * Build the Czech LOANWORD lexicon (src/languages/czech/loanwords.tsv) from the kaikki.org Wiktionary Czech dump —
 * the words the native rules mis-derive, chiefly di/ti/ni NON-palatalization in loanwords (stadion→stadɪjon, not
 * the native staɟɪjon; studie, technik) + loanword long í + foreign names. The rules correctly palatalize NATIVE
 * di/ti/ni (tisíc→cɪsiːts), so ONLY the exceptions are dictionaried.
 *
 * CIRCULARITY (accepted, documented): kaikki ces and the wikipron ces referee are BOTH Wiktionary (separate
 * extractions), so a dictionaried word tends to match wikipron — the wikipron number is not fully independent for
 * covered words. The honest signal is the RULE-ENGINE accuracy on OOV words (--validate reports it).
 *
 * kaikki IPA → our convention: the ONLY systematic difference is stress placement — kaikki marks ˈ before the ONSET
 * (ˈstadɪjon), ours before the stressed VOWEL (stˈadɪjon). Czech stress is always word-initial, so: strip ˈ, insert
 * it before the first vowel. VALIDATED by --validate: on words the rules already get right, converted-kaikki must
 * reproduce our EXACT output.
 *
 *   npx tsx tools/gen/build-cs-kaikki-dict.mts --kaikki <ces-kaikki.tsv> --validate   # check converter fidelity
 *   npx tsx tools/gen/build-cs-kaikki-dict.mts --kaikki <ces-kaikki.tsv>              # write loanwords.tsv
 */
import { readFileSync, writeFileSync } from "node:fs";
import { phonemizeWord } from "../../src/languages/czech/czech.ts";

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
}
const KAIKKI = arg("kaikki");
if (!KAIKKI) throw new Error("pass --kaikki <ces-kaikki.tsv> (stream kaikki.org Czech → word<TAB>ipa)");
const OUT = new URL("../../src/languages/czech/loanwords.tsv", import.meta.url)
    .pathname;
const CORPUS =
    (process.env["ESPEAK_PORTABLE"] ?? ".") + "/tools/qa-compare/words-50000.cs.txt";

// A NUCLEUS: a vowel (+ optional length) or a syllabic r̩/l̩ (U+0329). Mirrors g2p's nucleus set + czech.ts stress.
const NUCLEUS = /[rl]̩|[aeɛiɪoɔuyəäö]ː?/gu;

/** kaikki IPA → our convention: strip kaikki's onset-ˈ and re-place OUR stress — ˈ before the first nucleus,
 *  ˌ before even non-final nuclei (republika→rˈɛpublˌɪka), matching czech.ts phonemizeWord. */
function convert(ipa: string): string {
    const bare = ipa.replace(/[ˈˌ]/gu, "");
    const nuclei = [...bare.matchAll(NUCLEUS)];
    if (nuclei.length === 0) return bare;
    const last = nuclei.length - 1;
    let out = "",
        prev = 0;
    nuclei.forEach((m, vi) => {
        const mark = vi === 0 ? "ˈ" : vi >= 2 && vi % 2 === 0 && vi !== last ? "ˌ" : "";
        out += bare.slice(prev, m.index) + mark;
        prev = m.index!;
    });
    return out + bare.slice(prev);
}

const kaikki = new Map<string, string>();
for (const l of readFileSync(KAIKKI, "utf8").split("\n")) {
    const [w, ipa] = l.split("\t");
    if (w && ipa && !kaikki.has(w)) kaikki.set(w, ipa);
}

// Empty the lexicon BEFORE the first phonemizeWord() so the engine runs RULES-ONLY (else the tool would see its
// own prior output as the rule baseline). The final lexicon is written at the end.
writeFileSync(OUT, "");

if (process.argv.includes("--validate")) {
    // On words the rules already reproduce (folded agreement), does converted-kaikki == our EXACT output?
    const fold = (s: string) =>
        s.normalize("NFD").replace(/[ˈˌ]/gu, "").normalize("NFC");
    let checked = 0,
        exact = 0;
    const bad: string[] = [];
    for (const [w, ipa] of kaikki) {
        const ours = phonemizeWord(w);
        const conv = convert(ipa);
        if (fold(ours) !== fold(conv)) continue;
        checked++;
        if (ours === conv) exact++;
        else if (bad.length < 20) bad.push(`${w}: ours=${ours} conv=${conv}`);
    }
    console.log(
        `converter fidelity on agreeing words: ${exact}/${checked} exact (${((100 * exact) / checked).toFixed(1)}%)`,
    );
    for (const b of bad) console.log("  " + b);
} else {
    // Dictionary the corpus words the rules mis-derive vs the (converted) kaikki pronunciation. Restrict to the
    // frequency corpus (running-text relevance) — loanwords/internationalisms are common there.
    const corpus = new Set(
        readFileSync(CORPUS, "utf8")
            .split("\n")
            .map((w) => w.trim())
            .filter(Boolean),
    );
    // Target ONLY the loanword de-palatalization class (+ its co-occurring vowel-length: stadium→staːdɪjum): add
    // kaikki when ours differs from it ONLY by our native palatalization ɟ/c/ɲ (kaikki d/t/n) and/or vowel length.
    // This EXCLUDES voicing (rozhodně z/s) and consonant-gemination (vyšší ʃʃ/ʃ) disagreements, where our rules may
    // be right or the reading is contested — dictionaring those would override correct rule output.
    const depal = (s: string) =>
        s.replace(/ɟ/gu, "d").replace(/c/gu, "t").replace(/ɲ/gu, "n").replace(/ː/gu, "");
    const rows: [string, string][] = [];
    for (const w of corpus) {
        const ipa = kaikki.get(w) ?? kaikki.get(w.toLowerCase());
        if (!ipa) continue;
        const conv = convert(ipa);
        const ours = phonemizeWord(w);
        if (ours === conv) continue; // rules already derive it
        if (depal(ours) !== depal(conv)) continue; // difference is NOT (de-palatalization / vowel length) → skip
        rows.push([w, conv]);
    }
    rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const header =
        "# Czech LOANWORD lexicon — word<TAB>IPA, for words the native rules mis-derive (di/ti/ni non-palatalization\n" +
        "# in loans: stadion, studie, technik; loanword long í; foreign names). kaikki.org Wiktionary Czech (CC-BY-SA),\n" +
        "# stress re-placed to our convention (ˈ before the stressed vowel). Regen: tools/gen/build-cs-kaikki-dict.mts.\n";
    writeFileSync(OUT, header + rows.map(([w, p]) => `${w}\t${p}`).join("\n") + "\n");
    console.log(`loanwords.tsv: ${rows.length} entries (corpus words the rules mis-derive vs kaikki)`);
}
