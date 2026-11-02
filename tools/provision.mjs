#!/usr/bin/env node
/*
 * tools/provision.mjs —— python-cli 投放与 ELF 门禁（exec 型 profile）
 *
 * 唯一事实源是仓库根的 `python-cli.lock.json`（版本 + 大小 + SHA-256 + 门禁 + 出处）。
 * 二进制不入库：本工具把 CI 产物幂等投放进模块 jniLibs。
 *
 * 与 aosp-node-pty/tools/provision.mjs 同一套极简 ELF64 解析（退出码 0/2/1 同纪律），
 * 但门禁是 **exec 型 profile**，与 dlopen 库门禁的三处相反/差异：
 *   1. PT_INTERP：exec 型必须恰有 1 个，且内容 = /system/bin/linker64
 *      （dlopen 库门禁恰好相反：要求 PT_INTERP=0）。
 *   2. DT_NEEDED 白名单：只允许系统库 + lock matrix.allowedNeeded 登记的随包库
 *      （pty 的对应门禁是"必须含 libnode.so"）。
 *   3. 无 NAPI 门禁：CLI 是独立进程，不加载引擎、不解析 napi_*。
 *   4. 打包：useLegacyPackaging=true——exec 要求物理落盘 nativeLibraryDir
 *      （targetSdk≥29 SELinux 禁止从可写数据目录 exec；不落盘则 execve ENOENT）。
 *
 * 用法：
 *   node tools/provision.mjs --check
 *   node tools/provision.mjs --out python-cli/src/main/jniLibs --from <libpython_cli.so>
 *   node tools/provision.mjs --inspect <libpython_cli.so>
 *   node tools/provision.mjs --assets <stdlib-assets 目录>            # 投放 + 生成 manifest（FR-001-030/031）
 *   node tools/provision.mjs --assets-mode verify                     # 只复验已投放树
 *   node tools/provision.mjs --version 3.14.10 --abi arm64-v8a ...
 *
 * 扩展（001-building）：--assets 投放（静态性检查 + manifest 生成/复验）；jniLibs 白名单
 * 放行 libpip.so/libpip3.so 壳脚本（内容须 #!/system/bin/sh 且含 "-m pip"，FR-001-033）。
 *
 * 退出码：0 全过 · 2 门禁不合格 · 1 用法/IO 错误
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ── 仓库级常量（每仓一份 provision，仅此块不同）─────────────────────────────
const LOCK_FILE = 'python-cli.lock.json';
const MODULE_DIR = 'python-cli';
const RES_PROPERTIES = 'python-cli.properties';
const DEFAULT_BINARY = 'libpython_cli.so';
// 绝不进入本 AAR 的文件（node-runtime 统一供给；同名库重复会造成包内冲突）。
const BANNED_IN_AAR = ['libnode.so'];
// jniLibs 壳脚本白名单（001-building FR-001-033，D6）：pip 命令入口。
// 白名单只放行「内容为 sh 壳」的文件；真二进制伪装成这些名字仍被拒绝。
const SHELL_SCRIPT_NAMES = ['libpip.so', 'libpip3.so'];
const SHELL_SCRIPT_MARK = '-m pip';
// ───────────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_PATH = path.join(ROOT, LOCK_FILE);
const MODULE_JNILIBS = path.join(MODULE_DIR, 'src', 'main', 'jniLibs');
const MODULE_ASSETS = path.join(MODULE_DIR, 'src', 'main', 'assets', 'python-bridge-tools');
const ASSETS_MANIFEST = 'manifest.json';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
function argOf(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function say(msg) {
  process.stdout.write(`[provision] ${msg}\n`);
}

// ── assets 树：清单与静态性检查（001-building FR-001-030…032）───────────────

/** 递归收集目录内全部文件（相对路径，正斜杠）。symlink ⇒ 报错（评审 #10：
 *  symlink 既不进 manifest 也躲过静态性检查，fail-closed 拒绝）。 */
function walkFiles(dir, base = dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isSymbolicLink()) {
      throw new Error(`数据树内不允许 symlink：${path.relative(base, p)}`);
    }
    if (ent.isDirectory()) out.push(...walkFiles(p, base));
    else if (ent.isFile()) out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}

function sha256File(p) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}

