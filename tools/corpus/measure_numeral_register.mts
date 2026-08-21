/**
 * SCORE A CANDIDATE NUMERAL REGISTER for one FLEURS language, against the phone recognizers.
 *
 * `numeral_register.mts` wires a register only where the audio says the readers use one, and every entry
 * there was established by exactly this measurement (investigation run 19). ⚠ THAT HARNESS DID NOT
 * SURVIVE, so scoring the next candidate — ha_ng, which run 19 never covered — meant rebuilding it. This
 * file exists so the third one does not.
 *
 *   npx tsx tools/corpus/measure_numeral_register.mts <fleurs_lang> <registry_code> <in.tsv> <out.tsv>
 *   npx tsx tools/corpus/measure_numeral_register.mts ha_ng ha /tmp/ha_num.tsv /tmp/ha_reg.tsv
 *
 * ⚠ INPUT IS `wav<TAB>text`, TWO COLUMNS — NOT the `lang<TAB>wav<TAB>text` that `rederive_read_text.mts`
 * takes. Feeding that shape here is silently accepted (`wav` becomes the lang, `text` becomes
 * "wav\ttext"), every row phonemizes, the output looks plausible, and the only symptom is that the
 * scorer matches zero rows. Build it with:
 *
 *   sqlite3 -separator $'\t' align.sqlite \
 *     "SELECT wav, text FROM utt WHERE lang='ha_ng' AND text GLOB '*[0-9]*' AND ipa IS NOT NULL
 *        AND phones IS NOT NULL AND phones_allo IS NOT NULL"
 *
 * Output is `wav<TAB>native<TAB>en<TAB>fr<TAB>pt`; score it with
 * `tools/corpus/asr-align/score_numeral_register.py`.
 *
 * ⚠ IT REPRODUCES THE SHIPPED PATH'S TEXT REPAIRS (`restoreInitialismCasing` → `restoreAbbreviationDots`
 * → `restoreNguniConcordAcronyms`), because `phonemize-fleurs.mts` applies them before the register and a
 * harness that skipped them would print medians the corpus would never show. The closer/further verdict
 * is near-immune — both columns get the same treatment — but the absolute numbers are quoted in the
 * register table, so they must be the real ones.
 *
 * ⚠ AND IT SCORES AGAINST BOTH RECOGNIZERS, where run 19 had only wav2vec2. That matters more here than
 * elsewhere: a register is a claim about WHICH LANGUAGE a span is in, and wav2vec2 is espeak-labelled, so
 * an English candidate scored against it alone is flattered.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { phonemizeAsync } from "../../src/index.ts";
import { restoreAbbreviationDots, restoreInitialismCasing, restoreNguniConcordAcronyms }
    from "./asr-align/initialism_casing.mts";
import { segmentsForRegister } from "./numeral_register.mts";

const CANDIDATES = ["en", "fr", "pt"] as const;

const [lang, code, inPath, outPath] = process.argv.slice(2);
if (!lang || !code || !inPath || !outPath) {
    console.error("usage: measure_numeral_register.mts <fleurs_lang> <registry_code> <in.tsv> <out.tsv>");
    console.error("       in.tsv is wav<TAB>text (two columns)");
    process.exit(2);
}

const rows = readFileSync(inPath, "utf8").split("\n").filter(Boolean);
const out: string[] = [];
const errs: string[] = [];
for (const line of rows) {
    const [wav, ...rest] = line.split("\t");
    const raw = rest.join("\t");
    // ⚠ PER-ROW try/catch AND AN ERRORS FILE, as `phonemize-fleurs.mts` does. Without it one throwing row
    // aborts the process after however many hundred are done and the output file is never written, so the
    // whole run is lost.
    try {
        const text = restoreNguniConcordAcronyms(
            restoreAbbreviationDots(restoreInitialismCasing(raw, lang), lang), lang);
        const cells = [wav!, await phonemizeAsync(text, code)];
        for (const reg of CANDIDATES) {
            const segs = segmentsForRegister(text, reg);
            const parts = await Promise.all(segs.map((s) => phonemizeAsync(s.text, s.lang ?? code)));
            cells.push(parts.filter(Boolean).join(" ").replace(/\s+/gu, " ").trim());
        }
        out.push(cells.join("\t"));
    } catch (e) {
        errs.push(`${wav}\t${(e as Error).message.replace(/[\r\n\t]+/gu, " ").slice(0, 160)}`);
    }
}
writeFileSync(outPath, out.join("\n"));
if (errs.length) writeFileSync(`${outPath}.errors.tsv`, errs.join("\n"));
console.error(`${lang}: ${out.length} rows scored (native, ${CANDIDATES.join(", ")})`
    + (errs.length ? `; ${errs.length} failed → ${outPath}.errors.tsv` : ""));
