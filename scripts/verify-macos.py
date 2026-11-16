"""Native CI smoke test, not interactive editing/installation acceptance."""
import hashlib
import pathlib
import subprocess
import sys
import tarfile
import time

root = pathlib.Path(__file__).resolve().parents[1]
target = sys.argv[1]
folder = root / 'src-tauri' / 'target' / target / 'release' / 'bundle' / 'macos'
app = folder / 'DST SwapFit.app'
exe = app / 'Contents/MacOS/dst-swapfit'
expected_arch = 'arm64' if target == 'aarch64-apple-darwin' else 'x86_64'
arch = subprocess.check_output(['lipo', '-archs', str(exe)], text=True).strip()
assert arch == expected_arch, (arch, expected_arch)
source = root / 'data/resources'
resources = app / 'Contents/Resources/resources'
files = [p for p in source.rglob('*') if p.is_file()]
assert files
for original in files:
    installed = resources / original.relative_to(source)
    assert installed.is_file(), installed
    assert hashlib.sha256(original.read_bytes()).digest() == hashlib.sha256(installed.read_bytes()).digest(), installed
subprocess.run(['codesign', '--verify', '--deep', '--strict', '--verbose=2', str(app)], check=True)
# Execute from /tmp, proving startup does not rely on the repository cwd.
with (root / 'macos-smoke.log').open('w') as log:
    process = subprocess.Popen([str(exe)], cwd='/tmp', stdout=log, stderr=subprocess.STDOUT)
    try:
        time.sleep(12)
        assert process.poll() is None, f'App exited early: {process.returncode}; inspect macos-smoke.log'
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
with tarfile.open(folder / 'DST SwapFit.app.tar.gz', 'w:gz') as archive:
    archive.add(app, arcname=app.name)
print(f'PASS: {arch}, {len(files)} resource hashes, ad-hoc signature, 12-second launch smoke test')
