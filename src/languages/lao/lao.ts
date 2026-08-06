/**
 * Lao (lo) phonemizer — canonical IPA (authored). Lao is a Brahmic ABUGIDA, a sibling of Thai
 * but with a MORE PHONEMIC orthography (the Lao-PDR reforms stripped most Indic etymological spelling), so a leaner
 * rule g2p suffices — no Sanskrit-reading dictionary. Like Thai: leading vowels (ເ ແ ໂ ໃ ໄ) are written BEFORE the
 * consonant and reordered; the vowel is a (often discontinuous) pattern of signs around the onset; tone is computed
 * from consonant CLASS × live/dead × length × tone mark. Tones are Chao contour letters (stripped by the eval
 * backbone).
 */
import { foldNativeDigits } from "../../core/unicode.ts";
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";

type Cls = "high" | "mid" | "low";

// Onset consonant → [IPA, tonal class]. ຫ/ຮ = h; ອ = glottal ʔ; ວ onset = w. The ຫ-led sonorants (ໜ ໝ, ຫຼ ຫງ …)
// become HIGH class — handled in the scanner.
const CONS: Record<string, [string, Cls]> = {
    ກ: ["k", "mid"], ຂ: ["kʰ", "high"], ຄ: ["kʰ", "low"], ງ: ["ŋ", "low"],
    ຈ: ["t͡ɕ", "mid"], ສ: ["s", "high"], ຊ: ["s", "low"], ຍ: ["ɲ", "low"],
    ດ: ["d", "mid"], ຕ: ["t", "mid"], ຖ: ["tʰ", "high"], ທ: ["tʰ", "low"],
    ນ: ["n", "low"], ບ: ["b", "mid"], ປ: ["p", "mid"], ຜ: ["pʰ", "high"],
    ຝ: ["f", "high"], ພ: ["pʰ", "low"], ຟ: ["f", "low"], ມ: ["m", "low"],
    ຢ: ["j", "mid"], ຣ: ["l", "low"], ລ: ["l", "low"], ວ: ["ʋ", "low"],
    ຫ: ["h", "high"], ອ: ["ʔ", "mid"], ຮ: ["h", "low"],
    ໜ: ["n", "high"], ໝ: ["m", "high"], // precomposed ຫນ/ຫມ
};
// Final (coda) consonant → IPA. Lao has the 8-way final set (stops unreleased; sonorants + glides).
const CODA: Record<string, string> = {
    ກ: "k̚", ດ: "t̚", ບ: "p̚", ງ: "ŋ", ນ: "n", ມ: "m", ຍ: "j", ວ: "w",
};

// Vowel signs (combining/spacing) used by the scanner.
const LEAD = new Set(["ເ", "ແ", "ໂ", "ໃ", "ໄ"]); // written before the consonant
const HSON = new Set(["ງ", "ຍ", "ນ", "ມ", "ລ", "ວ"]); // the sonorants ຫ leads → HIGH class (ຫ + others is NOT a lead)
const TONEMARK = new Set(["່", "້", "໊", "໋"]);
const isCons = (c: string): boolean => c in CONS;

/** Reorder a leading vowel (ເ ແ ໂ ໃ ໄ) to AFTER its consonant (cluster): ເມ → ມເ, so the scanner reads L→R. */
function reorder(w: string): string {
    const s = [...w.normalize("NFC")];
    const out: string[] = [];
    for (let i = 0; i < s.length; i++) {
        if (LEAD.has(s[i]!) && isCons(s[i + 1] ?? "")) {
            // move the lead vowel past the consonant (+ a ຫ/ວ/ຼ cluster member)
            let j = i + 1;
            let cons = s[j++]!;
            // carry a ຫ-led cluster member across the reorder, incl. the ຼ lam-ligature (U+0EBC, not a base
            // consonant) so ເຫຼັກ → ຫຼ|ເັກ keeps ຫຼ together → [l] HIGH (else the lead vowel splits the ligature).
            // NOT ວ: after a lead vowel ວ is the onset itself (ເວລາ → ʋeː.laː), it must not swallow the next
            // consonant. ຫ leads ONLY a sonorant/ຼ (ເຫດ = ຫ onset + ດ coda → heːt̚, NOT a ຫດ lead).
            if (cons === "ຫ" && (HSON.has(s[j] ?? "") || s[j] === "ຼ")) cons += s[j++]!;
            out.push(cons, s[i]!);
            i = j - 1;
        } else out.push(s[i]!);
    }
    return out.join("");
}

