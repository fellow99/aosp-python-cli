#!/usr/bin/env node
/*
 * scripts/fetch-python-cli-source.mjs —— 取构建输入（CPython 官方源码包，不改源）
 *
 * 计划输出目录（默认 .dist/src）：
 *   <out>/cpython/             Python-<ver> 解压后的完整源码树
 *
 * 源码不改（工作区纪律：fetch 不打补丁；Android 专用配置经构建脚本的 configure 参数注入，
 * PEP 738 是官方支持路径）。本脚本只下载、解压、记录出处与 sha256。
 *
 * 用法（规划接口，M1 实现）：
 *   node scripts/fetch-python-cli-source.mjs --python 3.14.0 --out .dist/src
 *
 * 状态：000-scaffold 只固化接口与纪律；下载/解压/校验逻辑在 M1 落地。
 *
 * 退出码：0 成功 · 2 SCAFFOLD 未实现 · 1 用法/IO/下载错误
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function argOf(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function usage() {
  process.stderr.write(
    [
      '用法: node scripts/fetch-python-cli-source.mjs --python <CPython 版本> [--out <dir>]',
      '  --python  CPython 版本（= CLI_VERSION）',
      '  --out     输出目录（默认 .dist/src）',
    ].join('\n') + '\n',
  );
}

const pyver = argOf('--python');
const out = argOf('--out') ?? path.join(ROOT, '.dist', 'src');

if (args.includes('--help') || !pyver) {
  usage();
  process.exit(pyver ? 0 : 1);
}

process.stderr.write(
  [
    `[fetch] SCAFFOLD: 下载/解压/SHA-256 校验逻辑在 M1 实现（000-scaffold 只固化接口）。`,
    `[fetch] 计划输入: Python-${pyver}.tgz @ https://www.python.org/ftp/python/${pyver}/`,
    `[fetch] 计划输出: ${out}/cpython/`,
  ].join('\n') + '\n',
);
process.exit(2);
