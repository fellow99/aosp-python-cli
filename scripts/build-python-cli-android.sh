#!/usr/bin/env bash
# scripts/build-python-cli-android.sh —— PEP 738 交叉编译 CPython 为 Android arm64 的
# exec 型 python 命令行（libpython_cli.so，PIE 可执行，静态扩展模块）。
#
# 六条纪律（docs/000-工程规划.md §4；001-building spec/plan）：
#   1) PEP 738（CPython 3.13+ 官方 Android 支持）：configure --host=aarch64-linux-android；
#   2) 扩展模块全静态（Modules/Setup.local *static*）：targetSdk≥29 禁止从 filesDir dlopen，
#      动态扩展 .so 在设备上无法加载——静态化是唯一干净形态（D1）；
#   3) ssl 经静态 OpenSSL（本仓 lock 钉版源）链入；CA bundle 随包（Android 无 /etc/ssl/certs）；
#   4) -Wl,-z,max-page-size=16384（16KB 页设备硬要求）；
#   5) 产物 exec 型 ELF：PIE + PT_INTERP=/system/bin/linker64（provision 七项门禁强制）；
#   6) 输出命名 libpython_cli.so（Android 打包只认 lib*.so）。
#
# configure 双模式（规划 §4.3：官方辅助路径优先，手写退路）：
#   android（默认）—— 包装源码树官方 `Android/android.py`（configure-build/make-build/
#     configure-host/make-host），再追加本仓覆盖参数：
#       --disable-shared --with-static-libpython  单文件 exec（不加则产物+libpython.so 两件，过不了白名单）
#       --with-openssl=<本仓 vendored 静态前缀>    覆盖 beeware 预编译共享 openssl（D1/C2）
#   manual —— 直接 configure（R1 ⬜ 首轮 CI 试编后按实情回写）
#
# 已知取舍（如实登记进 BUILD-METADATA）：android 模式仍会解包 beeware 预编译工具依赖
# （bzip2/xz/zstd/libffi），其中 openssl/sqlite 被本仓 vendored 版覆盖；其余按 pkg-config
# 参与构建的事实记录为 transitive deps（C2 透明）。
#
# 用法：
#   scripts/build-python-cli-android.sh \
#     --python 3.14.10 --api 24 \
#     --src .dist/src/cpython --deps .dist/src \
#     --ndk "$ANDROID_NDK_HOME" --host-python "$(command -v python3.14)" \
#     --out .dist/out
#   本地（无 NDK）可跑：--dry-run（打印全部命令）/ --collect-only（只执行 ⑥⑦⑧ 数据归集）
#
# 退出码：0 成功 · 2 构建/校验步骤失败 · 1 用法/IO 错误
set -euo pipefail

usage() {
  cat <<'EOF'
用法: scripts/build-python-cli-android.sh --python <ver> [--api 24] --src <CPython 源码树>
        [--deps <fetch 输出目录>] --ndk <NDK> --host-python <解释器> --out <dir>
        [--jobs N] [--configure-mode android|manual] [--extension-mode static-first]
        [--skip-extensions <mod,...>] [--dry-run] [--collect-only --stdlib-src <Lib 目录>]
  --python            CPython 版本（= CLI_VERSION）
  --api               Android API level（默认 24 = lock matrix.minSdk）
  --src               Python-<ver> 源码树（fetch 产出 .dist/src/cpython）
  --deps              fetch 输出目录（含 downloads/ openssl/ sqlite/；默认 .dist/src）
  --ndk               Android NDK 路径（configure-mode=android 时需 ANDROID_HOME 或 --android-sdk）
  --android-sdk       Android SDK 路径（默认 $ANDROID_HOME）
  --host-python       host build 解释器（版本必须 == --python，PEP 738 --with-build-python）
  --out               产物目录
  --jobs              并行度（默认 nproc）
  --configure-mode    android（默认，包装官方 android.py）| manual（手写 configure）
  --extension-mode    static-first（默认）：静态段编译失败即 exit 2；裁剪必须显式 --skip-extensions
  --skip-extensions   显式裁剪的扩展清单（写入 BUILD-METADATA，C4 不静默降级）
  --dry-run           只打印将执行的命令与将写入的 Setup.local（不执行①-⑤）
  --collect-only      只执行 ⑥⑦⑧（配合 --stdlib-src，本地数据归集测试）
EOF
}

