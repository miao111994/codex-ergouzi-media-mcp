import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = 'https://registry.npmjs.org';
const osvEndpoint = 'https://api.osv.dev/v1/querybatch';

function run(command, args) {
  return new Promise((resolve) => {
    const windows = process.platform === 'win32';
    const executable = windows ? (process.env.ComSpec || 'cmd.exe') : command;
    const executableArgs = windows ? ['/d', '/s', '/c', command, ...args] : args;
    const child = spawn(executable, executableArgs, { cwd: root, shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` }));
  });
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function packageEntries(lockfile) {
  const entries = new Map();
  for (const [location, info] of Object.entries(lockfile.packages || {})) {
    if (!location.startsWith('node_modules/') || !info?.version) continue;
    const marker = location.lastIndexOf('node_modules/') + 'node_modules/'.length;
    const name = location.slice(marker);
    entries.set(`${name}@${info.version}`, { name, version: info.version });
  }
  return [...entries.values()];
}

async function queryOsv(packages) {
  const results = [];
  for (let offset = 0; offset < packages.length; offset += 100) {
    const batch = packages.slice(offset, offset + 100);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('OSV request timed out')), 30000);
    try {
      const response = await fetch(osvEndpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: batch.map(({ name, version }) => ({ package: { name, ecosystem: 'npm' }, version })),
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`OSV returned HTTP ${response.status}`);
      const payload = await response.json();
      results.push(...(payload.results || []).map((item, index) => ({ package: batch[index], vulns: item.vulns || [] })));
    } finally {
      clearTimeout(timer);
    }
  }
  return results;
}

const forceOsv = process.env.ERGOUZI_AUDIT_FORCE_OSV === '1';
const native = forceOsv
  ? { code: 1, stdout: '', stderr: 'forced OSV fallback' }
  : await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
      'audit', '--json', '--omit=dev', `--registry=${registry}`,
    ]);
const nativeJson = parseJson(native.stdout);
if (nativeJson?.metadata || nativeJson?.vulnerabilities) {
  process.stdout.write(native.stdout);
  process.exitCode = native.code;
} else {
  const reason = (native.stderr || native.stdout).trim().split(/\r?\n/).slice(-1)[0] || 'npm audit endpoint unavailable';
  console.warn(`npm audit unavailable (${reason}); falling back to OSV Scanner API.`);
  const lockfile = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
  const packages = packageEntries(lockfile);
  try {
    const findings = (await queryOsv(packages)).flatMap(({ package: packageInfo, vulns }) =>
      vulns.map((vulnerability) => ({ packageInfo, vulnerability })),
    );
    if (findings.length > 0) {
      for (const { packageInfo, vulnerability } of findings) {
        const severity = vulnerability.database_specific?.severity || vulnerability.severity?.[0]?.score || 'unknown';
        console.error(`${packageInfo.name}@${packageInfo.version}: ${vulnerability.id} (${severity})`);
      }
      process.exitCode = 1;
    } else {
      console.log(`OSV audit passed: scanned ${packages.length} npm packages.`);
    }
  } catch (error) {
    console.error(`OSV fallback failed: ${error.message}`);
    process.exitCode = 2;
  }
}
