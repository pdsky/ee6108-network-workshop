#!/usr/bin/env python3
"""Bundle the static workshop into one HTML file that works without a server."""
import argparse
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', default='network-workshop-offline.html')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
static = root / 'dist'
html = (static / 'index.html').read_text(encoding='utf-8')
css = (static / 'styles.css').read_text(encoding='utf-8')
scripts = []
for name in ['lessons.js', 'model.js', 'study.js', 'app.js']:
    source = (static / name).read_text(encoding='utf-8')
    source = re.sub(r'^import .*?;\s*$', '', source, flags=re.MULTILINE)
    source = re.sub(r'^export ', '', source, flags=re.MULTILINE)
    scripts.append(source)
javascript = '\n\n'.join(scripts).replace('</script', '<\\/script')
html = html.replace('<link rel="stylesheet" href="./styles.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<script type="module" src="./app.js"></script>', '<script type="module">\n' + javascript + '\n</script>')
html = html.replace('href="./" aria-label="网络动画实验室首页"', 'href="#" aria-label="网络动画实验室首页"')
output = Path(args.output).expanduser().resolve()
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html, encoding='utf-8')
print(f'Offline HTML saved: {output}')
