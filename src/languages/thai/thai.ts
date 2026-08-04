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
//
// CURRENCY (#584). `$5` read as bare *hˈaː˥˩*. th_th contains ZERO `$` against 39 `%`, so the corpus-driven
// gate that caught the percent could not see this — yet all four words are in that same corpus, spelled out
// and immediately after a numeral, which is the slot the tier emits into:
//
//   ดอลลาร์ ×28  "ธนบัตรใหม่ชนิดราคา 5 และ 100 ดอลลาร์แคนาดา"
//   ปอนด์   ×14  "ที่ใช้อย่างเป็นทางการในฟอล์กแลนด์คือปอนด์ฟอล์กแลนด์ (FKP)"
//   เยน     ×6   "ราคาตั้งแต่ 2,500 เยน ไปจนถึง 130,000 เยน"
//   ยูโร    ×3   "ทำรายได้มากกว่า 10 พันล้านยูโร (14.7 พันล้านดอลลาร์สหรัฐ"
//
// One form each: Thai nouns do not inflect for number. Counted by SUBSTRING and that is correct here — Thai
// is written without spaces, so there is no token boundary to test and the examples are the evidence (#586).
//
// `unspacedScript` for the same reason: a currency sign in Thai is normally flanked by Thai letters, and the
// tier's letter-boundary guard would reject exactly that ordinary case — `$5ของ` dropped the sign while `$5`
// alone read it.
const SYMBOLS = makeSymbolNormalizer({
    // #586 — `&` was DROPPED outright, losing the sign from `ที่พักประเภท B&B`. `และ` is the ordinary
    // conjunction and the corpus's own word, ×1711 — the most frequent candidate by a wide margin (`กับ`
    // ×674 is "with", and `แอนด์`, the transliterated English "and", is ×0 here).
    // ★ THE STRONGEST EVIDENCE IS IN THE SENTENCE ITSELF: the corpus GLOSSES the abbreviation using this very
    // word — `ที่พักประเภท B&B แข่งขันกันในสองสิ่งเป็นหลัก คือ ที่นอนและอาหารเช้า` ("bed AND breakfast").
    // The text states what the sign expands to, in the same breath, with the conjunction chosen here.
    ampersand: "และ",
    percent: ["เปอร์เซ็นต์"],
    // #586 — `5 km` read as *hˈaː˥˩ ˈʊkm*: no unit was declared. Verified in th_th, each immediately after a
    // numeral: กิโลเมตร ×25 "ห่างจากบัวโนสไอเรส 50 กิโลเมตร", เมตร ×46 "ยอดเขาวินสันสูง 4,892 เมตร",
    // เซนติเมตร ×1 "อยู่ห่างกันเพียง 69 เซนติเมตร". มิลลิเมตร and กิโลกรัม are ×0 and stay undeclared.
    units: { km: ["กิโลเมตร"], m: ["เมตร"], cm: ["เซนติเมตร"] },
    currency: { $: ["ดอลลาร์"], "€": ["ยูโร"], "£": ["ปอนด์"], "¥": ["เยน"] },
    // `ตารางกิโลเมตร` ×5 and `ลูกบาศก์เมตร` ×1.
    // ⚠ Bare ตาราง substring-matches ×11 and its first instance is `ตารางธาตุ` — the periodic TABLE, which
    // is what ตาราง means on its own. In an unspaced script the bare count cannot be a token count at all
    // (trap 19), so only the full compound is evidence.
    // `before` RATHER THAN `compound`, against the orthography, because the fused form is MIS-SYLLABIFIED by
    // this G2P and the spaced one is not:
    //   5 ตารางกิโลเมตร  → …mˌeː˧to˧n      5 ตาราง กิโลเมตร  → …mˌeː˦˥t   (= bare กิโลเมตร)
    //   5 ลูกบาศก์เมตร   → lˈuːkbaː˧sˌa˨˩meː…   spaced → lˈuːkbaː˨˩t mˈeː˦˥t
    // The second is the clearer one: ลูกบาศก์ ends in a KARAN (ก์, a silencing mark) and only the spaced
    // reading honours it. This is not a defect introduced by the choice — the corpus's own
    // `2.2 ล้านตารางกิโลเมตรภายใน` already reads mˌeː˧to˧n as written, so the Thai compound path is broken
    // independently and is recorded as such. The space is an intermediate-representation hint to the G2P,
    // never output, so taking the correct reading costs nothing here.
    exponentWords: { squared: ["ตาราง"], cubed: ["ลูกบาศก์"], position: "before" },
    unspacedScript: true,
});

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