PYVER=""; API="24"; SRC=""; DEPS=""; NDK=""; ANDROID_SDK="${ANDROID_HOME:-}"
HOST_PY=""; OUT=""; JOBS="$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)"
CONFIGURE_MODE="android"; EXTENSION_MODE="static-first"; SKIP_EXT=""
DRY_RUN=0; COLLECT_ONLY=0; STDLIB_SRC=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --python) PYVER="$2"; shift 2;;
    --api) API="$2"; shift 2;;
    --src) SRC="$2"; shift 2;;
    --deps) DEPS="$2"; shift 2;;
    --ndk) NDK="$2"; shift 2;;
    --android-sdk) ANDROID_SDK="$2"; shift 2;;
    --host-python) HOST_PY="$2"; shift 2;;
    --out) OUT="$2"; shift 2;;
    --jobs) JOBS="$2"; shift 2;;
    --configure-mode) CONFIGURE_MODE="$2"; shift 2;;
    --extension-mode) EXTENSION_MODE="$2"; shift 2;;
    --skip-extensions) SKIP_EXT="$2"; shift 2;;
    --stdlib-src) STDLIB_SRC="$2"; shift 2;;
    --dry-run) DRY_RUN=1; shift;;
    --collect-only) COLLECT_ONLY=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "未知参数: $1" >&2; usage; exit 1;;
  esac
done

[[ -z "$PYVER" ]] && { usage; exit 1; }
[[ "$CONFIGURE_MODE" != android && "$CONFIGURE_MODE" != manual ]] && { echo "--configure-mode 仅 android|manual" >&2; exit 1; }
DEPS="${DEPS:-$(dirname "$SRC" 2>/dev/null)}"
[[ -z "$DEPS" && -d .dist/src ]] && DEPS=".dist/src"
# --collect-only 也必须给出 --out（评审 #6：否则 ASSETS 落到根目录）
if [[ "$COLLECT_ONLY" == 1 && -z "$OUT" ]]; then
  echo "--collect-only 需要 --out <dir>" >&2; usage; exit 1
fi

err() { echo "[build] 失败：$*" >&2; exit "${2:-1}"; }
log() { echo "[build] $*"; }
run() {
  if [[ "$DRY_RUN" == 1 ]]; then log "  (dry-run) $*"; else "$@"; fi
}

# ── ① env：NDK toolchain 与目标三元组 ───────────────────────────────────────
TARGET="aarch64-linux-android${API}"
if [[ "$COLLECT_ONLY" == 0 ]]; then
  [[ -z "$SRC" || -z "$NDK" || -z "$OUT" ]] && { usage; exit 1; }
  [[ -d "$SRC" || "$DRY_RUN" == 1 ]] || err "--src 不存在：$SRC"
  TOOLCHAIN="$NDK/toolchains/llvm/prebuilt"
  TOOLCHAIN_BIN="$(ls -d "$TOOLCHAIN"/*/bin 2>/dev/null | head -1 || true)"
  if [[ -z "$TOOLCHAIN_BIN" && "$DRY_RUN" == 0 ]]; then
    err "NDK toolchain 未找到：$TOOLCHAIN/*/bin（检查 --ndk）"
  fi
  CC="${TOOLCHAIN_BIN:+$TOOLCHAIN_BIN/clang}"
  [[ -n "$TOOLCHAIN_BIN" ]] && log "① env：CC=$CC TARGET=$TARGET JOBS=$JOBS"
fi

  # ── ② host build python 版本断言（FR-001-010；plan §3.2 冻结口径：不符 ⇒ exit 1）──
