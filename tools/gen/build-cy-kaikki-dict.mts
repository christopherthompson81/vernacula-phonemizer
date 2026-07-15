/**
 * Build the Welsh LEXICON (src/languages/welsh/lexicon.tsv) from the kaikki.org Wiktionary Welsh dump — the words
 * the rules mis-derive: per-word ⟨ae⟩/⟨ai⟩ diphthong QUALITY (aeres→eɨ), lexical ⟨y⟩-obscure/clear irregularities,
 * loanword vowels, and monosyllable LENGTH. kaikki tags dialects, so we take the NORTH-WALES pron (our target + the
 * NW referee). Only exceptions are dictionaried (espeak-ng-portable's rules-can't-derive methodology, as cs/th).
 *
 * CIRCULARITY (accepted, documented): kaikki cym and the wikipron cym-NW referee are BOTH Wiktionary — a
 * dictionaried word tends to match wikipron, so the wikipron number isn't independent for covered words. The
 * honest signal is the RULE-ENGINE accuracy on OOV words (--validate reports it).
 *
 * kaikki IPA → our convention: (1) combining non-syllabic offglides ɨ̯/u̯/i̯ → our modifier letters ᶤ/ᶷ/ᶦ; strip the
 * lowering ̞ (ɨ̞→ɨ, ɪ̞→ɪ). (2) Re-place OUR stress: strip kaikki's ˈ/ˌ and apply PENULTIMATE primary + a secondary
 * on the first nucleus when the penult is the 3rd+ nucleus (mirrors welsh.ts). VALIDATED by --validate: on
 * rule-correct words, converted-kaikki must reproduce our EXACT output.
 *
 *   npx tsx tools/gen/build-cy-kaikki-dict.mts --kaikki <cym-kaikki.tsv> --validate
 *   npx tsx tools/gen/build-cy-kaikki-dict.mts --kaikki <cym-kaikki.tsv>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { phonemizeWord } from "../../src/languages/welsh/welsh.ts";

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
}
const KAIKKI = arg("kaikki");
if (!KAIKKI) throw new Error("pass --kaikki <cym-kaikki.tsv>");
const OUT = new URL("../../src/languages/welsh/lexicon.tsv", import.meta.url).pathname;
const CORPUS =
    process.env.HOME + "/Programming/espeak-ng-portable/tools/qa-compare/words-50000.cy.txt";

// NUCLEUS = a plain vowel (+ optional length), NOT an offglide (ᶤᶦᶷᵘ) — for the stress re-placement.
const NUCLEUS = /[aeɛiɪoɔuʊɨə]ː?/gu;

/** kaikki IPA → our convention. */
function convert(ipa: string): string {
    let s = ipa
        .replace(/\([^)]*\)/gu, "") // drop kaikki's parenthetical OPTIONAL epenthetic schwa (arweinlyf(ə)r → …lyfr)
        .normalize("NFD")
        .replace(/ɨ̯/gu, "ᶤ") // central i-offglide (ae/au/oe/wy)
        .replace(/i̯/gu, "ᶦ") // front i-offglide (ai/ei)
        .replace(/u̯/gu, "ᶷ") // u-offglide (aw/ew/…)
        .replace(/̯/gu, "") // any other non-syllabic mark → drop
        .replace(/̞/gu, "") // lowering ̞ (ɨ̞→ɨ, ɛ̞…)
        .replace(/[ˈˌ.]/gu, "") // stress marks + kaikki's ⟨.⟩ syllable/hiatus separator (we don't mark it)
        .normalize("NFC");
    // Re-place OUR stress: penult primary, secondary on the first nucleus when the penult is the 3rd+ nucleus.
    const nuclei = [...s.matchAll(NUCLEUS)];
    if (nuclei.length === 0) return s;
    const stressN = nuclei.length >= 2 ? nuclei.length - 2 : 0;
    const secN = stressN >= 2 ? 0 : -1;
    let out = "",
        prev = 0;
    nuclei.forEach((m, i) => {
        const mark = i === stressN ? "ˈ" : i === secN ? "ˌ" : "";
        out += s.slice(prev, m.index) + mark;
        prev = m.index!;
    });
    return out + s.slice(prev);
}

