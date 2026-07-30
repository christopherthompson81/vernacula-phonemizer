/**
 * Thai (th) phonemizer — canonical IPA, espeak-independent (authored). Abugida g2p (g2p.ts) with computed tone;
 * words in the frequency corpus are pre-segmented. text() tokenizes Thai runs / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeWord } from "./g2p.ts";
import { normalizeThai, THAI_DIGIT_WORDS } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

export { phonemizeWord };

const TOKEN = /([฀-๿]+)|(\d+)|([.!?…,;:])/gu;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

// ── Numbers ──────────────────────────────────────────────────────────────────────────────────────────
// The tokenizer matched (\d+) but NO branch consumed it — every digit run in Thai text was silently
// dropped (23.4% of FLEURS th_th utterances contain digits; all lost their numbers). The compositor emits
// THAI-SCRIPT words (each kaikki-attested with IPA) and reads them through the ordinary g2p, so no IPA is
// authored here. Grammar: 20 is ยี่สิบ (not สองสิบ); a FINAL 1 in any compound ≥11 is เอ็ด (สิบเอ็ด,
// ยี่สิบเอ็ด); magnitudes 10⁴ หมื่น and 10⁵ แสน are their own words.
const TH_UNITS = THAI_DIGIT_WORDS;
const TH_MAG: [number, string][] = [[1e6, "ล้าน"], [1e5, "แสน"], [1e4, "หมื่น"], [1e3, "พัน"], [100, "ร้อย"]];

function numberToThaiWords(n: number): string[] {
    if (!Number.isSafeInteger(n) || n < 0) {
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9").map((d) => TH_UNITS[Number(d)]!);
    }
    if (n === 0) return [TH_UNITS[0]!];
    const out: string[] = [];
    let r = n;
    for (const [v, w] of TH_MAG) {
        if (r >= v) {
            const q = Math.floor(r / v);
            out.push(...numberToThaiWords(q), w);
            r %= v;
        }
    }
    if (r >= 10) {
        const t = Math.floor(r / 10);
        if (t === 2) out.push("ยี่สิบ");
        else if (t === 1) out.push("สิบ");
        else out.push(TH_UNITS[t]!, "สิบ");
        r %= 10;
        if (r === 1) { out.push("เอ็ด"); r = 0; } // final 1 after a ten is เอ็ด
    }
    if (r > 0) out.push(TH_UNITS[r]!);
    return out;
}

// #562 symbol normalization — Thai: เปอร์เซ็นต์ (kaikki-attested /pɤː˧.sen˧/), read by the Thai g2p.
const SYMBOLS = makeSymbolNormalizer({ percent: ["เปอร์เซ็นต์"] });

class ThaiPhonemizer implements Phonemizer {
    text(input: string): string {
        // SYMBOLS (%, the shared tier) runs FIRST: it needs the raw `80%`, which step 5/7 of
        // normalizeThai would otherwise have rewritten out from under it. normalizeThai then owns
        // everything Thai-script and Thai-specific — see normalize.ts for the ordered steps.
        return assembleClauses(normalizeThai(SYMBOLS(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberToThaiWords(Number(m[2]))) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}
export function createThai(): Phonemizer {
    return new ThaiPhonemizer();
}
