/**
 * Neural Arabic diacritizer (Phase 2): a sentence-level BiLSTM that restores short vowels on bare Arabic
 * text, run via ONNX Runtime as an ASYNC PRE-PASS. Its vocalized output feeds the (synchronous) g2p in
 * arabic.ts — so phonemize() stays sync and dependency-free; only this pre-pass touches ONNX. `onnxruntime-
 * node` is an OPTIONAL dependency, imported lazily.
 *
 * Ported from the espeak-ng-portable integration. The shipped .onnx is a permissively-sourced model:
 * CATT teacher (Apache-2.0) → Arabic Wikipedia (CC-BY-SA) silver-only, no NC/GPL. See diacritizer.PROVENANCE.md.
 * Position-preserving: only harakat are inserted after Arabic letters; digits/punctuation/spacing are kept.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SHADDA = "ّ";
const LABEL_VOWEL_MARK: Record<string, string> = {
  a: "َ", u: "ُ", i: "ِ", o: "ْ", F: "ً", N: "ٌ", K: "ٍ", "^": "ٰ",
};
const MARK_TO_VOWEL: Record<string, string> = Object.fromEntries(Object.entries(LABEL_VOWEL_MARK).map(([k, v]) => [v, k]));
const IS_MARK = new Set([SHADDA, ...Object.keys(MARK_TO_VOWEL)]);

function isArabicLetterCp(cp: number): boolean {
  return (cp >= 0x0620 && cp <= 0x064a) || (cp >= 0x0671 && cp <= 0x06d3) || cp === 0x0629 || cp === 0x0649;
}
/** Strip every combining haraka → the bare consonant skeleton. */
function undiacritize(word: string): string {
  let out = "";
  for (const c of word) if (!IS_MARK.has(c)) out += c;
  return out;
}
/** Reconstruct the combining marks for one label ("0" = bare). */
function labelToMarks(label: string): string {
  if (label === "0") return "";
  let out = "", v = label;
  if (label.startsWith("~")) { out += SHADDA; v = label.slice(1); }
  if (v && v !== "0") out += LABEL_VOWEL_MARK[v] ?? "";
  return out;
}

// Defective-spelling closed class: high-frequency words whose long /aː/ is an unwritten dagger-alif.
const AR_DEFECTIVE_SPELLING = new Map<string, string>([
  ["هذا", "هٰذَا"], ["هذه", "هٰذِهِ"], ["هذان", "هٰذَان"], ["هذين", "هٰذَيْن"],
  ["ذلك", "ذٰلِكَ"], ["ذلكم", "ذٰلِكُم"], ["كذلك", "كَذٰلِكَ"], ["لكن", "لٰكِن"], ["هؤلاء", "هٰؤُلَاءِ"],
  ["ثلاثمئة", "ثَلَاثُمِئَة"], ["أربعمئة", "أَرْبَعُمِئَة"], ["خمسمئة", "خَمْسُمِئَة"], ["ستمئة", "سِتْتُمِئَة"],
  ["سبعمئة", "سَبْعُمِئَة"], ["ثمانمئة", "ثَمَانِمِئَة"], ["تسعمئة", "تِسْعُمِئَة"],
]);
/** Classical otiose-alif مائة "hundred" → modern مئة (reads /miʔa/, not /maːʔa/). */
function normalizeArabicNumberSpelling(skeleton: string): string {
  return skeleton.replace(/مائة/g, "مئة").replace(/مائت/g, "مئت");
}
/** Rewrite defective-spelling words to their dagger-alif form (keyed on the skeleton; strips a leading proclitic). */
function applyDefectiveSpelling(line: string): string {
  return line.replace(/[؀-ۿݐ-ݿ]+/gu, (w) => {
    const direct = AR_DEFECTIVE_SPELLING.get(undiacritize(w));
    if (direct !== undefined) return direct;
    const m = /^([وفبكل][ً-ْٰ]*)(.+)$/u.exec(w);
    if (m) { const stem = AR_DEFECTIVE_SPELLING.get(undiacritize(m[2]!)); if (stem !== undefined) return m[1]! + stem; }
    return w;
  });
}

/** Whitespace set matching C# char.IsWhiteSpace + Python .split() (NOT JS /\s/) for cross-engine parity. */
function isWhitespace(c: string): boolean {
  const cp = c.charCodeAt(0);
  return cp === 0x20 || (cp >= 0x09 && cp <= 0x0d) || cp === 0x85 || cp === 0xa0 || cp === 0x1680
    || (cp >= 0x2000 && cp <= 0x200a) || cp === 0x2028 || cp === 0x2029 || cp === 0x202f || cp === 0x205f || cp === 0x3000;
}
/** A pausal (phrase-final) boundary follows: end / whitespace / punctuation (not a letter or mark). */
function isPausalBoundary(next: string | undefined): boolean {
  if (next === undefined || isWhitespace(next)) return true;
  const cp = next.codePointAt(0)!;
  const isMark = (cp >= 0x064b && cp <= 0x065f) || cp === 0x0670;
  return !isArabicLetterCp(cp) && !isMark;
}
/** Pausal form for TTS: drop a word-final case-ending vowel/tanwin; accusative ـًا/ـًى → /aː/. */
function pausalize(text: string): string {
  const chars = [...text];
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i]!.codePointAt(0)!;
    if (cp === 0x064b) {
      const nextCp = chars[i + 1]?.codePointAt(0);
      if ((nextCp === 0x0627 || nextCp === 0x0649) && isPausalBoundary(chars[i + 2])) { out.push("َ"); continue; }
    }
    if (cp >= 0x064b && cp <= 0x0650 && isPausalBoundary(chars[i + 1])) continue;
    out.push(chars[i]!);
  }
  return out.join("");
}

