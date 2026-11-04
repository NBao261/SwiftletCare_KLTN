"""Fill form BM02 from docs/reports/bm02-self-review.md.

Usage (repository root): python3 docs/reports/tools/make_bm02.py
"""
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPORTS=os.path.dirname(HERE)
import docx
from docxfill import *
from md_tables import tables
d=docx.Document(os.path.join(REPORTS,'templates','SWP490_R2_BM02_Self_Review_Report.docx'))
t=tables(os.path.join(REPORTS,'bm02-self-review.md'))
info,findings,top,summary=(rows[1:] for _,rows in t)
set_kv(d.tables[0], {k:v for k,v in info})
fill_table(d.tables[2], findings)
fill_table(d.tables[3], top)
for row in d.tables[4].rows[1:]:
    vals=next(r for r in summary if r[0]==row.cells[0].text.strip())
    for c,v in zip(row.cells[1:], vals[1:]): set_cell(c, v)
drop_grey(d)
d.save(os.path.join(REPORTS,'registration','SWP490_R2_BM02_Self_Review_Report_SwiftletCare.docx'))
