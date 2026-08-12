/**
 * Lao (lo) phonemizer — canonical IPA (authored). This file owns the ALGORITHMS: the leading-vowel reorder
 * pass, the ຫ-led cluster handling, the syllable scanner, the ordered first-match walk over the vowel
 * patterns, and the number compositor. Every TABLE it reads — onsets, codas, the vowel patterns, the tone
 * table and the number words — is data in lao.jsonc.
 */
import { foldNativeDigits } from "../../core/unicode.ts";
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { normalizeLao } from "./normalize.ts";

type Cls = "high" | "mid" | "low";

interface LaoNumbers {
    units: string[];
    ten: string;
    twenty: string;
    finalOne: string;
    magnitudes: [number, string][];
}
/** One vowel PATTERN (lao.jsonc). `pre` is the reordered leading vowel, `signs` the characters that follow
 *  the onset; the number consumed is `signs.length`. Absent `pre` means "only when there is no leading
 *  vowel"; empty `signs` is a group's catch-all. */
interface VowelPattern {
    pre?: string;
    signs: string;
    q: string;
    long?: boolean;
    glide?: string;
}
/** The tone table (lao.jsonc): a per-class row with a `default` for the classes that share a value. */
type ToneRow = Partial<Record<Cls, string>> & { default?: string };

interface LaoDef {
    onsets: Record<string, [string, Cls]>;
    vowelPatterns: readonly VowelPattern[];
    tone: { marks: Record<string, ToneRow>; live: ToneRow; deadLong: ToneRow; deadShort: ToneRow };
    leadingVowels: readonly string[];
    hLedSonorants: readonly string[];
    toneMarks: readonly string[];
    codas: Record<string, string>;
    cancellationMark: string;
    numbers: LaoNumbers;
}
/** The Lao data manifest (lao.jsonc): the letter values, the vowel PATTERN table, the tone table and
 *  the number words. Exported under the tree's conventional name so the tables can be inspected and
 *  invariant-tested as DATA — the pattern list's order is load-bearing (see test/lao.test.ts). */
export const MANIFEST = loadManifest<LaoDef>(import.meta.url, "lao.jsonc");
// Onset consonant → [IPA, tonal class] and the 8-way final set (lao.jsonc). The ຫ-led sonorants (ໜ ໝ,
// ຫຼ ຫງ …) become HIGH class — handled in the scanner below.
const CONS = MANIFEST.onsets;
const CODA = MANIFEST.codas;

// Vowel signs (combining/spacing) used by the scanner.
const LEAD = new Set(MANIFEST.leadingVowels); // written before the consonant
const HSON = new Set(MANIFEST.hLedSonorants); // the sonorants ຫ leads → HIGH class (ຫ + others is NOT a lead)
const TONEMARK = new Set(MANIFEST.toneMarks);
const VOWELS = MANIFEST.vowelPatterns; // ORDERED — see resolveVowel and lao.jsonc
const TONE = MANIFEST.tone;
const CANCEL = MANIFEST.cancellationMark;
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

// After reorder, resolve the vowel PATTERN around a consonant. Returns [quality, long, glide, consumedTail].
// `pre` = a leading vowel now sitting AFTER the consonant (ເ ແ ໂ ໄ ໃ), `signs` = the following sign string.
// This is the crux of Lao g2p.
/**
 * Apply the CANCELLATION MARK ໌ (karan): delete the consonant it sits on, and the mark.
 *
 * ⚠ IT CANCELS THE WHOLE FINAL CLUSTER, LEAVING EXACTLY ONE CODA. The referee gives both halves of that:
 * `ອາທິຕຍ໌` keeps ⟨ຕ⟩ as its coda ([ʔaː.tʰit̚] — only ⟨ຍ⟩ is silent) while `ວຽງຈັນທນ໌` silences ⟨ທ⟩ as well
 * as ⟨ນ⟩ ([ʋiːəŋ.t͡ɕan]). The rule that yields both is to keep walking left while the character BEFORE the
 * current one is also a consonant — i.e. strip the tail down to a single coda and stop.
 *
 * Runs after `reorder`, so a leading vowel already sits between the onset and the final cluster and
 * terminates the walk by itself (ໄຟລ໌ → ຟໄລ໌ → ຟໄ → faj).
 */
function cancelSilent(w: string): string {
    if (!w.includes(CANCEL)) return w;
    const s = [...w];
    const drop = new Set<number>();
    for (let i = 0; i < s.length; i++) {
        if (s[i] !== CANCEL) continue;
        drop.add(i);
        let j = i - 1;
        while (j >= 0 && drop.has(j)) j--; // two marks in a row, or a mark on an already-cancelled letter
        if (j < 0 || !isCons(s[j]!)) continue; // a stray mark with no consonant under it: just drop the mark
        drop.add(j);
        for (let k = j - 1; k >= 1 && isCons(s[k]!) && isCons(s[k - 1]!); k--) drop.add(k);
    }
    return s.filter((_, i) => !drop.has(i)).join("");
}

/**
 * Resolve the vowel at this position: walk the pattern table in order and take the FIRST whose leading
 * vowel and following signs both match. Returns null when nothing matches, which for a syllable with no
 * leading vowel means it takes the inherent vowel (the caller supplies it).
 *
 * ⚠ THE TABLE'S ORDER IS THE ALGORITHM. A longer pattern must precede any shorter one it starts with, and
 * each leading-vowel group ends in an empty-`signs` catch-all — which is what makes a bare ⟨ເ⟩ read as eː
 * AND what stops a leading-vowel syllable from falling through to the non-leading patterns. See lao.jsonc.
 */
