// No customer requests, auth, or payments. No response bodies/URLs with secrets are logged.
const origin = 'https://scoutcard.vercel.app';
const checks = [['/', 'SCOUTCARD'], ['/activate.html', 'SCOUTCARD'], ['/api/health', '"status":"ok"']];
let failures = 0;
for (const [path, marker] of checks) {
  try {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok || !(await response.text()).includes(marker)) throw new Error('Unexpected response');
    console.log('PASS', path);
  } catch {
    failures++; console.error('FAIL', path);
  }
}
if (failures) process.exitCode = 1;