/** 静态性检查：数据树内不得出现原生件（防动态扩展漏网，规划 §6）。 */
function assertNoNative(dir) {
  const offenders = walkFiles(dir).filter((f) => f.endsWith('.so'));
  if (offenders.length) {
    say(`✘ 静态性检查：assets 树内发现 .so（动态扩展禁止随包）：${JSON.stringify(offenders)}`);
    process.exit(2);
  }
  say('✔ 静态性检查：assets 树内无 .so');
}

/** 生成/校验 manifest：逐文件 sha256 + 总摘要（对 relpath+sha256 排序串取哈希）。 */
function manifestFor(dir) {
  const files = {};
  for (const rel of walkFiles(dir)) {
    if (rel === ASSETS_MANIFEST) continue; // manifest 不含自身
    files[rel] = sha256File(path.join(dir, rel));
  }
  const names = Object.keys(files).sort();
  const totalSha256 = crypto.createHash('sha256')
    .update(names.map((n) => `${n}${files[n]}`).join('\n')).digest('hex');
  return {
    tool: 'provision.mjs',
    version: null, // 调用方填
    abi: null,
    fileCount: names.length,
    totalSha256,
    generatedAt: new Date().toISOString(),
    files,
  };
}

function verifyAssets(targetDir, manifest, rel) {
  const problems = [];
  // manifest 与 lock 的版本/ABI 交叉核对（评审 #10：防「别的 python 版本投放的树」验过）
  if (rel) {
    if (manifest.version !== rel.version) problems.push(`版本不匹配：manifest=${manifest.version} lock=${rel.version}`);
    if (manifest.abi !== rel.abi) problems.push(`ABI 不匹配：manifest=${manifest.abi} lock=${rel.abi}`);
  }
  const actual = manifestFor(targetDir).files;
  const expect = manifest.files;
  for (const f of Object.keys(expect)) {
    if (!(f in actual)) problems.push(`缺文件：${f}`);
    else if (actual[f] !== expect[f]) problems.push(`哈希漂移：${f}`);
  }
  for (const f of Object.keys(actual)) {
    if (!(f in expect)) problems.push(`多文件：${f}`);
  }
  return problems;
}

// ── 极简 ELF64（小端）解析：只回答门禁需要的问题（与 pty 同款 + PT_INTERP 内容）──

function parseElf(buf) {
  if (buf.length < 64 || buf.readUInt32BE(0) !== 0x7f454c46) throw new Error('不是 ELF 文件');
  const little = buf[5] === 1;
  if (!little) throw new Error('只支持小端 ELF（AArch64 一定是小端）');
  const u16 = (o) => buf.readUInt16LE(o);
  const u32 = (o) => buf.readUInt32LE(o);
  const u64 = (o) => Number(buf.readBigUInt64LE(o));

  const eType = u16(16);
  const eMachine = u16(18);
  const ePhoff = u64(32);
  const ePhentsize = u16(54);
  const ePhnum = u16(56);
  const eShoff = u64(40);
  const eShentsize = u16(58);
  const eShnum = u16(60);
  const eShstrndx = u16(62);

  let ptInterp = 0;
  let interp = null;
  const loadAligns = [];
  for (let i = 0; i < ePhnum; i++) {
    const o = ePhoff + i * ePhentsize;
    const pType = u32(o);
    const pAlign = u64(o + 48);
    if (pType === 3) {
      ptInterp++;
      const pOffset = u64(o + 8);
      const pFilesz = u64(o + 32);
      interp = buf.toString('utf8', pOffset, pOffset + pFilesz).replace(/\0+$/, '');
    }
    if (pType === 1) loadAligns.push(pAlign);
  }

  const sections = [];
  for (let i = 0; i < eShnum; i++) {
    const o = eShoff + i * eShentsize;
    sections.push({
      nameOff: u32(o),
      type: u32(o + 4),
      offset: u64(o + 24),
      size: u64(o + 32),
    });
  }
  const shstr = sections[eShstrndx];
  const strAt = (base, off) => {
    const s = base + off;
    let e = s;
    while (e < buf.length && buf[e] !== 0) e++;
    return buf.toString('utf8', s, e);
  };
  const byName = new Map();
  for (const s of sections) byName.set(strAt(shstr.offset, s.nameOff), s);

  const dynamic = byName.get('.dynamic');
  const needed = [];
  const soname = [];
  if (dynamic) {
    for (let i = 0; i * 16 < dynamic.size; i++) {
      const o = dynamic.offset + i * 16;
      const tag = Number(buf.readBigInt64LE(o));
      const val = u64(o + 8);
      if (tag === 0) break;
      if (tag === 1 || tag === 14) {
        const nm = strAt(byName.get('.dynstr').offset, val);
        if (tag === 1) needed.push(nm);
        else soname.push(nm);
      }
    }
  }

  return { eType, eMachine, ptInterp, interp, loadAligns, needed, soname };
}