function resolveVowel(
    pre: string,
    after: string[],
): { q: string; long: boolean; glide: string; used: number } | null {
    for (const p of VOWELS) {
        if ((p.pre ?? "") !== pre) continue;
        const n = [...p.signs].length;
        if (n > 0 && after.slice(0, n).join("") !== p.signs) continue;
        return { q: p.q, long: p.long ?? false, glide: p.glide ?? "", used: n };
    }
    return null;
}

/** Tone = a written MARK if there is one, else (live | dead-long | dead-short) × the onset's CLASS.
 *  Both the contours and which classes share one are data (lao.jsonc "tone"). */
function tone(cls: Cls, live: boolean, long: boolean, mark: string): string {
    const row = TONE.marks[mark] ?? (live ? TONE.live : long ? TONE.deadLong : TONE.deadShort);
    return row[cls] ?? row.default ?? "";
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

/** One syllable's features — enough to RENDER it and to derive its tone. */
interface SylF {
    onset: string; // IPA, including any cluster member
    cls: Cls; // the onset's TONAL class, which is what tone() keys on
    quality: string; // vowel IPA, without the length mark
    long: boolean; // append ː when rendering
    codaOut: string; // IPA coda: the coda consonant, or the vowel-derived glide
    mark: string; // the tone-mark character, extracted up front by extractTones
    live: boolean; // open-heavy or sonorant coda — the live/dead split tone() needs
    heavy: boolean; // ⚠ NOT `long`: a centring diphthong carries its ː inside `quality` and sets
    // long:false so scan() does not append a second one, but still counts as heavy for tone.
}

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
            // nx is the onset of a NEW syllable (not a coda of this one) when it is directly followed by a vowel.
            // ⚠ ອ/ວ ARE BOTH VOWEL SIGNS AND ONSET CONSONANTS (ʔ/ʋ), so this needs a 2-char lookahead. An ອ/ວ
            // after nx is nx's OWN vowel — leaving nx the onset — only when nothing vowel-like follows it
            // (ກອນ=kɔːn, ຂະບວນ=kʰa.buːən). If a vowel sign or lead vowel DOES follow, that ອ/ວ is its own onset
            // and nx is THIS syllable's coda (ຄົນອັງກິດ=kʰon.ʔaŋ.kit, ກັງວານ=kaŋ.ʋaːn).
            const after = s[i + 1] ?? "", after2 = s[i + 2] ?? "";
            const vsigns = ["ະ", "າ", "ິ", "ີ", "ຸ", "ູ", "ຶ", "ື", "ັ", "ົ", "ຳ", "ໍ", "ຽ"];
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
// The compositor emits LAO-SCRIPT words (data + provenance in lao.jsonc) and reads them back through the
// ordinary g2p, so no IPA is authored here.
const NUM = MANIFEST.numbers;
const LO_UNITS = NUM.units;

function numberToLaoWords(n: number): string[] {
    if (!Number.isSafeInteger(n) || n < 0) {
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9").map((d) => LO_UNITS[Number(d)]!);
    }
    if (n === 0) return [LO_UNITS[0]!];
    const out: string[] = [];
    let r = n;
    for (const [v, w] of NUM.magnitudes) {
        if (r >= v) {
            const q = Math.floor(r / v);
            out.push(...numberToLaoWords(q), w);
            r %= v;
        }
    }
    if (r >= 10) {
        const t = Math.floor(r / 10);
        if (t === 2) out.push(NUM.twenty); // 20 is ຊາວ alone — no ສິບ (ຊາວສອງ = 22)
        else if (t === 1) out.push(NUM.ten);
        else out.push(LO_UNITS[t]!, NUM.ten);
        r %= 10;
    }
    // A FINAL 1 in ANY compound ≥11 is ເອັດ, not ໜຶ່ງ: ສິບເອັດ 11, ຊາວເອັດ 21, ຮ້ອຍເອັດ 101, ພັນເອັດ 1001.
    if (r === 1 && n >= 11) out.push(NUM.finalOne);
    else if (r > 0) out.push(LO_UNITS[r]!);
    return out;
}


/** Per-syllable tone-determining features (class × live/dead × length × mark) — for tone-table derivation/tests. */
export function wordFeatures(word: string): { cls: Cls; live: boolean; long: boolean; mark: string }[] {
    return scanFeatures(reorder(word)).map((s) => ({ cls: s.cls, live: s.live, long: s.heavy, mark: s.mark }));
}

/** One Lao word → canonical IPA. */
export function phonemizeWord(word: string): string {
    return scan(cancelSilent(reorder(word)));
}

class LaoPhonemizer implements Phonemizer {
    text(input: string): string {
        // ⚠ FOLD THIS SCRIPT'S OWN DIGITS TO ASCII FIRST: the number token is `\d+`, and JavaScript
        // defines `\d` as ASCII-only, so a numeral written in Lao digits matches NO token at all and
        // is dropped (core/unicode.ts).
        return assembleClauses(foldNativeDigits(normalizeLao(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) for (const wd of numberToLaoWords(Number(m[2]))) sink.emit(phonemizeWord(wd));
            // Canonical, UNPADDED pause marks: a padded value reaches the output as a double space, and
            // ? and ! must stay distinct from "." or the sentence type is lost. Hardcoded rather than a
            // manifest clausePunctuation table, deliberately: , ; : produce NO pause here.
            else if (m[3] === "?") sink.pause("?");
            else if (m[3] === "!") sink.pause("!");
            else if (m[3] && ".…".includes(m[3])) sink.pause(".");
        });
    }
}
export function createLao(): Phonemizer {
    return new LaoPhonemizer();
}
