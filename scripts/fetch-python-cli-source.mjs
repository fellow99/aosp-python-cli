#!/usr/bin/env node
/*
 * scripts/fetch-python-cli-source.mjs —— 五源钉选获取（001-building FR-001-001…004）
 *
 * 五源：CPython 源码包 / OpenSSL / sqlite amalgamation / pip 官方 wheel / CA bundle。
 *
 * 纪律（宪法 C1/C2/C6）：
 *   - 钉选值（version/url/sha256）唯一出自 python-cli.lock.json releases[].builtFrom.deps，
 *     本脚本不持有任何版本事实；
 *   - sha256 空串 = 未钉选 ⇒ 拒绝执行（exit 1，逐项列出未钉键）；
 *     `--report-sha256` 是钉选引导模式：按 lock 的 url 下载并打印官方文件哈希，供维护者回写
 *     lock（本脚本永不写 lock）；
 *   - 可重入（FR-001-002）：目标文件已存在且哈希一致 ⇒ 跳过下载；哈希不一致 ⇒ exit 1
 *     （缓存污染信号，不自动重下）；
 *   - 不改源（C1）：只做下载/校验/解压/记录出处（FETCH-METADATA.json），无补丁步骤。
 *
 * 产物布局（默认 --out .dist/src）：
 *   <out>/downloads/<file>     五源原件（pip wheel/cacert 保留在此）
 *   <out>/cpython/             Python-<ver> 完整源码树（tgz 顶层目录归一化）
 *   <out>/openssl/             OpenSSL 源码树
 *   <out>/sqlite/              sqlite amalgamation（.c/.h）
 *   <out>/FETCH-METADATA.json  出处记录（url/version/sha256/size/时间）
 *
 * 外部工具：tar / unzip（解压用；ubuntu runner 与 Git Bash 均预装）。
 *
 * 退出码：0 成功 · 2 sha256 校验失败 · 1 用法/IO/未钉选/缓存污染错误
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_FILE = 'python-cli.lock.json';
const DEP_ORDER = ['cpython', 'openssl', 'sqlite', 'pip', 'cacert'];

const args = process.argv.slice(2);
function argOf(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function usage() {
  process.stderr.write(
    [
      '用法: node scripts/fetch-python-cli-source.mjs --python <CPython 版本> [--out <dir>]',
      '                         [--only cpython,openssl,sqlite,pip,cacert] [--force]',
      '                         [--report-sha256]',
      '  --python         CPython 版本（= CLI_VERSION；对应 lock releases[].version）',
      '  --out            工作目录（默认 .dist/src）',
      '  --only           只处理指定源（逗号分隔）',
      '  --force          忽略已下载缓存强制重下（默认哈希一致即跳过）',
      '  --report-sha256  钉选引导：按 lock url 下载并打印哈希表（不解压、不写元数据、不写 lock）',
    ].join('\n') + '\n',
  );
}

function say(msg) {
  process.stdout.write(`[fetch] ${msg}\n`);
}
function die(msg, code = 1) {
  process.stderr.write(`[fetch] 失败：${msg}\n`);
  process.exit(code);
}

function sha256File(p) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}

/** 下载（跟随重定向，≤6 跳）到临时文件后原子改名。 */
async function download(url, dest) {
  const { get } = await import('node:https');
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;

  const fetchOnce = (u, hops) =>
    new Promise((resolve, reject) => {
      if (hops > 6) return reject(new Error('重定向超过 6 跳'));
      const req = get(u, { timeout: 120_000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(fetchOnce(new URL(res.headers.location, u).toString(), hops + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} @ ${u}`));
        }
        const out = fs.createWriteStream(tmp);
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve()));
        out.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('下载超时（120s）')));
      req.on('error', reject);
    });

  try {
    await fetchOnce(url, 0);
    fs.renameSync(tmp, dest);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

function extractArchive(file, destDir, kind) {
  fs.rmSync(destDir, { recursive: true, force: true });
  const tmp = `${destDir}.__extract__`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  // Windows 注意：GNU tar 把绝对路径里的 `D:` 冒号解析为远程主机（tar 历史 host:file 语法）。
  // 统一以 tmp 为 cwd、传正斜杠相对路径，跨 Git Bash/Linux/macOS 都成立。
  const rel = path.relative(tmp, file).split(path.sep).join('/');
  try {
    if (kind === 'tgz') execFileSync('tar', ['-xzf', rel, '-C', '.'], { cwd: tmp, stdio: 'pipe' });
    else if (kind === 'zip') execFileSync('unzip', ['-qo', rel, '-d', '.'], { cwd: tmp, stdio: 'pipe' });
    else throw new Error(`未知归档类型: ${kind}`);
    // 顶层目录归一化：tgz/zip 内唯一顶层目录 → 直接改名
    const entries = fs.readdirSync(tmp);
    if (entries.length === 1 && fs.statSync(path.join(tmp, entries[0])).isDirectory()) {
      fs.renameSync(path.join(tmp, entries[0]), destDir);
      fs.rmSync(tmp, { recursive: true, force: true });
    } else {
      fs.renameSync(tmp, destDir);
    }
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(destDir, { recursive: true, force: true });
    throw new Error(`解压失败 ${path.basename(file)}：${e.message.split('\n')[0]}`);
  }
}

// ── 主流程 ──────────────────────────────────────────────────────────────────

const pyver = argOf('--python');
const outDir = argOf('--out') ?? path.join(ROOT, '.dist', 'src');
const reportMode = args.includes('--report-sha256');
const force = args.includes('--force');
const only = argOf('--only') ? argOf('--only').split(',').map((s) => s.trim()) : null;

if (args.includes('--help') || !pyver) {
  usage();
  process.exit(pyver ? 0 : 1);
}
for (const k of only ?? []) {
  if (!DEP_ORDER.includes(k)) die(`--only 含未知源：${k}（可用：${DEP_ORDER.join(',')}）`);
}

const lockPath = path.join(ROOT, LOCK_FILE);
if (!fs.existsSync(lockPath)) die(`缺 ${LOCK_FILE}`);
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const abi = lock.active?.abi ?? 'arm64-v8a';
const rel = lock.releases.find((x) => x.version === pyver && x.abi === abi);
if (!rel) {
  die(
    `${LOCK_FILE} 无 version=${pyver} abi=${abi} 的记录；现有：` +
    lock.releases.map((x) => `${x.version}/${x.abi}`).join(', '),
  );
}
const deps = rel.builtFrom?.deps;
if (!deps) die(`lock releases[builtFrom] 缺 deps 五源表（001-building FR-001-004）`);
for (const k of DEP_ORDER) {
  if (!deps[k]) die(`lock builtFrom.deps 缺 ${k} 项`);
}
const keys = DEP_ORDER.filter((k) => !only || only.includes(k));

const downloads = path.join(outDir, 'downloads');
fs.mkdirSync(downloads, { recursive: true });

// 计划表 + 未钉选检查
const unpinned = keys.filter((k) => !deps[k].sha256 || deps[k].sha256.length !== 64);
if (reportMode) {
  say(`钉选引导模式（--report-sha256）：以下哈希来自按 lock url 实际下载的官方文件；`);
  say(`请维护者核对后回写 ${LOCK_FILE} builtFrom.deps（本脚本不写 lock）。`);
} else if (unpinned.length) {
  die(
    `以下源 sha256 未钉选（空值）：${unpinned.join(', ')}。` +
    `先运行 --report-sha256 引导取值并由维护者回写 lock（C2/C6：不得以「先拿到什么」冒充钉选）。`,
  );
}

const results = [];
for (const key of keys) {
  const { url, sha256 } = deps[key];
  const file = path.join(downloads, path.basename(new URL(url).pathname));
  let actual;
  if (fs.existsSync(file) && !force) {
    actual = sha256File(file);
    if (sha256 && actual !== sha256) {
      die(`缓存污染：${file} 哈希与 lock 不一致（${actual.slice(0, 16)}… vs ${sha256.slice(0, 16)}…）。` +
        `清除该文件或用 --force 重下（不静默替换）`, 1);
    }
    say(`已缓存（哈希一致，跳过下载）：${path.basename(file)}`);
  } else {
    say(`下载：${url}`);
    try {
      await download(url, file);
    } catch (e) {
      die(`下载失败 ${url}：${e.message}`, 1);
    }
    actual = sha256File(file);
  }
  if (reportMode) {
    say(`pin> ${key}: version=${deps[key].version} sha256=${actual}`);
    results.push({ key, version: deps[key].version, url, sha256: actual, size: fs.statSync(file).size });
    continue;
  }
  if (actual !== sha256) {
    die(`SHA-256 校验失败：${path.basename(file)}\n  实际 ${actual}\n  锁定 ${sha256}`, 2);
  }
  say(`✔ ${key} ${deps[key].version}（sha256 一致，${fs.statSync(file).size} 字节）`);
  results.push({ key, version: deps[key].version, url, sha256: actual, size: fs.statSync(file).size, file });
}

if (reportMode) {
  say('— 引导完成。将上述 pin> 行回写 lock 后重跑（不带 --report-sha256）完成校验+解压。');
  process.exit(0);
}

// 解压（仅归档类源）
const extractPlan = [
  { key: 'cpython', kind: 'tgz', dest: path.join(outDir, 'cpython') },
  { key: 'openssl', kind: 'tgz', dest: path.join(outDir, 'openssl') },
  { key: 'sqlite', kind: 'zip', dest: path.join(outDir, 'sqlite') },
];
for (const p of extractPlan) {
  if (!keys.includes(p.key)) continue;
  const r = results.find((x) => x.key === p.key);
  say(`解压 ${p.key} → ${p.dest}`);
  extractArchive(r.file, p.dest, p.kind);
}

// FETCH-METADATA.json（出处记录，C1：无补丁步骤的事实凭证）
const meta = {
  generatedAt: new Date().toISOString(),
  python: pyver,
  abi,
  policy: 'unmodified upstream sources only; configuration is injected via configure flags/Modules/Setup.local at build time (constitution C1)',
  sources: Object.fromEntries(results.map((r) => [r.key, {
    version: r.version, url: r.url, sha256: r.sha256, size: r.size,
  }])),
};
const metaPath = path.join(outDir, 'FETCH-METADATA.json');
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
say(`✔ FETCH-METADATA.json → ${metaPath}`);
say('五源获取完成（下载/校验/解压；未做任何源码改动）。');
process.exit(0);
