"""Fill form BM02, in English, from docs/reports/bm02-self-review.md.

The Markdown keeps the AI's original findings (Vietnamese, sections 3-4) and the team's English
translation (section 6). The Word form takes the translation and says so under the headings of sections 3 and 4.

Usage (repository root): python3 docs/reports/tools/make_bm02.py
"""
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPORTS=os.path.dirname(HERE)
import docx
from docxfill import *
from md_tables import tables
d=docx.Document(os.path.join(REPORTS,'templates','SEP490_R2_BM02_Self_Review_Report.docx'))
info,findings,top,summary,english=(rows[1:] for _,rows in tables(os.path.join(REPORTS,'bm02-self-review.md')))
en={r[0]:r[1:] for r in english}
LOCATION_EN={'Index trong script':'Indexes in the script'}
rows=[]
for fid,cat,loc,_,sev,_,resp in findings:
    finding,evidence=en[fid]
    rows.append([fid,cat,LOCATION_EN.get(loc,loc),finding,sev,evidence,resp])
set_kv(d.tables[0], {k:v for k,v in info})
fill_table(d.tables[2], rows)
fill_table(d.tables[3], [[n,ids,en['Top '+n][0]] for n,ids,_ in top])
for row in d.tables[4].rows[1:]:
    vals=next(r for r in summary if r[0]==row.cells[0].text.strip())
    for c,v in zip(row.cells[1:], vals[1:]): set_cell(c, v)
# Long file names would let Word widen the 7 columns past the margin: fix the layout and the widths (17 cm)
from docx.shared import Cm
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
ft=d.tables[2]
lay=OxmlElement('w:tblLayout'); lay.set(qn('w:type'),'fixed'); ft._tbl.tblPr.append(lay)
for col,w in zip(ft.columns,[1.3,2.5,2.1,3.8,1.5,2.2,3.6]):
    for c in col.cells: c.width=Cm(w)
drop_grey(d)
NOTE=('The AI answered in Vietnamese (the repository instructs the agent to reply in Vietnamese). '
      'Findings and evidence below are the team\'s English translation, with no finding added, removed or changed; '
      'the original output is kept in docs/reports/bm02-self-review.md and at '
      'https://claude.ai/artifact/XgyuRWSy37JLCUyETGmEor.')
for p in [p for p in d.paragraphs if p.text.startswith(('3. ','4. '))]:
    new=p.insert_paragraph_before('')  # a plain body paragraph, moved below the heading
    new.add_run(NOTE if p.text.startswith('3. ') else 'Translated by the team from the AI\'s Vietnamese output (see the note in section 3).')
    p._p.addnext(new._p)
d.save(os.path.join(REPORTS,'registration','SEP490_R2_BM02_Self_Review_Report_SwiftletCare.docx'))
