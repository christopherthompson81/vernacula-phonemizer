import { readFileSync } from "node:fs";
import { applyNumeralRegister as A } from "./tools/corpus/numeral_register.mts";
import { restoreAbbreviationDots, restoreInitialismCasing, restoreNguniConcordAcronyms } from "./tools/corpus/asr-align/initialism_casing.mts";
const map: Record<string,[string,string]> = { sn_zw:["sn","sn_zw"], zu_za:["zu","zu_za"], xh_za:["xh","xh_za"], ny_mw:["nya","ny_mw"], ln_cd:["ln","ln_cd"] };
for (const [f,[code,fl]] of Object.entries(map)) {
  const rows = readFileSync(`/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/${f}/train.tsv`,"utf8").split("\n").filter(Boolean).map(l=>l.split("\t")[3]??"");
  let diff=0; const ex:string[]=[];
  for (const t of rows) { if(!/\d/.test(t)) continue;
    const rep = restoreNguniConcordAcronyms(restoreAbbreviationDots(restoreInitialismCasing(t, fl), fl), fl);
    const a = A(t,code)!==t, b = A(rep,code)!==rep;
    if (a!==b) { diff++; if(ex.length<3) ex.push(rep.match(/\S*\d\S*/g)!.join(" | ")); }
  }
  console.log(f, "decline-status changed by repair pass:", diff, ex);
}
