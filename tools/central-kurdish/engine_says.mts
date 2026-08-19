/** What the ckb rule engine currently says for each word — the other half of build_ckb_lexicon.py, split
 *  because the CLI/IO half is Python like every other builder here.
 *
 *  ⚠ RULES-ONLY, NOT `phonemizeWord`. The shipped path consults the very lexicon this builds, so calling it
 *  here would classify every existing entry as "already agrees" and rewrite the file EMPTY on the next run. */
import { phonemizeWordRules } from "../../src/languages/central-kurdish/central-kurdish.ts";
import { readFileSync, writeFileSync } from "node:fs";
const words = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as string[];
writeFileSync(process.argv[3]!, JSON.stringify(words.map((w) => phonemizeWordRules(w))));