function gates(buf, rel, allowedNeeded) {
  let elf;
  try {
    elf = parseElf(buf);
  } catch (e) {
    return { ok: false, results: [{ id: 'parse', ok: false, detail: e.message }] };
  }
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const minAlign = elf.loadAligns.length ? Math.min(...elf.loadAligns) : 0;
  const expectSha = rel.sha256 && rel.sha256.length === 64 ? rel.sha256 : null;
  const expectSize = rel.size && rel.size > 0 ? rel.size : null;
  const r = [];
  const add = (id, ok, detail) => r.push({ id, ok, detail });

  add('① e_type = ET_DYN（PIE 可执行）', elf.eType === 3, `e_type=${elf.eType}`);
  // 本工程特有（与 dlopen 库门禁相反）：exec 型必须经系统动态链接器启动。
  add('② PT_INTERP 恰 1 个且 = /system/bin/linker64',
    elf.ptInterp === 1 && elf.interp === '/system/bin/linker64',
    `PT_INTERP=${elf.ptInterp} interp=${JSON.stringify(elf.interp)}`);
  add('③ e_machine = AArch64', elf.eMachine === 183, `e_machine=${elf.eMachine}`);
  // exec 型依赖白名单：只允许系统库 + lock matrix.allowedNeeded 登记的随包库。
  const banned = elf.needed.filter((n) => !allowedNeeded.includes(n));
  add('④ DT_NEEDED 全部在白名单', banned.length === 0,
    `NEEDED=${JSON.stringify(elf.needed)}；白名单外=${banned.length ? JSON.stringify(banned) : '无'}`);
  if (expectSha) add('⑤ SHA-256 与锁一致', sha256 === expectSha, `${sha256.slice(0, 16)}… vs ${expectSha.slice(0, 16)}…`);
  else add('⑤ SHA-256（draft 无锁值，仅记录）', true, sha256);
  if (expectSize) add('⑥ 大小与锁一致', buf.length === expectSize, `${buf.length} vs ${expectSize}`);
  else add('⑥ 大小（draft 无锁值，仅记录）', true, `${buf.length}`);
  add('⑦ 16 KB 页对齐', minAlign >= 0x4000, `min LOAD align=0x${minAlign.toString(16)}（小于 0x4000=16KB，16 KB 页设备不合格）`);

  const allow4k = has('--allow-page-align-4k');
  const gateAlign = r.find((x) => x.id.startsWith('⑦'));
  const hardOk = r.every((x) => (allow4k && x === gateAlign ? true : x.ok));
  if (allow4k && gateAlign && !gateAlign.ok) {
    say('⚠ --allow-page-align-4k 放行「16 KB 页对齐」：仅 bring-up，上架/16 KB 设备不合格');
  }
  return { ok: hardOk, results: r, elf, sha256 };
}

function printGates(g) {
  for (const x of g.results) say(`${x.ok ? '✔' : '✘'} ${x.id} — ${x.detail}`);
}

/** jniLibs 兄弟 .so 白名单（FR-001-033）：主件 + libpip*.so 壳脚本（内容须为 sh 壳）。 */
function isPipShell(dir, f) {
  if (!SHELL_SCRIPT_NAMES.includes(f)) return false;
  try {
    const head = fs.readFileSync(path.join(dir, f), 'utf8');
    return head.startsWith('#!/system/bin/sh') && head.includes(SHELL_SCRIPT_MARK);
  } catch {
    return false;
  }
}

function illegalSiblings(dir, activeName) {
  const siblings = fs.readdirSync(dir).filter((f) => f.endsWith('.so'));
  return siblings.filter((f) => {
    if (f === activeName) return false;
    if (isPipShell(dir, f)) return false;
    // 白名单名字但内容不是 sh 壳 ⇒ 伪装，拒绝。
    return true;
  });
}

// ── 主流程 ──────────────────────────────────────────────────────────────────

function readLock() {
  if (!fs.existsSync(LOCK_PATH)) throw new Error(`缺 ${LOCK_PATH}`);
  return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
}

