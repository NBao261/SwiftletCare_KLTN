import re
def tables(path):
    """Markdown tables of a file, as lists of rows (header first), keyed by the nearest heading."""
    out=[]; cur=None; head=''
    for line in open(path, encoding='utf-8'):
        line=line.rstrip('\n')
        if line.startswith('#'): head=line.lstrip('# ').strip()
        if line.startswith('|'):
            cells=[c.strip() for c in re.split(r'(?<!\\)\|', line.strip())[1:-1]]
            if all(re.fullmatch(r':?-{3,}:?', c) for c in cells): continue
            cells=[re.sub(r'\*\*|`','',c).replace('\\|','|') for c in cells]
            if cur is None: cur=(head,[]); out.append(cur)
            cur[1].append(cells)
        else: cur=None
    return out