if [[ "$COLLECT_ONLY" == 0 ]]; then
  [[ -z "$HOST_PY" ]] && err "缺 --host-python（PEP 738 交叉编译必需同版本 host 解释器）"
  if [[ "$DRY_RUN" == 0 ]]; then
    HP_VER="$("$HOST_PY" --version 2>&1 | awk '{print $2}')"
    [[ "$HP_VER" == "$PYVER" ]] || err "host python 版本不符：$HOST_PY 是 $HP_VER，目标 $PYVER（R5）"
    log "② host python：$HOST_PY → Python $HP_VER ✔（= 目标 $PYVER）"
  else
    log "  (dry-run) $HOST_PY --version  # 断言 == Python $PYVER（不符 ⇒ exit 1）"
  fi
  # API 与 lock 一致性（FR-001-011；评审 #11）
  if [[ "$DRY_RUN" == 0 && -f python-cli.lock.json ]]; then
    API_LOCK="$(node -e '
      const j=require("./python-cli.lock.json");
      const r=j.releases.find(x=>x.version===process.argv[1]&&x.abi===j.active.abi);
      console.log(r?r.androidApi:"")' "$PYVER" 2>/dev/null || true)"
    if [[ -n "$API_LOCK" && "$API" != "$API_LOCK" ]]; then
      err "--api $API 与 lock releases.androidApi=$API_LOCK 不一致（FR-001-011：以 lock 为准）"
    fi
    log "② --api=$API 与 lock androidApi 一致 ✔"
  fi
fi

# ── ③ vendored 依赖前缀 + Setup.local 静态段（FR-001-011/012）───────────────
# 绝对化（CI 实证 2026-11-02：子 shell cd 后相对路径 .dist/… 失效 ⇒ Configure ENOENT）
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
OPENSSL_PREFIX="$OUT/deps/openssl"        # 本仓 vendored 静态 OpenSSL 安装前缀
SQLITE_DIR="$(cd "$DEPS/sqlite" 2>/dev/null && pwd || echo "$DEPS/sqlite")"
OPENSSL_SRC="$(cd "$DEPS/openssl" 2>/dev/null && pwd || echo "$DEPS/openssl")"

# 静态段起步集（FR-001-012 冻结：_ssl/_hashlib/zlib/_sqlite3 —— zlib 必须入段，评审 #1：
# 不入段的模块会落 lib-dynload 动态 .so，本管线永不随包 ⇒ 设备 import 失败 = 静默降级 C4）。
# skip 规范化（评审 #2）：接受短名（ssl/hashlib/sqlite/zlib）与模块名（_ssl/…）与 all；
# 未知名 ⇒ 用法错误 exit 1（不静默忽略）。
normalize_skip() {
  local out="" tok
  [[ -z "$SKIP_EXT" ]] && { echo ""; return; }
  IFS=',' read -ra toks <<< "$SKIP_EXT"
  for tok in "${toks[@]}"; do
    case "$tok" in
      all) out="all";;
      ssl|_ssl) out="$out _ssl";;
      hashlib|_hashlib) out="$out _hashlib";;
      zlib) out="$out zlib";;
      sqlite|sqlite3|_sqlite3) out="$out _sqlite3";;
      *) echo "未知扩展名：$tok（可用：ssl/hashlib/zlib/sqlite3/all 或 _ssl/_hashlib/_sqlite3）" >&2; exit 1;;
    esac
  done
  echo "$out"
}

