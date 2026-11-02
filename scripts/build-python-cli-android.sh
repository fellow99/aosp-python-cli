#!/usr/bin/env bash
# scripts/build-python-cli-android.sh —— PEP 738 交叉编译 CPython 为 Android arm64 的
# exec 型 python 命令行（libpython_cli.so，PIE 可执行，静态扩展模块）。
#
# 关键纪律（docs/000-工程规划.md §技术方案；000-scaffold 阶段固化接口，M1 实现）：
#   1) PEP 738（CPython 3.13+ 官方 Android 支持）：configure --host=aarch64-linux-android；
#   2) 扩展模块全静态（Modules/Setup.local *static*）：targetSdk≥29 禁止从 filesDir dlopen，
#      动态扩展 .so 在设备上无法加载——静态化是唯一干净形态；
#   3) ssl 经静态 OpenSSL 链入；CA bundle 随包（Android 无 /etc/ssl/certs）；
#   4) -Wl,-z,max-page-size=16384（16KB 页设备硬要求）；
#   5) 产物 exec 型 ELF：PIE + PT_INTERP=/system/bin/linker64；
#   6) 输出命名 libpython_cli.so（Android 打包只认 lib*.so）。
#
# 产物：<out>/libpython_cli.so（strip）+ <out>/stdlib-assets/（Lib/ 纯 py + ensurepip + CA）
#
# 用法（规划接口，M1 实现）：
#   scripts/build-python-cli-android.sh \
#     --python 3.14.0 --api 24 \
#     --src .dist/src/cpython \
#     --ndk "$ANDROID_NDK_HOME" \
#     --out build/out
#
# 状态：000-scaffold 只固化接口与差异纪律；configure/make/strip 门禁链在 M1 落地。
set -euo pipefail

usage() {
  cat <<'EOF'
用法: scripts/build-python-cli-android.sh --python <ver> --api <api> --src <CPython 源码树> --ndk <ndk 路径> --out <dir>
  --python  CPython 版本（= CLI_VERSION）
  --api     Android API level（默认 24）
  --src     Python-<ver> 解压后的源码树（fetch 脚本产出）
  --ndk     Android NDK 路径
  --out     产物目录
EOF
}

PYVER=""; API="24"; SRC=""; NDK=""; OUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --python) PYVER="$2"; shift 2;;
    --api)    API="$2";   shift 2;;
    --src)    SRC="$2";   shift 2;;
    --ndk)    NDK="$2";   shift 2;;
    --out)    OUT="$2";   shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "未知参数: $1" >&2; usage; exit 1;;
  esac
done

if [[ -z "$PYVER" || -z "$SRC" || -z "$NDK" || -z "$OUT" ]]; then
  usage
  exit 1
fi

echo "[build] SCAFFOLD: PEP 738 configure/make/strip 门禁链在 M1 实现（000-scaffold 只固化接口与差异纪律）。"
echo "[build] 计划: python=$PYVER api=$API src=$SRC ndk=$NDK out=$OUT"
echo "[build] 产物计划: $OUT/libpython_cli.so（exec 型 PIE, 静态扩展, 16KB 对齐）+ stdlib assets"
exit 2