interface Syl {
    onset: string; // IPA
    cls: Cls;
    quality: string; // vowel IPA (no length)
    long: boolean;
    glide: string; // diphthong offglide or vowel-derived coda (j/w/m)
    coda: string; // IPA coda
    mark: string; // tone mark char
    live: boolean;
}

// After reorder, resolve the vowel PATTERN around a consonant. Returns [quality, long, glide, consumedTail].
// `pre` = a leading vowel now sitting AFTER the consonant (ເ ແ ໂ ໄ ໃ), `signs` = the following sign string.
// This is the crux of Lao g2p; extended iteratively against the kaikki referee.
function resolveVowel(
    pre: string,
    after: string[],
): { q: string; long: boolean; glide: string; used: number } | null {
    const a0 = after[0] ?? "", a1 = after[1] ?? "";
    const two = a0 + a1;
    // helper
    const R = (q: string, long: boolean, glide: string, used: number) => ({ q, long, glide, used });
    // ---- LEADING-vowel patterns (pre set) ----
    if (pre === "ໄ" || pre === "ໃ") return R("a", false, "j", 0); // ໄC/ໃC → aj
    if (pre === "ເ") {
        if (a0 === "ົ" && a1 === "າ") return R("a", false, "w", 2); // ເົາ → aw
        if (a0 === "ຶ" && (a1 === "ອ" || true)) return R("ɯːə", false, "", a1 === "ອ" ? 2 : 1); // ເຶອ → ɯə
        if (a0 === "ື" && a1 === "ອ") return R("ɯːə", false, "", 2); // ເືອ → ɯːə
        if (a0 === "ຍ") return R("iːə", false, "", 1); // ເ...ຍ → iːə
        if (a0 === "ິ") return R("ɤ", false, "", 1); // ເິ → ɤ
        if (a0 === "ີ") return R("ɤ", true, "", 1); // ເີ → ɤː
        if (a0 === "າ" && a1 === "ະ") return R("ɔ", false, "", 2); // ເາະ → ɔ
        if (a0 === "ະ") return R("e", false, "", 1); // ເ...ະ → e
        if (a0 === "ັ" && (a1 === "ຽ" || a1 === "ຍ")) return R("iːə", false, "", 2); // ເ◌ັຽ/ເ◌ັຍ → iːə (ເຊັຽ→siːə)
        if (a0 === "ັ") return R("e", false, "", 1); // ເັC → e (closed short)
        return R("e", true, "", 0); // ເ → eː
    }
    if (pre === "ແ") {
        if (a0 === "ະ") return R("ɛ", false, "", 1);
        if (a0 === "ັ") return R("ɛ", false, "", 1);
        return R("ɛ", true, "", 0); // ແ → ɛː
    }
    if (pre === "ໂ") {
        if (a0 === "ະ") return R("o", false, "", 1);
        if (a0 === "ັ") return R("o", false, "", 1);
        return R("o", true, "", 0); // ໂ → oː
    }
    // ---- NON-leading (signs after / above / below the consonant) ----
    if (a0 === "ວ" && a1 === "າ") return R("uːə", false, "", 2); // ວາ → uːə (ຄວາຍ→kʰuːəj), NOT a kʷ cluster
    if (two === "ົວ") return R("uːə", false, "", 2); // ົວ → uːə
    if (a0 === "ົ" && a1 === "ະ") return R("o", false, "", 2); // ົະ (rare)
    if (a0 === "ັ") return R("a", false, "", 1); // ັC → a (closed short "mai kan")
    if (a0 === "ົ") return R("o", false, "", 1); // ົC → o (closed short "mai kong")
    if (a0 === "ະ") return R("a", false, "", 1); // ະ → a
    if (a0 === "າ" && a1 === "ະ") return R("a", false, "", 2);
    if (a0 === "າ") return R("a", true, "", 1); // າ → aː
    if (a0 === "ຳ") return R("a", false, "m", 1); // ຳ → am
    if (a0 === "ິ") return R("i", false, "", 1);
    if (a0 === "ີ") return R("i", true, "", 1);
    if (a0 === "ຶ") return R("ɯ", false, "", 1);
    if (a0 === "ື") return R("ɯ", true, "", 1);
    if (a0 === "ຸ") return R("u", false, "", 1);
    if (a0 === "ູ") return R("u", true, "", 1);
    if (a0 === "ໍ") return R("ɔ", true, "", 1); // ໍ → ɔː
    if (a0 === "ຽ") return R("iːə", false, "", 1); // ຽ → iːə
    if (a0 === "ອ") return R("ɔ", true, "", 1); // C + ອ → ɔː (ອ as vowel)
    if (a0 === "ວ") return R("uːə", false, "", 1); // C + ວ → uːə (open)
    return null; // no vowel sign → inherent vowel handled by caller
}

