"""Fill form BM02 from docs/reports/bm02-self-review.md.

Usage (repository root): python3 docs/reports/tools/make_bm02.py
"""
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPORTS=os.path.dirname(HERE)
import copy, re
import docx
from docx.table import Table
from docxfill import *
from md_tables import tables
MD=os.path.join(REPORTS,'bm02-self-review.md')
d=docx.Document(os.path.join(REPORTS,'templates','SWP490_R2_BM02_Self_Review_Report.docx'))
t=tables(MD)
info,findings,top,summary,english=(rows[1:] for _,rows in t)
# Section 6 (team's English translation) is not in the form: added after section 5, table styled like section 4
appendix=open(MD,encoding='utf-8').read().split('## 6. ')[1]
title,note=[l for l in appendix.splitlines() if l.strip()][:2]
tr=copy.deepcopy(d.tables[3]._tbl)
set_kv(d.tables[0], {k:v for k,v in info})
fill_table(d.tables[2], findings)
fill_table(d.tables[3], top)
for row in d.tables[4].rows[1:]:
    vals=next(r for r in summary if r[0]==row.cells[0].text.strip())
    for c,v in zip(row.cells[1:], vals[1:]): set_cell(c, v)
drop_grey(d)
head=copy.deepcopy(next(p for p in d.paragraphs if p.text.startswith('5. '))._p)
body=d.element.body
body.insert(len(body)-1, head)  # at the end, before the section properties
h=d.paragraphs[-1]
for r in h.runs[1:]: r._r.getparent().remove(r._r)
h.runs[0].text='6. '+title
d.add_paragraph(re.sub(r'`','',note))
d.paragraphs[-1]._p.addnext(tr)
en=Table(tr, d._body)
for c,v in zip(en.rows[0].cells, ['ID','Finding (English)','Evidence (English)']): set_cell(c, v)
fill_table(en, english)
d.save(os.path.join(REPORTS,'registration','SWP490_R2_BM02_Self_Review_Report_SwiftletCare.docx'))
