import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temp:
    fixture = pathlib.Path(temp)
    for directory in ['scripts', 'docs', 'src-tauri', 'release-upload']:
        (fixture / directory).mkdir()
    for name in ['scripts/collect-release.py', 'docs/release-notes.md', 'src-tauri/tauri.conf.json', 'package.json']:
        shutil.copyfile(root / name, fixture / name)
    version = json.loads((fixture / 'package.json').read_text(encoding='utf-8-sig'))['version']
    for target in ['x86_64-pc-windows-msvc', 'x86_64-apple-darwin', 'aarch64-apple-darwin']:
        (fixture / 'release-upload' / (target + '.json')).write_text(json.dumps({'version': version, 'file': target + '.bin', 'signature': 'test-only'}))
        (fixture / 'release-upload' / (target + '.bin')).write_bytes(b'test')
    command = [sys.executable, str(fixture / 'scripts/collect-release.py'), 'manifest']
    invalid = subprocess.run(command + ['v9.9.9'], capture_output=True)
    assert invalid.returncode != 0, 'Version mismatch accepted'
    subprocess.run(command + ['v' + version], check=True)
    manifest = json.loads((fixture / 'release-upload/latest.json').read_text(encoding='utf-8'))
    assert set(manifest['platforms']) == {'windows-x86_64', 'darwin-x86_64', 'darwin-aarch64'}
    assert all('/releases/download/v' + version + '/' in p['url'] for p in manifest['platforms'].values())
    print('PASS: all three updater platforms, immutable version URLs, mismatched tag rejected')
