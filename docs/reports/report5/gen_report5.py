"""Generate Report 5 from tc.py.

Usage (from the repository root):
  python3 docs/reports/report5/gen_report5.py docs/reports/report5/template.md docs/reports/report5-test.md [--jest jest.json] [--pio pio-junit.xml] [--pytest pytest-junit.xml]

Every automated case is checked to exist in the test sources. Without result files it is reported
"Not run on the tag". With the reports of the CI run on the tag, backend cases get Pass/Fail from
the Jest JSON report (npx jest --json --outputFile=jest.json) and firmware cases from the
PlatformIO JUnit report (pio test -e native --junit-output-path pio-junit.xml) and AI-pipeline
cases from the pytest JUnit report (pytest --junitxml=pytest-junit.xml). CI uploads all three
as artifacts of the run on a review-* tag.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tc import TC, WF, ST, NFR, FEATURES, VERIFIES, NFR_VERIFIES
import re
import xml.etree.ElementTree as ET
ROOT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','..'))
opts=dict(zip(sys.argv[3::2], sys.argv[4::2]))
res=None
if '--jest' in opts:
    res={}
    for f in json.load(open(opts['--jest'],encoding='utf-8'))['testResults']:
        name=f['name'].replace('\\','/').split('/backend/')[-1]
        for a in f['assertionResults']:
            res.setdefault(name,[]).append((a['title'].lower(), a['status']))
def junit(path):
    out={}
    for tc in ET.parse(path).getroot().iter('testcase'):
        failed=any(c.tag in ('failure','error','skipped') for c in tc)
        out[(tc.get('classname') or '')+'::'+(tc.get('name') or '')]='Fail' if failed else 'Pass'
    return out
pio=junit(opts['--pio']) if '--pio' in opts else None
pyt=junit(opts['--pytest']) if '--pytest' in opts else None
def from_junit(results, suite, name, how):
    if results is None: return 'Not run on the tag', how
    hits=[v for k,v in results.items() if suite in k.split('::')[0] and k.endswith('::'+name)]
    assert hits, ('no junit result', suite, name)
    return ('Pass' if all(h=='Pass' for h in hits) else 'Fail'), how
def exists(path, text):
    if os.path.isdir(path):
        files=[os.path.join(dp,f) for dp,_,fs in os.walk(path) for f in fs]
    else:
        files=[path]
    return any(text in open(f,encoding='utf-8').read() for f in files)
def actual(src):
    if isinstance(src,list):
        parts=[actual(x) for x in src]
        res_=[a for a,_ in parts]
        a='Pass' if all(x=='Pass' for x in res_) else ('Fail' if 'Fail' in res_ else res_[0])
        return a, ' + '.join(h for _,h in parts)
    kind=src[0]
    if kind=='jest':
        assert exists(os.path.join(ROOT,'backend',src[1]),src[2]), ('no jest test', src)
        how=f"Auto (CI) – backend Jest `{src[1]}` › “{src[2]}”"
        if res is None: return 'Not run on the tag', how
        hits=[st for t,st in res.get(src[1],[]) if src[2].lower() in t]
        assert hits, ('no jest result', src)
        return ('Pass' if all(h=='passed' for h in hits) else 'Fail'), how
    if kind=='pio':
        assert exists(os.path.join(ROOT,'firmware','test',src[1]),src[2]), ('no pio test', src)
        return from_junit(pio, src[1], src[2], f"Auto (CI) – firmware `pio test -e native` `{src[1]}` › `{src[2]}`")
    if kind=='pytest':
        assert exists(os.path.join(ROOT,'ai-pipeline','tests',src[1]+'.py'),'def '+src[2]), ('no pytest test', src)
        return from_junit(pyt, src[1], src[2], f"Auto (CI) – AI pipeline `pytest` `tests/{src[1]}.py` › `{src[2]}`")
    if kind=='todo-auto':
        return 'Not run – test to be written', f"Auto (CI, to be written) – {src[1]}"
    return 'Not run', f"Manual – {src[1]}"
rows=[]; stats={'written':0,'todo':0,'manual':0,'pass':0}
def add(id_,ref,pre,steps,data,exp,src):
    a,run=actual(src)
    k=src[0] if not isinstance(src,list) else ('todo-auto' if any(x[0]=='todo-auto' for x in src) else src[0][0])
    stats[{'jest':'written','pio':'written','pytest':'written','todo-auto':'todo','manual':'manual'}[k]]+=1
    if a=='Pass': stats['pass']+=1
    esc=lambda x: x.replace('|','\\|')
    rows.append('| '+' | '.join(esc(x) for x in [id_,ref,pre,steps,data,exp,run,a])+' |')
H='| ID | Feature / workflow | Preconditions | Steps | Data | Expected result | How it runs | Actual result |\n| --- | --- | --- | --- | --- | --- | --- | --- |'
out={}
rows=[]
for t in TC: add(*t)
HF='| ID | Feature / workflow | Requirements verified | Preconditions | Steps | Data | Expected result | How it runs | Actual result |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
rows=[' | '.join(r.split(' | ',2)[:2]+[VERIFIES[t[0]], r.split(' | ',2)[2]]) for r,t in zip(rows,TC)]
out['F']=HF+'\n'+'\n'.join(rows)
rows=[]
for wf,ds in WF:
    add(f'TC-{wf}',wf,f'Staging with demo seed; preconditions of {ds}',f'Run the main scenario {ds} of the Design Brief end-to-end',f'Data of {ds}',f'Expected result of {ds}',('manual','staging, presenter of the workflow'))
out['WF']=H+'\n'+'\n'.join(rows)
xrows=['| Scenario | Workflow | How it runs | Actual result |','| --- | --- | --- | --- |']
for wf,ds in WF:
    x='DS-%02d'%(int(ds[3:])+1)
    xrows.append(f'| {x} (exception) | {wf} | Manual – staging, presenter of the workflow | Not run |')
out['WFX']='\n'.join(xrows)
rows=[]
for i,(ent,tr,trig,exp,src) in enumerate(ST,1):
    add(f'TC-ST-{i:02d}',f'SRS {ent}',f'Entity in the source state of {tr}',trig,'—',exp,src)
out['ST']=H+'\n'+'\n'.join(rows)
rows=[]
for nid,method,thr,src in NFR:
    add(f'TC-{nid}',nid,'Environment of the method','Measure as described',method,f'Threshold: {thr}',src)
out['NFR']=H+'\n'+'\n'.join(rows)
total=len(TC)+len(WF)+len(ST)+len(NFR)
# requirement coverage: a mandatory FR is "verified" when a committed feature or NFR case checks it (VERIFIES, NFR_VERIFIES),
# otherwise only "traced" to the end-to-end test of the workflow whose FR list holds it; every FR must be at least traced
def expand(txt):
    out=[]; pre=None
    for part in re.split(r',\s*', re.sub(r'\([^)]*\)','',txt)):
        part=part.strip()
        m=re.match(r'([A-Z]+-FR-)?(\w+?)(?:…(\w+))?$',part)
        if not m: continue
        if m.group(1): pre=m.group(1)
        if pre is None: continue
        if m.group(3):
            for n in range(int(m.group(2)),int(m.group(3))+1): out.append(f'{pre}{n:03d}')
        else: out.append(pre+m.group(2))
    return out
srs=open(os.path.join(ROOT,'docs','reports','report3-srs.md'),encoding='utf-8').read()
mand=[m.group(1) for m in re.finditer(r'^\| ([A-Z]+-FR-\w+) \|.*\| M \|$',srs,re.M)]
flows={}
for m in re.finditer(r'^\| (MF-\d\d) \|(.*)\|$',srs,re.M):
    for fr in expand(m.group(2).split('|')[-1]): flows.setdefault(fr,[]).append('WF-'+m.group(1)[3:])
by_case={}
for tc,frs in list(VERIFIES.items())+list(NFR_VERIFIES.items()):
    for fr in expand(frs): by_case.setdefault(fr,[]).append(tc)
cov=['| Requirement | Verified by (committed case with steps and expected result) | Traced to (end-to-end test of its workflow) |','| --- | --- | --- |']
only_wf=0
for fr in mand:
    assert fr in by_case or fr in flows, ('mandatory FR without any test', fr)
    if fr not in by_case: only_wf+=1
    cov.append(f"| {fr} | {', '.join(by_case.get(fr,[])) or '— (traced only)'} | {', '.join('TC-'+w for w in flows.get(fr,[])) or '—'} |")
out['COVERAGE']='\n'.join(cov)
out['COVSUM']=f'{len(mand)} mandatory requirements: {len(mand)-only_wf} are verified by a committed feature or NFR case; {only_wf} are only traced to the end-to-end test of their workflow, which exercises the flow but does not check each of their acceptance criteria.'
tpl=open(sys.argv[1],encoding='utf-8').read()
for k,v in out.items(): tpl=tpl.replace('{{'+k+'}}',v)
feat=['| Feature | Name | Requirements |','| --- | --- | --- |']+[f'| {a} | {b} | {c} |' for a,b,c in FEATURES]
tpl=tpl.replace('{{FEATURES}}','\n'.join(feat))
tpl=tpl.replace('{{NST}}',str(len(ST))).replace('{{TOTAL}}',str(total))
auto=stats['written']+stats['todo']
summ=f"""| Test cases | Automated, test written | Automated, to be written | Manual | Passed on the tag |
| --- | --- | --- | --- | --- |
| {total} | {stats['written']} ({100*stats['written']//total} %) | {stats['todo']} (automated in total: {auto}, {100*auto//total} %) | {stats['manual']} | {stats['pass'] if (res is not None or pio is not None or pyt is not None) else '— (no run on the tag yet)'} |"""
tpl=tpl.replace('{{SUMMARY}}',summ)
open(sys.argv[2],'w',encoding='utf-8').write(tpl)
print(total, stats)