export interface DiacritizerMeta { chars: Record<string, number>; labels: Record<string, number>; }
export interface ArabicDiacritizer { diacritize(text: string): Promise<string>; }

interface OrtLike {
  InferenceSession: { create(path: string | Uint8Array): Promise<OrtSession> };
  Tensor: new (type: "int64", data: BigInt64Array, dims: number[]) => unknown;
}
interface OrtSession { run(feeds: Record<string, unknown>): Promise<Record<string, { data: unknown }>>; }

let ortPromise: Promise<OrtLike> | undefined;
async function loadOrt(): Promise<OrtLike> {
  if (!ortPromise) {
    ortPromise = import("onnxruntime-node").then((m) => (m.default ?? m) as unknown as OrtLike).catch(() => {
      throw new Error("Arabic diacritization needs the optional dependency `onnxruntime-node`. Install it with `npm install onnxruntime-node`.");
    });
  }
  return ortPromise;
}

/** Load a neural Arabic diacritizer from ONNX model bytes + sidecar meta. Session created once and reused. */
export async function loadArabicDiacritizer(modelBytes: Uint8Array, meta: DiacritizerMeta): Promise<ArabicDiacritizer> {
  const ort = await loadOrt();
  const session = await ort.InferenceSession.create(modelBytes);
  const ilabels: string[] = [];
  for (const [lab, idx] of Object.entries(meta.labels)) ilabels[idx] = lab;
  const UNK = meta.chars["<unk>"] ?? 1;
  const SP = meta.chars["<sp>"] ?? -1;
  if (SP < 0) throw new Error("diacritizer meta missing the <sp> token");
  const nLabels = ilabels.length;

  async function argmax(indices: number[]): Promise<number[]> {
    const input = new ort.Tensor("int64", BigInt64Array.from(indices, BigInt), [1, indices.length]);
    const out = await session.run({ input });
    const logitsTensor = out["logits"] ?? out[Object.keys(out)[0]!];
    if (!logitsTensor) throw new Error("diacritizer ONNX produced no output");
    const logits = logitsTensor.data as Float32Array;
    const res = new Array<number>(indices.length);
    for (let p = 0; p < indices.length; p++) {
      let best = 0, bestv = -Infinity;
      const base = p * nLabels;
      for (let o = 0; o < nLabels; o++) { const v = logits[base + o]!; if (v > bestv) { bestv = v; best = o; } }
      res[p] = best;
    }
    return res;
  }

  async function diacritizeLine(line: string): Promise<string> {
    const src = [...normalizeArabicNumberSpelling(undiacritize(line))];
    const seq: number[] = [], pos: number[] = [];
    let prevWordHadLetter = false, i = 0;
    while (i < src.length) {
      if (isWhitespace(src[i]!)) { i++; continue; }
      let j = i, hasLetter = false;
      while (j < src.length && !isWhitespace(src[j]!)) { if (isArabicLetterCp(src[j]!.codePointAt(0)!)) hasLetter = true; j++; }
      if (hasLetter) {
        if (prevWordHadLetter) seq.push(SP);
        for (let k = i; k < j; k++) if (isArabicLetterCp(src[k]!.codePointAt(0)!)) { pos.push(k); seq.push(meta.chars[src[k]!] ?? UNK); }
        prevWordHadLetter = true;
      }
      i = j;
    }
    if (seq.length === 0 || seq.every((x) => x === SP)) return line;
    const labelIdx = await argmax(seq);
    const marks = new Map<number, string>();
    let li = 0;
    for (let p = 0; p < seq.length; p++) { if (seq[p] === SP) continue; marks.set(pos[li]!, labelToMarks(ilabels[labelIdx[p]!]!)); li++; }
    return pausalize(applyDefectiveSpelling(src.map((ch, k) => ch + (marks.get(k) ?? "")).join("")));
  }

  return {
    async diacritize(text: string): Promise<string> {
      const lines = text.split("\n");                    // one sentence per line = one inference context
      for (let k = 0; k < lines.length; k++) if (lines[k]!.trim()) lines[k] = await diacritizeLine(lines[k]!);
      return lines.join("\n");
    },
  };
}

/** Load the diacritizer from the model + meta beside this file (model is gitignored — dev stand-in or the
 *  built permissive model). Returns undefined if the .onnx is absent. */
export async function createArabicDiacritizer(): Promise<ArabicDiacritizer | undefined> {
  const dir = dirname(fileURLToPath(import.meta.url));
  let bytes: Buffer;
  try { bytes = readFileSync(join(dir, "diacritizer.onnx")); } catch { return undefined; }
  const meta = JSON.parse(readFileSync(join(dir, "diacritizer.meta.json"), "utf8")) as DiacritizerMeta;
  return loadArabicDiacritizer(new Uint8Array(bytes), meta);
}