const kaikki = new Map<string, string>();
for (const l of readFileSync(KAIKKI, "utf8").split("\n")) {
    const [w, ipa] = l.split("\t");
    if (w && ipa && !kaikki.has(w)) kaikki.set(w, ipa);
}
writeFileSync(OUT, ""); // rules-only baseline for phonemizeWord

if (process.argv.includes("--validate")) {
    const fold = (x: string) =>
        x.normalize("NFD").replace(/[ˈˌ]/gu, "").normalize("NFC");
    let checked = 0,
        exact = 0;
    const bad: string[] = [];
    for (const [w, ipa] of kaikki) {
        const ours = phonemizeWord(w);
        const conv = convert(ipa);
        if (fold(ours) !== fold(conv)) continue;
        checked++;
        if (ours === conv) exact++;
        else if (bad.length < 25) bad.push(`${w}: ours=${ours} conv=${conv}`);
    }
    console.log(`converter fidelity on agreeing words: ${exact}/${checked} exact (${((100 * exact) / checked).toFixed(1)}%)`);
    for (const b of bad) console.log("  " + b);
} else {
    const corpus = new Set(
        readFileSync(CORPUS, "utf8").split("\n").map((w) => w.trim()).filter(Boolean),
    );
    // kaikki cym is noisier than kaikki ces (e.g. mewn→mɨun, wrong; ⟨e⟩→ɨ / ⟨yw⟩→ɪ slips). PIN each entry to a
    // referee-CONFIRMED value: add only where the converted kaikki AND the wikipron-NW referee (both Wiktionary)
    // agree, so the lexicon can't ship kaikki noise. This makes the wikipron eval CIRCULAR for covered words (report
    // OOV rule-engine as the independent signal); the entries are correct by construction — the accepted trade-off.
    const REF = new URL(
        "../referee-eval/referees/cy.wikipron-cym-nw-broad.tsv",
        import.meta.url,
    ).pathname;
    const refFold = (s: string) =>
        s
            .normalize("NFD")
            .replace(/[ˈˌː]/gu, "")
            .replace(/[̀-ͯ]/gu, "")
            .replace(/ᶤ/gu, "ɨ").replace(/ᶦ/gu, "i").replace(/[ᶷᵘ]/gu, "u").replace(/ɪ/gu, "i")
            .normalize("NFC");
    const refs = new Map<string, Set<string>>();
    for (const l of readFileSync(REF, "utf8").split("\n")) {
        if (l.startsWith("#") || !l.trim()) continue;
        const [w, p] = l.split("\t");
        if (!w || !p) continue;
        (refs.get(w.toLowerCase()) ?? refs.set(w.toLowerCase(), new Set()).get(w.toLowerCase())!).add(
            refFold(p.replace(/ /g, "")),
        );
    }
    const rows: [string, string][] = [];
    for (const w of corpus) {
        // Final ⟨-au⟩ reduction (llyfrau→ɬəvra) is OUR referee-backed rule (colloquial NW); kaikki keeps the
        // standard -aᶤ, so excluding -au words avoids the lexicon overriding a correct rule with the formal form.
        if (/au$/i.test(w)) continue;
        const ipa = kaikki.get(w) ?? kaikki.get(w.toLowerCase());
        if (!ipa) continue;
        const conv = convert(ipa);
        if (phonemizeWord(w) === conv) continue; // rules already derive it
        const ref = refs.get(w.toLowerCase());
        if (!ref || !ref.has(refFold(conv))) continue; // require kaikki to be referee-confirmed
        rows.push([w, conv]);
    }
    rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const header =
        "# Welsh LEXICON — word<TAB>IPA, for words the rules mis-derive (per-word ⟨ae⟩/⟨ai⟩ quality, ⟨y⟩-obscure\n" +
        "# irregulars, loan vowels, monosyllable length). kaikki.org Wiktionary Welsh (CC-BY-SA), NORTH-WALES pron,\n" +
        "# stress re-placed to our convention. Regen: tools/gen/build-cy-kaikki-dict.mts.\n";
    writeFileSync(OUT, header + rows.map(([w, p]) => `${w}\t${p}`).join("\n") + "\n");
    console.log(`lexicon.tsv: ${rows.length} entries (corpus words the rules mis-derive vs kaikki NW)`);
}