gen_setup_local() {  # $1 = 输出路径；$2 = 规范化 skip
  # D1 全静态：configure 传 MODULE_BUILDTYPE=static（官方开关，configure:31837）使 Setup.stdlib
  # 整体转静态、无 lib-dynload；makesetup「首条规则胜」+ Setup.local 先读 ⇒ 本文件只需
  # vendored 四件覆盖（胜过 Setup.stdlib 无路径默认行）+ 显式禁用段（CI 第六轮实证重构）。
  local skip=" $2 "
  {
    echo "# Generated by scripts/build-python-cli-android.sh — do not edit."
    echo "# D1 全静态：MODULE_BUILDTYPE=static + vendored 覆盖 + *disabled* 禁用段。"
    echo "*static*"
    if [[ "$skip" != *" _ssl "* && "$skip" != *" all "* ]]; then
      echo "_ssl _ssl.c -I$OPENSSL_PREFIX/include -L$OPENSSL_PREFIX/lib -lssl -lcrypto"
    fi
    if [[ "$skip" != *" _hashlib "* && "$skip" != *" all "* ]]; then
      echo "_hashlib _hashopenssl.c -I$OPENSSL_PREFIX/include -L$OPENSSL_PREFIX/lib -lcrypto"
    fi
    if [[ "$skip" != *" zlib "* && "$skip" != *" all "* ]]; then
      echo "zlib zlibmodule.c -lz"
    fi
    if [[ "$skip" != *" _sqlite3 "* && "$skip" != *" all "* ]]; then
      echo "_sqlite3 _sqlite/blob.c _sqlite/connection.c _sqlite/cursor.c _sqlite/microprotocols.c _sqlite/module.c _sqlite/prepare_protocol.c _sqlite/row.c _sqlite/statement.c _sqlite/util.c sqlite3amalg.c -I$SQLITE_DIR"
    fi
    if [[ "$skip" == *" all "* ]]; then
      echo "# (--skip-extensions all：vendored 四件已裁 —— C4 显式降级，已写入 BUILD-METADATA)"
    fi
    echo "*disabled*"
    echo "_tkinter"
    echo "_curses _curses_panel"
    echo "readline"
    echo "_dbm _gdbm"
    echo "_bz2 _lzma _zstd"
    echo "_testcapi _testbuffer _testimportmultiple _testinternalcapi _testmultiphase _testsinglephase _ctypes_test"
  } > "$1"
}

