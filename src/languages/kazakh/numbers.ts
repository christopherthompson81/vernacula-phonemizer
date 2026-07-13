/**
 * Kazakh (kk) cardinal number compositor. Kazakh number words are lexicalised in espeak (their stress and a few
 * segments don't follow the regular g2p — жиырма is final-stressed, алпыс has a clear l, нөл has ø), and the
 * compositor concatenates tens+units and the hundred-multiplier WITHOUT a space (онбір, жиырмабір, екіжүз) but
 * separates magnitude groups WITH a space (бір мың екіжүз отызтөрт). So this returns finished canonical IPA
 * directly (the atomic forms captured from espeak), rather than routing Kazakh text through the g2p.
 * 100 omits the leading 1 (жүз, not біржүз); 1000 keeps it (бір мің). See docs/kk_native_bringup_investigation.md.
 */

const UNIT = ["nˈøɫ", "bˈɪr", "jˈekɪ", "ˈʏʃ", "tˈɵrt", "bˈes", "ˈɑɫtə", "ʒˈetɪ", "sˈeɡɪz", "tˈoʁəz"]; // 0–9
const TENS = ["", "ˈon", "ʒəjərmˈɑ", "ˈotəz", "qˈərəq", "jˈelw", "ˈɑlpəs", "ʒetpˈɪs", "seksˈen", "toqsˈɑn"]; // ×10
const HUNDRED = "ʒˈʏz", THOUSAND = "mˈəŋ", MILLION = "məjlɫəjˈon";

/** 0–99 → concatenated IPA (tens and units glued, matching espeak). */
function sub100(n: number): string {
  if (n < 10) return UNIT[n]!;
  const t = Math.floor(n / 10), u = n % 10;
  return TENS[t]! + (u ? UNIT[u]! : "");
}

/** 0–999 → IPA; the hundred-multiplier is glued (екіжүз) but the sub-hundred remainder is space-separated. */
function sub1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  if (h === 0) return sub100(r);
  const hp = h === 1 ? HUNDRED : UNIT[h]! + HUNDRED; // 100 omits the leading 1
  return r ? `${hp} ${sub100(r)}` : hp;
}

/** A non-negative integer → space-separated canonical IPA (magnitude groups spaced, sub-groups glued). */
export function numberToIpa(n: number): string {
  if (n < 0 || !Number.isFinite(n)) return "";
  n = Math.floor(n);
  if (n < 1000) return sub1000(n);
  const groups: string[] = [];
  const mil = Math.floor(n / 1000000); n %= 1000000;
  if (mil) groups.push(mil === 1 ? MILLION : `${numberToIpa(mil)} ${MILLION}`); // million omits the leading 1
  const th = Math.floor(n / 1000); n %= 1000;
  if (th) groups.push(`${th === 1 ? UNIT[1]! : sub1000(th)} ${THOUSAND}`);      // 1000 keeps it: бір мің
  if (n) groups.push(sub1000(n));
  return groups.join(" ");
}
