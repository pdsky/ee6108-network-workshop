#!/usr/bin/env python3
"""Copy the repository's unchanged Packet Tracer lab files to the static site."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parents[1]
source = root / 'labs/campus_authorization'
target = root / 'dist/labs/campus_authorization'
target.parent.mkdir(parents=True, exist_ok=True)
shutil.copytree(source, target, dirs_exist_ok=True)
print(f'Prepared {len(list(source.iterdir()))} lab assets in {target}')
