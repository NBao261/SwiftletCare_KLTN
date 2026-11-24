"""Build registration form v3 (Word) from registration-v3.md, using the v2 Word file as the template.

The Markdown is the only source of the text: sections A–E, 3.2 and 4 of the v2 file are replaced
by the paragraphs of the Markdown, each cloned from the v2 paragraph of the same kind so the
form keeps its layout. The v2 file holds the members' phone numbers, so it stays outside the
repository and the phone cells of the output are emptied; add them to the copy that is submitted.

Usage: python3 docs/reports/tools/make_registration_v3.py <v2.docx> <out.docx>
"""
import copy, os, re, sys, docx
SRC, OUT = sys.argv[1], sys.argv[2]
MD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'registration-v3.md')
d = docx.Document(SRC)
P = d.paragraphs

# template paragraphs of the v2 form, by kind (indices of the v2 file)
T = {k: copy.deepcopy(P[i]._p) for k, i in {
    'head': 18,      # "A. Context:"                      Heading 3, one run
    'plain': 19,     # body text of A and B               Heading 3, one run
    'numhead': 24,   # "Autonomous Micro-Climate Control:" numbered, one run
    'sub': 31,       # "1. System (...)"                  Heading 3, one run
    'numlabel': 32,  # "Label: body" in C                 numbered, two runs
    'label': 55,     # "Flow 1: ...: body" in D and E     two runs
    'sec32': 71,     # "3.2. Main proposal content ..."
    'bold': 72,      # "a) Theory and practice (document):"
    'list': 73,      # bullet of 3.2
    'normal': 85,    # "Task n: ..."
    'sec4': 91,      # paragraph of section 4
}.items()}
START, SEC4, END = P[17], P[90], 101   # body = 18..89, section 4 body = 91..END


def clean(t):
    return re.sub(r'\*\*|`', '', t).strip()


def parse(md):
    """(kind, label, text) for every paragraph of sections A–E, 3.2 and 4."""
    body, sec4, part, sect = [], [], None, ''
    for line in md.splitlines():
        s = line.strip()
        if s.startswith('### A. Context'):
            part = body
        if part is None or not s:
            continue
        if s.startswith('## 4.'):
            part = sec4
            continue
        if s.startswith('### 3.2.'):
            sect = '3.2'; part.append(('sec32', None, '    ' + s[4:])); continue
        if s.startswith('### '):
            sect = s[4]; part.append(('head', None, s[4:] + ':')); continue
        if s.startswith('#### '):
            t = s[5:]; part.append(('sub', None, t if t.endswith(':') else t + ':')); continue
        if part is sec4:
            part.append(('sec4', None, clean(s))); continue
        m = re.fullmatch(r'\*\*(.+?:)\*\*(.*)', s)
        if sect == '3.2':
            if m and not m.group(2).strip():
                part.append(('bold', None, m.group(1)))
            elif s.startswith('- '):
                part.append(('list', None, clean(s[2:])))
            else:
                part.append(('normal', None, clean(s)))
        elif m and not m.group(2).strip():
            part.append(('numhead', None, m.group(1)))
        elif m:
            part.append(('numlabel' if sect == 'C' else 'label', m.group(1), clean(m.group(2))))
        else:
            part.append(('plain', None, clean(s)))
    return body, sec4


def insert_after(ref, items):
    for kind, label, text in items:
        el = copy.deepcopy(T[kind]); ref._p.addnext(el)
        ref = docx.text.paragraph.Paragraph(el, ref._parent)
        runs = ref.runs
        if label is None:
            runs[0].text = text
            for r in runs[1:]: r.text = ''
        else:
            runs[0].text = label; runs[1].text = ' ' + text
            for r in runs[2:]: r.text = ''
    return ref


body, sec4 = parse(open(MD, encoding='utf-8').read())
old = P[18:90] + P[91:END + 1]
insert_after(START, body)
insert_after(SEC4, sec4)
for p in old:
    p._p.getparent().remove(p._p)

# number the students 1..n (the v2 file has gaps in this column)
for n, row in enumerate(d.tables[1].rows[1:], 1):
    p_ = row.cells[0].paragraphs[0]
    (p_.runs[0] if p_.runs else p_.add_run()).text = str(n)
    for r in p_.runs[1:]: r.text = ''
# drop phone numbers (personal data stays out of the repository)
for t in d.tables:
    for row in t.rows:
        for c in row.cells:
            for p in c.paragraphs:
                if re.fullmatch(r'\s*0\d{9}\s*', p.text):
                    for r in p.runs: r.text = ''
d.save(OUT)
print(len(body), 'paragraphs in sections A–3.2,', len(sec4), 'in section 4')