// Vientiane Lao tone (Wiktionary Module:lo-pron system), DERIVED empirically from the kaikki Chao contours:
// LOW ˩ · RISING ˧˥ · MID ˧ · HIGH-FALLING ˥˨ · LOW-FALLING ˧˩. Tone = consonant class × live/dead × length × mark.
function tone(cls: Cls, live: boolean, long: boolean, mark: string): string {
    if (mark === "່") return "˧"; // mai ek → mid, all classes
    if (mark === "້") return cls === "high" ? "˧˩" : "˥˨"; // mai tho → high: low-falling; low/mid: high-falling
    if (mark === "໊") return "˥"; // mai ti (rare) → high
    if (mark === "໋") return "˧˥"; // mai catawa (rare) → rising
    if (live) return cls === "low" ? "˧˥" : "˩"; // live → low: rising; high/mid: low
    if (long) return cls === "low" ? "˥˨" : "˧˩"; // dead-long → low: high-falling; high/mid: low-falling
    return cls === "low" ? "˧" : "˧˥"; // dead-short → low: mid; high/mid: rising
}

/** Pull the tone marks (which combine ABOVE the onset and appear BEFORE the vowel signs in the stream: ຂ່າ)
 *  out of the character stream so vowel-pattern matching sees contiguous vowel signs. Each mark is attached to
 *  the most recent base consonant (its onset). Returns the mark-free chars + a map onset-index → mark. */
function extractTones(chars: string[]): { clean: string[]; toneAt: Map<number, string> } {
    const clean: string[] = [];
    const toneAt = new Map<number, string>();
    let lastCons = -1;
    for (const c of chars) {
        if (TONEMARK.has(c)) {
            if (lastCons >= 0 && !toneAt.has(lastCons)) toneAt.set(lastCons, c);
        } else {
            if (isCons(c)) lastCons = clean.length;
            clean.push(c);
        }
    }
    return { clean, toneAt };
}

/** Scan one reordered Lao word into rendered IPA syllables. */
interface SylF { onset: string; quality: string; long: boolean; codaOut: string; cls: Cls; live: boolean; mark: string; heavy: boolean; }

