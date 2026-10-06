#!/usr/bin/env python3
"""Bundle the static workshop into one HTML file that works without a server."""
import argparse
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', default='network-workshop-offline.html')
parser.add_argument('--page', choices=['foundation','campus'], default='foundation')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
static = root / 'dist'
campus = args.page == 'campus'
page_name = 'campus.html' if campus else 'index.html'
css_name = 'campus.css' if campus else 'styles.css'
entry_name = 'campus.js' if campus else 'app.js'
html = (static / page_name).read_text(encoding='utf-8')
css = (static / css_name).read_text(encoding='utf-8')
scripts = []
for name in (['campus-lessons.js','campus-model.js','campus.js'] if campus else ['lessons.js', 'model.js', 'study.js', 'app.js']):
    source = (static / name).read_text(encoding='utf-8')
    source = re.sub(r'^import .*?;\s*$', '', source, flags=re.MULTILINE)
    source = re.sub(r'^export ', '', source, flags=re.MULTILINE)
    scripts.append(source)
javascript = '\n\n'.join(scripts).replace('</script', '<\\/script')
html = re.sub(r'<link rel="stylesheet" href="\./' + re.escape(css_name) + r'(?:\?[^"]*)?">', lambda _: '<style>\n' + css + '\n</style>', html)
html = re.sub(r'<script type="module" src="\./' + re.escape(entry_name) + r'(?:\?[^"]*)?"></script>', lambda _: '<script type="module">\n' + javascript + '\n</script>', html)
html = html.replace('href="./" aria-label="网络动画实验室首页"', 'href="#" aria-label="网络动画实验室首页"')
html = html.replace('href="./campus.html"', 'href="./校园网络授权-学习网站.html"')
html = html.replace('href="./index.html"', 'href="./网络动画实验室-离线版.html"')
output = Path(args.output).expanduser().resolve()
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html, encoding='utf-8')
print(f'Offline HTML saved: {output}')
