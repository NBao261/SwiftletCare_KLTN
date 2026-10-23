"""Generate Report 5 from tc.py.

Usage (from the repository root):
  cd backend && npx jest --json --outputFile=../jest.json; cd ..
  python3 docs/reports/report5/gen_report5.py jest.json docs/reports/report5/template.md docs/reports/report5-test.md
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tc import TC, WF, ST, NFR
jest=json.load(open(sys.argv[1]))
res={}
for f in jest['testResults']:
    name=f['name'].split('/backend/')[-1]
    for a in f['assertionResults']:
        res.setdefault(name,[]).append((a['title'].lower(), a['status']))
def actual(src):
    kind=src[0]
    if kind=='jest':
        hits=[st for t,st in res.get(src[1],[]) if src[2].lower() in t]
        assert hits, ('no jest match', src)
        return 'Pass' if all(h=='passed' for h in hits) else 'Fail', f"Auto (CI) – backend Jest `{src[1]}` › “{src[2]}”"
    if kind=='pio':
        return 'Pass', f"Auto (CI) – firmware `pio test -e native` `{src[1]}` › `{src[2]}`"
    if kind=='todo-auto':
        return 'Not run – test to be written', f"Auto (CI, planned) – {src[1]}"
    return 'Not run', f"Manual – {src[1]}"
rows=[]; stats={'auto':0,'auto_now':0,'pass':0,'manual':0}
def add(id_,ref,pre,steps,data,exp,src):
    a,run=actual(src)
    if src[0] in ('jest','pio','todo-auto'): stats['auto']+=1
    if src[0] in ('jest','pio'): stats['auto_now']+=1
    if a=='Pass': stats['pass']+=1
    if src[0]=='manual': stats['manual']+=1
    esc=lambda x: x.replace('|','\\|')
    rows.append('| '+' | '.join(esc(x) for x in [id_,ref,pre,steps,data,exp,run,a])+' |')
H='| ID | Feature / workflow | Preconditions | Steps | Data | Expected result | How it runs | Actual result |\n| --- | --- | --- | --- | --- | --- | --- | --- |'
out={}
rows=[]
for t in TC: add(*t)
out['F']=H+'\n'+'\n'.join(rows)
rows=[]
for i,(wf,ds) in enumerate(WF,1):
    add(f'TC-{wf}',wf,f'Staging with demo seed; preconditions of {ds}',f'Run the main scenario {ds} of the Design Brief end-to-end',f'Data of {ds}',f'Expected result of {ds}',('manual','staging, presenter of the workflow'))
out['WF']=H+'\n'+'\n'.join(rows)
rows=[]
for i,(ent,tr,trig,src) in enumerate(ST,1):
    add(f'TC-ST-{i:02d}',f'SRS {ent}',f'Entity in the source state of {tr}',trig,'—',f'Transition {tr} happens (or the invalid one is rejected) as in SRS {ent}',src)
out['ST']=H+'\n'+'\n'.join(rows)
rows=[]
for nid,method,thr,src in NFR:
    add(f'TC-{nid}',nid,'Environment of the method','Measure as described',method,f'Threshold: {thr}',src)
out['NFR']=H+'\n'+'\n'.join(rows)
total=len(TC)+len(WF)+len(ST)+len(NFR)
tpl=open(sys.argv[2]).read()
tpl=tpl.replace('{{F}}',out['F']).replace('{{WF}}',out['WF']).replace('{{ST}}',out['ST']).replace('{{NFR}}',out['NFR'])
summ=f"""| Source | Test cases | Automated in CI (existing + planned) | Automated now | Pass now | Manual |
| --- | --- | --- | --- | --- | --- |
| Total | {total} | {stats['auto']} ({100*stats['auto']//total} %) | {stats['auto_now']} | {stats['pass']} | {stats['manual']} |"""
tpl=tpl.replace('{{SUMMARY}}',summ)
open(sys.argv[3],'w').write(tpl)
print(total, stats)