if [[ "$COLLECT_ONLY" == 0 ]]; then
  log "③ vendored OpenSSL（lock 钉版源 $OPENSSL_SRC）→ $OPENSSL_PREFIX"
  if [[ "$DRY_RUN" == 0 ]]; then
    [[ -d "$OPENSSL_SRC" ]] || err "vendored OpenSSL 源缺失：$OPENSSL_SRC（先跑 fetch）"
    [[ -d "$SQLITE_DIR" ]] || err "sqlite amalgamation 缺失：$SQLITE_DIR（先跑 fetch）"
    mkdir -p "$OPENSSL_PREFIX"
    # OpenSSL android-* 目标：从 PATH 找 NDK 的 aarch64-linux-android<api>-clang（不读 CC），
    # 并以 ANDROID_NDK_ROOT 定位 NDK、-D__ANDROID_API__ 钉 API（CI 第三轮实证调整）
    export ANDROID_NDK_ROOT="$NDK"
    export PATH="$(dirname "$CC"):$PATH"
    ( cd "$OPENSSL_SRC" && \
      "$OPENSSL_SRC/Configure" android-arm64 -D__ANDROID_API__="$API" no-shared \
        --libdir=lib --prefix="$OPENSSL_PREFIX" "-Wl,-z,max-page-size=16384" && \
      make -j"$JOBS" >/dev/null && make install_sw >/dev/null ) || err "vendored OpenSSL 构建失败（R2）" 2
  else
    log "  (dry-run) cd $OPENSSL_SRC && CC=$CC ./Configure android-arm64 no-shared --prefix=$OPENSSL_PREFIX … && make -j$JOBS && make install_sw"
  fi

  SKIP_NORM="$(normalize_skip)"
  log "③ configure（mode=$CONFIGURE_MODE；Setup.local 在 configure 后生成——需要其 Setup.stdlib 探测结果）"

  LDFLAGS_PY="-Wl,-z,max-page-size=16384"
  if [[ "$CONFIGURE_MODE" == android ]]; then
    [[ -n "$ANDROID_SDK" ]] || err "android 模式需 --android-sdk 或 ANDROID_HOME（官方 android.py 要求）"
    # android.py：HOST 用纯三元组（不带 API 后缀），API 经 ANDROID_API_LEVEL 环境变量
    # 传入（Android/android-env.sh:6，默认 24）——CI 第四轮实证其 HOST choices 不含后缀。
    HOST_TRIPLET="aarch64-linux-android"
    if [[ "$DRY_RUN" == 0 ]]; then
      ( cd "$SRC" && ANDROID_HOME="$ANDROID_SDK" python3 Android/android.py configure-build && \
        ANDROID_HOME="$ANDROID_SDK" python3 Android/android.py make-build ) || err "官方 android.py build-python 阶段失败" 2
      ( cd "$SRC" && ANDROID_HOME="$ANDROID_SDK" ANDROID_API_LEVEL="$API" LDFLAGS="$LDFLAGS_PY" \
        python3 Android/android.py configure-host "$HOST_TRIPLET" -- \
          --disable-shared --with-static-libpython --disable-test-modules \
          MODULE_BUILDTYPE=static \
          "--with-openssl=$OPENSSL_PREFIX" ) || err "官方 android.py configure-host 失败" 2
    else
      log "  (dry-run) cd $SRC && ANDROID_HOME=$ANDROID_SDK python3 Android/android.py configure-build"
      log "  (dry-run) cd $SRC && ANDROID_HOME=$ANDROID_SDK python3 Android/android.py make-build"
      log "  (dry-run) cd $SRC && ANDROID_HOME=$ANDROID_SDK ANDROID_API_LEVEL=$API LDFLAGS=$LDFLAGS_PY python3 Android/android.py configure-host $HOST_TRIPLET -- --disable-shared --with-static-libpython --disable-test-modules MODULE_BUILDTYPE=static --with-openssl=$OPENSSL_PREFIX"
    fi
    HOST_BUILD_DIR="$SRC/cross-build/$HOST_TRIPLET"
  else
    CONF_CMD="env CC=$CC CXX=${CC}++ AR=llvm-ar RANLIB=llvm-ranlib \
      LDFLAGS='$LDFLAGS_PY' $SRC/configure --host=$TARGET --with-build-python=$HOST_PY \
      --disable-shared --with-static-libpython --with-openssl=$OPENSSL_PREFIX \
      --disable-test-modules MODULE_BUILDTYPE=static \
      ac_cv_file__dev_ptmx=yes ac_cv_file__dev_ptc=no"
    if [[ "$DRY_RUN" == 1 ]]; then
      log "  (dry-run) mkdir -p $OUT/build && cd $OUT/build && $CONF_CMD"
    else
      mkdir -p "$OUT/build"
      ( cd "$OUT/build" && eval "$CONF_CMD" ) || err "configure（manual）失败" 2
    fi
    HOST_BUILD_DIR="$OUT/build"
  fi

  # Setup.local：vendored 覆盖 + 禁用段（configure 已传 MODULE_BUILDTYPE=static 全量转静态）。
  # ⚠ 树外构建：makesetup 只读【构建目录】的 Modules/Setup.local（CI 第八轮实证：写到源码树
  # 不生效 ⇒ _ssl/_sqlite3 落到 beeware prefix pkg-config 的改名共享库 libssl_python.so 等）。
  # ⚠ makesetup 把源 token 原样拼进 .o 名（CI 第九轮实证：绝对路径源 ⇒ Modules//abs/path.o 非法）
  # ⇒ amalgamation 复制进源码树 Modules/（构建注入，与 Setup.local 同类，不改上游文件）。
  cp -f "$SQLITE_DIR/sqlite3.c" "$SRC/Modules/sqlite3amalg.c"
  SETUP_LOCAL="$HOST_BUILD_DIR/Modules/Setup.local"
  mkdir -p "$HOST_BUILD_DIR/Modules"
  log "③ Modules/Setup.local（vendored 覆盖+禁用段）→ $SETUP_LOCAL（skip='${SKIP_NORM:-无}'）"
  if [[ "$DRY_RUN" == 1 ]]; then
    gen_setup_local /dev/stdout "$SKIP_NORM" | sed 's/^/  | /'
  else
    gen_setup_local "$SETUP_LOCAL" "$SKIP_NORM"
  fi

  # ── ④ make ────────────────────────────────────────────────────────────────
  log "④ make -j$JOBS（$HOST_BUILD_DIR）"
  if [[ "$CONFIGURE_MODE" == android ]]; then
    # 不用 android.py make-host：其硬编码 make -j$(os.cpu_count()) 不可控；
    # configure 已把 android-env（含 NDK 工具链）捕获进 Makefile，直跑 make 即可（CI 第五轮调整）。
    if [[ "$DRY_RUN" == 0 ]]; then
      df -h . | tail -1; free -m | head -2 || true
      # 复刻 android.py make-host 的防污染清理：删 prefix 内已装 python（防被 PATH/pc 捡走）
      rm -rf "$HOST_BUILD_DIR"/prefix/include/python* \
             "$HOST_BUILD_DIR"/prefix/lib/libpython* \
             "$HOST_BUILD_DIR"/prefix/lib/python* 2>/dev/null || true
      run make -C "$HOST_BUILD_DIR" -j"$JOBS" || err "make-host 失败（上方 df/free 为资源诊断）" 2
    else
      log "  (dry-run) make -C $HOST_BUILD_DIR -j$JOBS"
    fi
  else
    run make -C "$HOST_BUILD_DIR" -j"$JOBS"
  fi

  # ── ⑤ strip → libpython_cli.so（FR-001-014）───────────────────────────────
  RAW_PY="$HOST_BUILD_DIR/python"
  log "⑤ llvm-strip --strip-unneeded → $OUT/libpython_cli.so"
  if [[ "$DRY_RUN" == 0 ]]; then
    [[ -f "$RAW_PY" ]] || err "构建产物缺失：$RAW_PY（configure/make 未产出 python 可执行）" 2
    mkdir -p "$OUT"
    cp "$RAW_PY" "$OUT/libpython_cli.so"
    "$TOOLCHAIN_BIN/llvm-strip" --strip-unneeded "$OUT/libpython_cli.so"
    file "$OUT/libpython_cli.so" || true
  else
    log "  (dry-run) cp $RAW_PY $OUT/libpython_cli.so && $TOOLCHAIN_BIN/llvm-strip --strip-unneeded $OUT/libpython_cli.so"
  fi
