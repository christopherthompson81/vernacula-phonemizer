import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const raw = readFileSync("appA_layout.txt","utf8");
const LECTS=["KS","RL","MH","TH","SH","RP","BH","BN"];
const isDeva=(c:string)=>{const x=c.codePointAt(0)!;return x>=0x900&&x<=0x97f;};
const isComb=(c:string)=>{const x=c.codePointAt(0)!;return x>=0x300&&x<=0x36f;};
const rejoin=(s:string)=>s.replace(/ +([̀-ͯ])/g,"$1");
const IPA_OK=new Set([..."aeiouɔɛəæpbtdʈɖkgɡcɟʂʃshmnɳŋɲlɭrɽɾwjvfxɣʣʤ","ʰ","ʱ","˜"]);
const isIpaCh=(c:string)=>IPA_OK.has(c)||isComb(c);
const stripTail=(s:string)=>{let a=[...s.replace(/\s/g,"")];while(a.length&&!isIpaCh(a[a.length-1]!))a.pop();return a.join("");};
const aksh=(d:string)=>[...d].filter(c=>{const x=c.codePointAt(0)!;return (x>=0x915&&x<=0x939)||(x>=0x905&&x<=0x914);}).length;
const rows:Record<string,[string,string][]>={}; for(const L of LECTS)rows[L]=[];
for(const line0 of raw.split("\n")){const line=rejoin(line0);
  for(const cell of line.split(/\s{6,}/)){const m=cell.trim().match(/^(KS|RL|MH|TH|SH|RP|BH|BN):\s*(.+)$/);if(!m)continue;
    const chars=[...m[2]!];let ipa="",deva="",seen=false;
    for(const c of chars){if(isDeva(c)){seen=true;deva+=c;}else if(seen){if(c===" "||c===",")deva+=c;}else ipa+=c;}
    const ipas=ipa.split(",").map(stripTail).filter(Boolean);
    const devas=deva.split(/[,\s]+/).map(s=>s.trim()).filter(s=>s&&[...s].every(isDeva));
    const n=Math.min(ipas.length,devas.length);
    for(let i=0;i<n;i++){const d=devas[i]!,ip=ipas[i]!; if(ip.length>=2&&[...ip].every(isIpaCh)&&aksh(d)>=2&&[...d].length>=2) rows[m[1]!]!.push([d,ip]);}
  }}
mkdirSync("referees_clean",{recursive:true});
for(const L of LECTS){const seen=new Set<string>();const u=rows[L]!.filter(([d,i])=>{const k=d+i;if(seen.has(k))return false;seen.add(k);return true;});
  writeFileSync(`referees_clean/${L}.tsv`,u.map(([d,i])=>`${d}\t${i}`).join("\n")+"\n");console.log(L,u.length);}
