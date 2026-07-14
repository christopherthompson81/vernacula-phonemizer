/**
 * Independent validation of the Japanese counter subsystem (counters.ts: readCounter) against OpenJTalk — a
 * reading source INDEPENDENT of our JMdict-derived data, so it is not circular. For each `num\tcounter\treading`
 * line of the gold, compares our readCounter(num, counter) to OpenJTalk's kana, normalising away long-vowel
 * NOTATION (じゅう vs じゅー): both are routed through kanaToIpa, length marks dropped, and a doubled vowel unit
 * collapsed (d͡ʑɯᵝɯᵝ ≡ d͡ʑɯᵝː). Impossible combos (13月, 32日, 25時) are skipped — OpenJTalk emits garbage for them.
 *
 * GOLD (regenerate — needs pyopenjtalk, BSD; the counter readings are linguistic facts, ADR-0014):
 *   python3 - <<'PY' > ojt_counters.tsv
 *   import pyopenjtalk
 *   COUNTERS = "月時円年人日分本匹杯泊個回階軒歳冊足枚番度台名秒羽頭着丁"
 *   NUMS = list(range(1, 32)) + [40,50,60,70,80,90,100,200,300,400,500,600,700,800,900,1000,2000,3000,8000,10000]
 *   for c in COUNTERS:
 *       for n in NUMS:
 *           kata = pyopenjtalk.g2p(f"{n}{c}", kana=True)
 *           hira = ''.join(chr(ord(ch)-0x60) if 'ァ'<=ch<='ヶ' else ch for ch in kata)
 *           print(f"{n}\t{c}\t{hira}")
 *   PY
 * Usage: npx tsx tools/ja-counter-validate.mts <ojt_counters.tsv> [-v]
 */
import { readFileSync } from "node:fs";
import { readCounter } from "../src/languages/japanese/counters.ts";
import { kanaToIpa } from "../src/languages/japanese/kana.ts";

const gold = process.argv[2];
if (!gold) throw new Error("pass <ojt_counters.tsv> (see header to regenerate it)");

// Normalise long-vowel notation (じゅう vs じゅー): route both through kanaToIpa, drop length marks, then collapse a
// doubled vowel unit to one (so d͡ʑɯᵝɯᵝ ≡ d͡ʑɯᵝː). Vowel units are multi-codepoint (ɯᵝ, e̞, o̞), matched explicitly.
const VOWEL = "(ɯᵝ|e̞|o̞|[aioɯe])";
const norm = (kana: string): string => {
    let s = (kanaToIpa(kana) ?? kana).replace(/[ːー]/gu, "");
    for (let prev = ""; prev !== s; ) {
        prev = s;
        s = s.replace(new RegExp(VOWEL + "\\1", "gu"), "$1");
    }
    return s;
};

// valid ranges so OpenJTalk garbage for impossible combos doesn't deflate the score
const MAX: Record<string, number> = { 月: 12, 日: 31, 時: 24 };

let n = 0,
    ok = 0;
const bad: string[] = [];
for (const line of readFileSync(gold, "utf8").split("\n")) {
    const [numS, ctr, reading] = line.split("\t");
    if (!numS || !ctr || !reading) continue;
    const num = Number(numS);
    if (MAX[ctr] !== undefined && num > MAX[ctr]!) continue;
    const ours = readCounter(num, ctr);
    if (ours === null) continue;
    n++;
    if (norm(ours) === norm(reading)) ok++;
    else bad.push(`${num}${ctr}: ${ours} vs ${reading}`);
}
console.log(`counter readings vs OpenJTalk: ${ok}/${n} = ${((100 * ok) / n).toFixed(1)}%`);
if (process.argv[3] === "-v") for (const b of bad) console.log("  " + b);
