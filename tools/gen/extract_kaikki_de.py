import sys, json
seen=set(); n=0; kept=0
out=open(sys.argv[1],"w",encoding="utf-8")
for line in sys.stdin:
    line=line.strip()
    if not line: continue
    n+=1
    try: o=json.loads(line)
    except: continue
    if o.get("lang_code")!="de": continue
    w=o.get("word","")
    if not w or not o.get("sounds"): continue
    # first IPA (prefer phonemic /.../, else phonetic [...])
    ipa=None
    for s in o["sounds"]:
        v=s.get("ipa")
        if v: ipa=v; break
    if not ipa: continue
    ipa=ipa.strip().strip("/[]").strip()
    key=w.lower()
    if key in seen: continue
    seen.add(key); kept+=1
    out.write(key+"\t"+ipa+"\n")
out.close()
sys.stderr.write(f"lines={n} kept={kept}\n")