/** Scan a reordered Lao word into per-syllable feature records (for rendering AND tone derivation). */
function scanFeatures(word: string): SylF[] {
    const { clean: s, toneAt } = extractTones([...word]);
    const out: SylF[] = [];
    let i = 0;
    while (i < s.length) {
        // onset: a consonant, possibly ຫ/ໜ/ໝ-led (high) or a Cຼ / Cວ cluster
        let leadHigh = false;
        const onsetIdx = i;
        let c = s[i];
        // ໆ (mai kan / repetition mark) repeats the preceding syllable (ຊ້າໆ → saː.saː).
        if (c === "ໆ") { const last = out[out.length - 1]; if (last) out.push({ ...last }); i++; continue; }
        if (c === undefined || !isCons(c)) { i++; continue; }
        let onsetCs = [c];
        i++;
        // ຫ + sonorant → the sonorant, HIGH class. ຼ (U+0EBC, the lam-ligature) after ຫ is the l-form → [l];
        // it is NOT a base consonant, so it is matched explicitly.
        if (c === "ຫ" && (s[i] === "ຼ" || HSON.has(s[i] ?? ""))) {
            leadHigh = true; onsetCs = [s[i] === "ຼ" ? "ລ" : s[i]!]; i++;
        }
        // cluster: Cຼ (Cl). Cວ (incl. Cວຽ) is the VOWEL uːə (nwat→nuːət, ຄວາຍ→kʰuːəj, ມວຽ→muːəj), handled in
        // resolveVowel — Cວຽ is uːə + a [j] offglide coda, NOT a labialised kʷ (the referee writes muːə̯j).
        let cluster = "";
        if (s[i] === "ຼ") { cluster = "l"; i++; }
        // the reordered leading vowel (if any) sits right here
        let pre = "";
        if (LEAD.has(s[i] ?? "")) { pre = s[i]!; i++; }
        // collect following vowel signs / coda / tone (up to the next onset that starts a new syllable)
        const rest = s.slice(i);
        const rv = resolveVowel(pre, rest);
        let quality = "a", long = false, glide = "", used = 0;
        if (rv) { quality = rv.q; long = rv.long; glide = rv.glide; used = rv.used; }
        else if (pre) { /* handled above */ }
        else quality = "a"; // inherent vowel
        i += used;
        // tone mark was extracted up front (it combines above the onset), keyed by onset index (or the ຫ-lead).
        const mark = toneAt.get(onsetIdx) ?? toneAt.get(onsetIdx + 1) ?? "";
        // coda consonant (a final letter NOT starting a new vowelled syllable)
        let coda = "";
        const nx = s[i] ?? "";
        if (!glide && nx in CODA) {
            // nx is the onset of a NEW syllable (not a coda of this one) when it's directly followed by a vowel.
            // ອ/ວ are BOTH vowel signs and onset consonants (ʔ/ʋ), needing a 2-char lookahead: an ອ/ວ after nx
            // is a new onset (→ nx is THIS syllable's coda) only when it carries its OWN vowel (after2 is a vowel
            // sign/lead) AND this syllable already has a vowel — ຄົນອັງກິດ → kʰon.ʔaŋ.kit. Otherwise the ອ/ວ is
            // nx's own vowel (ກອນ → kɔːn, ຂະບວນ → kʰa.buːən) and nx stays the onset.
            const after = s[i + 1] ?? "", after2 = s[i + 2] ?? "";
            const vsigns = ["ະ", "າ", "ິ", "ີ", "ຸ", "ູ", "ຶ", "ື", "ັ", "ົ", "ຳ", "ໍ", "ຽ"];
            // an ອ/ວ after nx is nx's OWN vowel (→ nx is an onset) only when that ອ/ວ has no vowel of its own
            // after it (after2 not a vowel/lead → ກອນ=kɔːn, ຂະບວນ=kʰa.buːən); if it does, the ອ/ວ is a separate
            // onset and nx is THIS syllable's coda (ຄົນອັງກິດ=kʰon.ʔaŋ.kit, ກັງວານ=kaŋ.ʋaːn).
            const oIsOwnVowel = (after === "ອ" || after === "ວ")
                && !(vsigns.includes(after2) || LEAD.has(after2) || after2 === "ອ" || after2 === "ວ");
            const followsVowel = vsigns.includes(after) || LEAD.has(after) || oIsOwnVowel;
            if (!(isCons(nx) && followsVowel)) { coda = CODA[nx] ?? ""; i++; }
        }
        // a ຽ AFTER a nucleus is a [j] offglide coda (ຕາຽ→taːj, ຜູ້ຮ້າຽ→…haːj, ມວຽ→muːəj), not the iːə vowel
        // (which only fires when ຽ directly follows the onset, and is consumed by resolveVowel above).
        if (!coda && !glide && (s[i] ?? "") === "ຽ" && (used > 0 || pre !== "")) { coda = "j"; i++; }
        const onset = onsetCs.map((g) => CONS[g]?.[0] ?? "").join("") + cluster;
        const cls: Cls = leadHigh ? "high" : (CONS[onsetCs[0]!]?.[1] ?? "mid");
        const codaOut = coda || glide;
        // Centring diphthongs (uːə/iːə/ɯːə) carry their length in the quality string and set long:false so scan()
        // doesn't append a second ː — but for tone/live they count as heavy (long) syllables.
        const heavy = long || quality.includes("ː");
        const live = codaOut === "" ? heavy : /[ŋnmjw]/.test(codaOut); // open-heavy or sonorant coda = live
        out.push({ onset, quality, long, codaOut, cls, live, mark, heavy });
    }
    return out;
}

/** Render the scanned syllables to IPA (onset + nucleus + tone + coda). */
function scan(word: string): string {
    const out = scanFeatures(word).map(
        (s) => s.onset + s.quality + (s.long ? "ː" : "") + tone(s.cls, s.live, s.heavy, s.mark) + s.codaOut,
    );
    return out.join(".");
}

