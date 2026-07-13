/**
 * Czech (cs) cardinal number compositor. Returns composed Czech TEXT (space-separated) that the phonemizer runs
 * through the g2p, so the IPA stays consistent with the word engine. Tens+units concatenate (dvacetjeden = 21);
 * hundreds and thousands are space-separated. Czech thousand agreement: 1 tisíc, 2–4 tisíce, 5+ tisíc (likewise
 * milion/miliony/milionů). See docs/cs_native_bringup_investigation.md.
 */

const UNITS = ["nula", "jeden", "dva", "tři", "čtyři", "pět", "šest", "sedm", "osm", "devět"]; // 0–9
const TEENS = ["deset", "jedenáct", "dvanáct", "třináct", "čtrnáct", "patnáct", "šestnáct", "sedmnáct", "osmnáct", "devatenáct"]; // 10–19
const TENS = ["", "", "dvacet", "třicet", "čtyřicet", "padesát", "šedesát", "sedmdesát", "osmdesát", "devadesát"]; // ×10
const HUNDREDS = ["", "sto", "dvěstě", "třista", "čtyřista", "pětset", "šestset", "sedmset", "osmset", "devětset"]; // ×100

/** 0–99 → Czech text (tens and units concatenated). */
function sub100(n: number): string {
  if (n < 10) return UNITS[n]!;
  if (n < 20) return TEENS[n - 10]!;
  return TENS[Math.floor(n / 10)]! + (n % 10 ? UNITS[n % 10]! : "");
}

/** 0–999 → Czech text (hundreds space-separated from the sub-hundred remainder). */
function sub1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  if (h === 0) return sub100(r);
  return HUNDREDS[h]! + (r ? ` ${sub100(r)}` : "");
}

/** Czech agreement form for a magnitude count: 1 → sg, 2–4 → paucal, else → genitive-plural. */
function agree(count: number, sg: string, paucal: string, plural: string): string {
  return count === 1 ? sg : count >= 2 && count <= 4 ? paucal : plural;
}

/** A non-negative integer → space-separated Czech cardinal words. */
export function numberToWords(n: number): string {
  if (n < 0 || !Number.isFinite(n)) return "";
  n = Math.floor(n);
  if (n === 0) return "nula";
  const parts: string[] = [];
  const mil = Math.floor(n / 1000000); n %= 1000000;
  if (mil) parts.push((mil === 1 ? "" : `${sub1000(mil)} `) + agree(mil, "milion", "miliony", "milionů"));
  const th = Math.floor(n / 1000); n %= 1000;
  if (th) parts.push(th === 1 ? "tisíc" : `${sub1000(th)} ${agree(th, "tisíc", "tisíce", "tisíc")}`);
  if (n) parts.push(sub1000(n));
  return parts.join(" ");
}
