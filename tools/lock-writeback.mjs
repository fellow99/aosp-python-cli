#!/usr/bin/env node
/*
 * tools/lock-writeback.mjs —— lock 回写物生成（002-building-workflow FR-002-007）
 *
 * 读取真实构建产物（libpython_cli.so 的 size/sha256）与 BUILD-METADATA.txt（ndk/flags），
 * 生成「回写后的 lock 全文 + 统一 diff」到 --out-dir，供维护者以 PR 合入
 * （本工具**永不**直接修改仓库的 python-cli.lock.json —— C2：回写是维护者动作；
 *   M4 再评估自动化）。
 *
 * 回写四值 + 状态：size / sha256 / builtFrom.ndk / builtFrom.flags + status="released"。
 *
 * 用法：
 *   node tools/lock-writeback.mjs --from <libpython_cli.so> --build-meta <BUILD-METADATA.txt>
 *                                [--version <ver>] [--lock <path>] [--out-dir <dir>]
 *
 * 退出码：0 成功 · 1 用法/IO 错误（lock 无对应 release、产物缺失等）
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function argOf(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function die(msg) {
  process.stderr.write(`[lock-writeback] 失败：${msg}\n`);
  process.exit(1);
}
function say(msg) {
  process.stdout.write(`[lock-writeback] ${msg}\n`);
}

const from = argOf('--from');
const buildMeta = argOf('--build-meta');
const wantVersion = argOf('--version');
const lockPath = argOf('--lock') ?? path.join(ROOT, 'python-cli.lock.json');
const outDir = argOf('--out-dir') ?? path.join(ROOT, '.dist', 'writeback');

if (!from || !buildMeta || args.includes('--help')) {
  process.stderr.write(
    '用法: node tools/lock-writeback.mjs --from <libpython_cli.so> --build-meta <BUILD-METADATA.txt> ' +
    '[--version <ver>] [--lock <path>] [--out-dir <dir>]\n',
  );
  process.exit(args.includes('--help') ? 0 : 1);
}
for (const p of [from, buildMeta, lockPath]) {
  if (!fs.existsSync(p)) die(`文件不存在：${p}`);
}

// ── 读入 ──
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const version = wantVersion ?? lock.active.version;
const abi = lock.active.abi;
const rel = lock.releases.find((x) => x.version === version && x.abi === abi);
if (!rel) die(`lock 无 version=${version} abi=${abi} 条目`);

const buf = fs.readFileSync(from);
const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
const size = buf.length;

const meta = {};
for (const line of fs.readFileSync(buildMeta, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([a-zA-Z]+)=(.*)$/);
  if (m) meta[m[1]] = m[2];
}
const ndk = meta.ndk && meta.ndk !== 'unknown' ? meta.ndk : rel.builtFrom?.ndk;
const flags = meta.flags || rel.builtFrom?.flags;

// ── 回写（内存副本）──
rel.size = size;
rel.sha256 = sha256;
if (rel.builtFrom) {
  rel.builtFrom.ndk = `${ndk} (pinned by first CI build ${meta.builtAt ?? ''})`.trim();
  rel.builtFrom.flags = flags;
}
rel.status = 'released';
rel.gates = rel.gates ?? {};
rel.gates.$note = 'keys mean "gate enabled"; values reflect provision --check pass at release time';

const newLockText = JSON.stringify(lock, null, 2) + '\n';
const oldLockText = fs.readFileSync(lockPath, 'utf8');

// ── 输出（不落库）──
fs.mkdirSync(outDir, { recursive: true });
const newLockPath = path.join(outDir, 'python-cli.lock.json');
fs.writeFileSync(newLockPath, newLockText);

let diff = '';
try {
  diff = execFileSync(
    'git',
    ['diff', '--no-index', '--', lockPath, newLockPath],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] },
  ).toString();
} catch (e) {
  diff = e.stdout?.toString() ?? ''; // git diff --no-index 在有差异时退出码为 1，属预期
}
fs.writeFileSync(path.join(outDir, 'python-cli.lock.diff'), diff);

say(`回写值：version=${version} size=${size} sha256=${sha256.slice(0, 16)}… status=released`);
say(`ndk=${ndk} flags=${flags}`);
say(`产物：${newLockPath}`);
say(`产物：${path.join(outDir, 'python-cli.lock.diff')}（维护者 PR 合入，工具不改仓库 lock）`);
