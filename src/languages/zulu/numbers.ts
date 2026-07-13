/**
 * Zulu (zu) cardinal number compositor. Zulu numerals are agglutinative Bantu: units 1–5 have distinct
 * standalone (ku-), connective (na-) and multiplier (ama-) stems, and 6–9 are isi- nouns; tens/hundreds/
 * thousands are noun classes with an ama-/izi- multiplier. This returns the composed Zulu TEXT (space-separated
 * words) — the phonemizer runs each word through the g2p, so the IPA stays consistent with the word engine.
 * See docs/zu_native_bringup_investigation.md.
 */

const KU = ["", "kunye", "kubili", "kuthathu", "kune", "kuhlanu", "isithupha", "isikhombisa", "isishiyagalombili", "isishiyagalolunye"]; // standalone 1–9
const NA = ["", "nanye", "nambili", "nantathu", "nane", "nanhlanu", "nesithupha", "nesikhombisa", "nesishiyagalombili", "nesishiyagalolunye"]; // 1–9 after a connective
const AMA = ["", "", "amabili", "amathathu", "amane", "amahlanu", "ayisithupha", "ayisikhombisa", "ayisishiyagalombili", "ayisishiyagalolunye"]; // ×N multiplier, 2–9

/** A non-negative integer → space-separated Zulu cardinal words. */
export function numberToWords(n: number): string {
  if (n < 0 || !Number.isFinite(n)) return "";
  n = Math.floor(n);
  if (n === 0) return "iqanda";
  if (n >= 1000000) {
    const m = Math.floor(n / 1000000), rem = n % 1000000;
    const mil = m === 1 ? "isigidi" : `izigidi ${AMA[m] ?? numberToWords(m)}`;
    return rem ? `${mil} ${numberToWords(rem)}` : mil;
  }
  const parts: string[] = [];
  const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  if (th === 1) parts.push("inkulungwane");
  else if (th >= 2) parts.push("izinkulungwane", AMA[th] ?? numberToWords(th));
  if (h === 1) parts.push("ikhulu");
  else if (h >= 2) parts.push("amakhulu", AMA[h]!);
  if (t === 1) parts.push("ishumi");
  else if (t >= 2) parts.push("amashumi", AMA[t]!);
  if (u > 0) parts.push(parts.length === 0 ? KU[u]! : NA[u]!); // standalone ku- alone, else connective na-
  return parts.join(" ");
}