fi

# ── ⑥ stdlib 收集（FR-001-020）───────────────────────────────────────────────
STDLIB_FROM="${STDLIB_SRC:-$SRC/Lib}"
ASSETS="$OUT/stdlib-assets"
log "⑥ stdlib 收集：$STDLIB_FROM → $ASSETS/Lib（剔除 test/idlelib/tkinter/__pycache__/*.pyc）"
if [[ "$DRY_RUN" == 0 || "$COLLECT_ONLY" == 1 ]]; then
  [[ -d "$STDLIB_FROM" ]] || err "stdlib 源缺失：$STDLIB_FROM"
  rm -rf "$ASSETS/Lib"; mkdir -p "$ASSETS/Lib"
  cp -R "$STDLIB_FROM/." "$ASSETS/Lib/"
  PRUNED=0
  for d in test idlelib tkinter tkinter/test; do
    [[ -d "$ASSETS/Lib/$d" ]] && { rm -rf "$ASSETS/Lib/$d"; PRUNED=$((PRUNED+1)); }
  done
  find "$ASSETS/Lib" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
  PYC=$(find "$ASSETS/Lib" -name '*.pyc' -type f | wc -l)
  find "$ASSETS/Lib" -name '*.pyc' -type f -delete 2>/dev/null || true
  log "⑥ 剔除目录数=$PRUNED pyc=$PYC（计数登记）"
fi

