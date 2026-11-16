"""Collect signed updater artifacts without modifying the signed bytes."""
import json
import pathlib
import shutil
import sys
from datetime import datetime, timezone
from urllib.parse import quote

root = pathlib.Path(__file__).resolve().parents[1]
out = root / 'release-upload'
out.mkdir(exist_ok=True)
config = json.loads((root / 'src-tauri/tauri.conf.json').read_text(encoding='utf-8-sig'))
version = config['version']
mode = sys.argv[1]
platforms = {'x86_64-pc-windows-msvc': 'windows-x86_64', 'x86_64-apple-darwin': 'darwin-x86_64', 'aarch64-apple-darwin': 'darwin-aarch64'}
if mode == 'manifest':
    tag = sys.argv[2]
    assert tag == 'v' + version, 'Tag and app version differ'
    assert json.loads((root / 'package.json').read_text(encoding='utf-8-sig'))['version'] == version
    entries = {}
    for target, platform in platforms.items():
        entry = json.loads((out / f'{target}.json').read_text())
        assert entry['version'] == version and (out / entry['file']).is_file()
        assert entry['signature'].strip()
        entries[platform] = {'signature': entry['signature'], 'url': f'https://github.com/b1inkie/dst_tool_swapfit/releases/download/{tag}/{quote(entry["file"])}'}
    notes = (root / 'docs/release-notes.md').read_text(encoding='utf-8')
    (out / 'latest.json').write_text(json.dumps({'version': version, 'notes': notes, 'pub_date': datetime.now(timezone.utc).isoformat(), 'platforms': entries}, ensure_ascii=False, indent=2), encoding='utf-8')
    for target in platforms:
        (out / f'{target}.json').unlink()
else:
    target = mode
    assert target in platforms
    bundle = root / 'src-tauri/target' / target / 'release/bundle'
    candidates = list(bundle.glob('nsis/*.exe')) if target.endswith('msvc') else list(bundle.glob('macos/*.app.tar.gz'))
    assert len(candidates) == 1, f'Expected exactly one updater package, got {candidates}'
    package = candidates[0]
    signature = pathlib.Path(str(package) + '.sig').read_text().strip()
    assert signature
    extension = '.exe' if target.endswith('msvc') else '.app.tar.gz'
    name = f'DST-SwapFit-{version}-{platforms[target]}{extension}'
    shutil.copyfile(package, out / name)
    (out / (name + '.sig')).write_text(signature, encoding='utf-8')
    for dmg in bundle.glob('dmg/*.dmg'):
        shutil.copyfile(dmg, out / f'DST-SwapFit-{version}-{platforms[target]}.dmg')
    (out / f'{target}.json').write_text(json.dumps({'version': version, 'file': name, 'signature': signature}), encoding='utf-8')
    print(f'Collected signed {platforms[target]} package')