const TOKEN = /([຀-໿]+)|(\d+)|([.!?…,;:])/gu;

// ── Numbers ──────────────────────────────────────────────────────────────────────────────────────────
// The tokenizer matched (\d+) but NO branch consumed it — every digit run was silently dropped. The
// compositor emits LAO-SCRIPT words and reads them through the ordinary g2p, so no IPA is authored here.
// Lao is Tai, structurally the Thai system (see thai.ts) with the cognate irregulars: 20 is ຊາວ — and it
// REPLACES the whole "twenty" (ຊາວສອງ = 22, no ສິບ), unlike Thai ຢີ່ສິບ; a FINAL 1 in any compound ≥11 is
// ເອັດ (ສິບເອັດ, ຊາວເອັດ); 10⁴ ໝື່ນ and 10⁵ ແສນ are their own magnitude words.
// Source: Wiktionary "Category:Lao numerals" (the full 0–99 + ຮ້ອຍ / ພັນ / ໝື່ນ / ແສນ / ລ້ານ inventory,
// incl. ຊາວ, ຊາວເອັດ, ສິບເອັດ) — https://en.wiktionary.org/wiki/Category:Lao_numerals.
const LO_UNITS = ["ສູນ", "ໜຶ່ງ", "ສອງ", "ສາມ", "ສີ່", "ຫ້າ", "ຫົກ", "ເຈັດ", "ແປດ", "ເກົ້າ"];
const LO_MAG: [number, string][] = [[1e6, "ລ້ານ"], [1e5, "ແສນ"], [1e4, "ໝື່ນ"], [1e3, "ພັນ"], [100, "ຮ້ອຍ"]];

function numberToLaoWords(n: number): string[] {
    if (!Number.isSafeInteger(n) || n < 0) {
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9").map((d) => LO_UNITS[Number(d)]!);
    }
    if (n === 0) return [LO_UNITS[0]!];
    const out: string[] = [];
    let r = n;
    for (const [v, w] of LO_MAG) {
        if (r >= v) {
            const q = Math.floor(r / v);
            out.push(...numberToLaoWords(q), w);
            r %= v;
        }
    }
    if (r >= 10) {
        const t = Math.floor(r / 10);
        if (t === 2) out.push("ຊາວ"); // 20 is ຊາວ alone — no ສິບ (ຊາວສອງ = 22)
        else if (t === 1) out.push("ສິບ");
        else out.push(LO_UNITS[t]!, "ສິບ");
        r %= 10;
    }
    // A FINAL 1 in ANY compound ≥11 is ເອັດ, not ໜຶ່ງ: ສິບເອັດ 11, ຊາວເອັດ 21, ຮ້ອຍເອັດ 101, ພັນເອັດ 1001.
    if (r === 1 && n >= 11) out.push("ເອັດ");
    else if (r > 0) out.push(LO_UNITS[r]!);
    return out;
}


/** Per-syllable tone-determining features (class × live/dead × length × mark) — for tone-table derivation/tests. */
export function wordFeatures(word: string): { cls: Cls; live: boolean; long: boolean; mark: string }[] {
    return scanFeatures(reorder(word)).map((s) => ({ cls: s.cls, live: s.live, long: s.heavy, mark: s.mark }));
}

/** One Lao word → canonical IPA. */
export function phonemizeWord(word: string): string {
    return scan(reorder(word));
}

class LaoPhonemizer implements Phonemizer {
    text(input: string): string {
        // Fold this script's own digits to ASCII first: the number token is `\d+`, which JavaScript
        // defines as ASCII-only, so a numeral written in native digits matched NO token and was
        // dropped entirely — the engine returned an empty string for it (core/unicode.ts).
        return assembleClauses(foldNativeDigits(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) for (const wd of numberToLaoWords(Number(m[2]))) sink.emit(phonemizeWord(wd));
            // Canonical, UNPADDED pause marks — a padded value reaches the output as a double space, and
            // collapsing ? and ! into "." threw away the sentence type. Lao is the one engine that
            // hardcodes this rather than reading clausePunctuation from its manifest.
            else if (m[3] === "?") sink.pause("?");
            else if (m[3] === "!") sink.pause("!");
            else if (m[3] && ".…".includes(m[3])) sink.pause(".");
        });
    }
}
export function createLao(): Phonemizer {
    return new LaoPhonemizer();
}