# ── ⑦ pip 树 + 壳脚本 + ensurepip/CA（FR-001-021/022/023）───────────────────
PIP_WHL="$(ls "$DEPS"/downloads/pip-*-py3-none-any.whl 2>/dev/null | head -1 || true)"
CACERT="$DEPS/downloads/cacert.pem"
log "⑦ pip 树解包：$PIP_WHL → $ASSETS/Lib/site-packages/（剔除 wheel 内 bin/）"
if [[ "$DRY_RUN" == 0 || "$COLLECT_ONLY" == 1 ]]; then
  [[ -n "$PIP_WHL" && -f "$PIP_WHL" ]] || err "pip wheel 缺失：$DEPS/downloads/（先跑 fetch）"
  [[ -f "$CACERT" ]] || err "cacert.pem 缺失：$CACERT（先跑 fetch）"
  SP="$ASSETS/Lib/site-packages"; mkdir -p "$SP"
  unzip -qo "$PIP_WHL" -d "$SP"
  rm -rf "$SP/bin"
  log "⑦ pip 树就位（$(ls "$SP/pip" >/dev/null 2>&1 && echo 含 pip/ || echo 缺 pip/!)，bin/ 已剔除）"

  for sh in libpip.so libpip3.so; do
    cat > "$OUT/$sh" <<'EOS'
#!/system/bin/sh
# libpip.so / libpip3.so — generated by build-python-cli-android.sh (do not edit)
exec "$(dirname "$0")/libpython_cli.so" -m pip "$@"
EOS
    chmod +x "$OUT/$sh"
  done
  log "⑦ 壳脚本：$OUT/libpip.so、$OUT/libpip3.so（D6 入口，内容 sh 壳）"

  ENSUREPIP_FROM="${STDLIB_SRC:-$SRC/Lib}/ensurepip/_bundled"
  mkdir -p "$ASSETS/ensurepip"
  cp -R "$ENSUREPIP_FROM/." "$ASSETS/ensurepip/" 2>/dev/null || err "ensurepip wheels 缺失：$ENSUREPIP_FROM"
  cp "$CACERT" "$ASSETS/cacert.pem"
  log "⑦ ensurepip wheels + cacert.pem 就位"
fi

# ── ⑧ 构建元数据（FR-001-034）───────────────────────────────────────────────
log "⑧ BUILD-METADATA.txt"
if [[ "$DRY_RUN" == 0 ]]; then
  mkdir -p "$OUT"
  DEP_VER() {  # $1 = 源键（评审 #12：按键取值，不做第 N 次出现匹配）
    node -e '
      const m = require(process.argv[1]);
      const v = m.sources?.[process.argv[2]]?.version;
      console.log(v ?? "unknown")' "$DEPS/FETCH-METADATA.json" "$1" 2>/dev/null || echo unknown
  }
  cat > "$OUT/BUILD-METADATA.txt" <<EOM
python=$PYVER
abi=arm64-v8a
androidApi=$API
configureMode=$CONFIGURE_MODE
extensionMode=$EXTENSION_MODE
skipExtensions=${SKIP_NORM:-none}
prunedModules=_bz2,_lzma,_zstd（beeware prefix 共享库依赖，首版裁剪——D1 单文件 exec）
ndk=$(basename "${NDK:-unknown}")
flags=-Wl,-z,max-page-size=16384; llvm-strip --strip-unneeded
openssl=$(DEP_VER openssl)
sqlite=$(DEP_VER sqlite)
pip=$(DEP_VER pip)
transitiveDeps=beeware/cpython-android-source-deps (bzip2/xz/zstd/libffi; openssl+sqlite overridden by vendored pins)
builtAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOM
  [[ -f "$DEPS/FETCH-METADATA.json" ]] && cp "$DEPS/FETCH-METADATA.json" "$OUT/"
  log "⑧ 完成：$OUT/BUILD-METADATA.txt"
fi

log "构建流程结束（python=$PYVER api=$API mode=$CONFIGURE_MODE dry-run=$DRY_RUN collect-only=$COLLECT_ONLY）。"
[[ "$DRY_RUN" == 1 ]] && log "（dry-run：未执行任何编译/解包动作）"
exit 0