function main() {
  const lock = readLock();
  const allowedNeeded = lock.matrix?.allowedNeeded ?? ['libc.so', 'libm.so', 'libdl.so', 'libz.so'];
  const wantVersion = argOf('--version') || lock.active.version;
  const wantAbi = argOf('--abi') || lock.active.abi;
  const rel = lock.releases.find((x) => x.version === wantVersion && x.abi === wantAbi);
  if (!rel) {
    throw new Error(
      `${LOCK_FILE} 里没有记录 version=${wantVersion} abi=${wantAbi}；现有：` +
      lock.releases.map((x) => `${x.version}/${x.abi}`).join(', '),
    );
  }
  const active = { version: rel.version, abi: rel.abi, name: rel.name || DEFAULT_BINARY };

  say(`目标 release：version=${rel.version} abi=${rel.abi}（${rel.pairedRuntime?.coordinates ?? '无配对信息'}）`);
  if (rel.status === 'draft') say('⚠ lock 中该 release 为 draft：sha/size 无锁值，仅记录不比对');

  const inspectPath = argOf('--inspect');
  if (inspectPath) {
    const buf = fs.readFileSync(inspectPath);
    const g = gates(buf, rel, allowedNeeded);
    printGates(g);
    say(g.ok ? '门禁：全过' : '门禁：不合格');
    process.exit(g.ok ? 0 : 2);
  }

  // ── --assets <dir>：随包数据投放 / 复验（001-building FR-001-030…032）────────
  const assetsDir = argOf('--assets');
  const assetsMode = argOf('--assets-mode') ?? 'stage';
  if (assetsMode !== 'stage' && assetsMode !== 'verify') {
    throw new Error('--assets-mode 仅 stage|verify');
  }
  if (assetsDir) {
    if (assetsMode !== 'stage') throw new Error('--assets-mode verify 不接受 --assets <dir>（复验对象是已投放树）');
    if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
      throw new Error(`--assets 目录不存在：${assetsDir}`);
    }
    say(`assets 投放：${assetsDir} → ${MODULE_ASSETS}`);
    assertNoNative(assetsDir);
    fs.rmSync(path.join(ROOT, MODULE_ASSETS), { recursive: true, force: true });
    fs.mkdirSync(path.join(ROOT, MODULE_ASSETS), { recursive: true });
    fs.cpSync(assetsDir, path.join(ROOT, MODULE_ASSETS), { recursive: true });
    const manifest = manifestFor(path.join(ROOT, MODULE_ASSETS));
    manifest.version = rel.version;
    manifest.abi = rel.abi;
    fs.writeFileSync(
      path.join(ROOT, MODULE_ASSETS, ASSETS_MANIFEST),
      JSON.stringify(manifest, null, 2) + '\n',
    );
    say(`✔ manifest.json：${manifest.fileCount} 文件，totalSha256=${manifest.totalSha256.slice(0, 16)}…`);
    say('assets 投放完成（幂等：先清空再投放）。');
    process.exit(0);
  }
  if (assetsMode === 'verify') {
    const target = path.join(ROOT, MODULE_ASSETS);
    if (!fs.existsSync(target)) {
      say(`assets 未投放：${target}（先跑 --assets <dir>）`);
      process.exit(2);
    }
    const mPath = path.join(target, ASSETS_MANIFEST);
    if (!fs.existsSync(mPath)) throw new Error(`缺 ${ASSETS_MANIFEST}（投放树不完整）`);
    const problems = verifyAssets(target, JSON.parse(fs.readFileSync(mPath, 'utf8')), rel);
    for (const p of problems) say(`✘ ${p}`);
    if (problems.length) {
      say('assets 复验：不合格');
      process.exit(2);
    }
    say('✔ assets 复验：与 manifest 一致');
    process.exit(0);
  }

  const outDir = argOf('--out');
  const from = argOf('--from');

  if (!outDir) {
    // --check：校验已投放产物（jniLibs 门禁 + 兄弟白名单 + assets 复验）
    const target = path.join(ROOT, MODULE_JNILIBS, active.abi, active.name);
    if (!fs.existsSync(target)) {
      say(`未投放：${target}（先跑 --out …）`);
      process.exit(2);
    }
    const buf = fs.readFileSync(target);
    const g = gates(buf, rel, allowedNeeded);
    printGates(g);
    // 纪律：jniLibs 只允许 本工具二进制 + libpip*.so 壳脚本（FR-001-033），引擎/C++ 运行时绝不能混入。
    const dir = path.dirname(target);
    const illegal = illegalSiblings(dir, active.name);
    const shells = fs.readdirSync(dir).filter((f) => isPipShell(dir, f));
    say(`${illegal.length === 0 ? '✔' : '✘'} jniLibs 白名单：主件 + 壳脚本${shells.length ? `（${shells.join(', ')}）` : '（无）'}；违规 .so：${illegal.length ? JSON.stringify(illegal) : '无'}`);
    // assets 复验（规划 §5：随包数据必须带清单）
    let assetsOk = true;
    const assetsTarget = path.join(ROOT, MODULE_ASSETS);
    if (!fs.existsSync(assetsTarget)) {
      say('✘ assets 未投放（provision --assets <dir>）');
      assetsOk = false;
    } else if (!fs.existsSync(path.join(assetsTarget, ASSETS_MANIFEST))) {
      say(`✘ assets 缺 ${ASSETS_MANIFEST}（投放树不完整）`);
      assetsOk = false;
    } else {
      const problems = verifyAssets(assetsTarget, JSON.parse(fs.readFileSync(path.join(assetsTarget, ASSETS_MANIFEST), 'utf8')), rel);
      for (const p of problems) say(`✘ assets ${p}`);
      say(problems.length === 0 ? `✔ assets 复验：与 manifest 一致` : `✘ assets 复验：${problems.length} 处不一致`);
      assetsOk = problems.length === 0;
    }
    const ok = g.ok && illegal.length === 0 && assetsOk;
    say(ok ? '门禁：全过' : '门禁：不合格');
    process.exit(ok ? 0 : 2);
  }

  if (!from) throw new Error(`--out 需要配 --from <${DEFAULT_BINARY}>`);
  const buf = fs.readFileSync(from);
  const g = gates(buf, rel, allowedNeeded);
  printGates(g);
  if (!g.ok) {
    say('门禁不合格 ⇒ 拒绝投放');
    process.exit(2);
  }

  // 投放：主件 + 同目录存在的 libpip*.so 壳脚本（内容校验，D6 入口）。
  const destDir = path.resolve(ROOT, outDir, active.abi);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, active.name);
  fs.copyFileSync(from, dest);
  say(`✔ 投放（唯一原生件）：${dest}`);
  const srcDir = path.dirname(path.resolve(from));
  for (const f of SHELL_SCRIPT_NAMES) {
    const cand = path.join(srcDir, f);
    if (!fs.existsSync(cand)) continue;
    if (!isPipShell(srcDir, f)) {
      say(`✘ ${f} 内容不是 sh 壳（须 #!/system/bin/sh + ${SHELL_SCRIPT_MARK}）⇒ 拒绝投放`);
      process.exit(2);
    }
    fs.copyFileSync(cand, path.join(destDir, f));
    say(`✔ 投放（pip 壳脚本，白名单）：${path.join(destDir, f)}`);
  }
  const illegal = illegalSiblings(destDir, active.name);
  if (illegal.length) {
    say(`✘ jniLibs 白名单违规：${JSON.stringify(illegal)}`);
    process.exit(2);
  }
  for (const banned of BANNED_IN_AAR) {
    if (fs.existsSync(path.join(destDir, banned))) {
      throw new Error(`${banned} 不得进入本 AAR（应由配对 runtime 供给，避免包内同名冲突）`);
    }
  }

  // 版本元数据（供 AAR resources 使用）
  const resDir = path.join(ROOT, MODULE_DIR, 'src', 'main', 'resources', 'META-INF');
  fs.mkdirSync(resDir, { recursive: true });
  fs.writeFileSync(
    path.join(resDir, RES_PROPERTIES),
    [
      `tool.version=${rel.version}`,
      `abi=${rel.abi}`,
      `name=${active.name}`,
      `size=${buf.length}`,
      `sha256=${g.sha256}`,
      rel.pairedRuntime?.coordinates ? `paired.runtime=${rel.pairedRuntime.coordinates}` : '',
      `provisionedAt=${new Date().toISOString()}`,
      '',
    ].filter((l) => l !== '').join('\n'),
  );
  say('投放完成');
}

try {
  main();
} catch (e) {
  process.stderr.write(`[provision] 失败：${e.message}\n`);
  process.exit(1);
}
