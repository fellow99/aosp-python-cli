# TEST_REPORT — 20261102-1（测试阶段执行报告）

> 依据 [TEST_CHECKLIST.md](./TEST_CHECKLIST.md)（对应 specs 用例正典）。
> 环境：Windows host（Git Bash + Node 24.7 + Gradle 9.4.1 @D:/Java/gradle-9.4.1 + Temurin 21）；
> 模拟器 Medium_Phone_API_37.0（x86_64，可见窗口模式，API 37 / Android 17）。
> 执行时间：2026-11-02。结论：**host 侧 30/30 全过，0 失败**；设备侧探针与 CI 侧如实 ⬜。

## 一、结果总览

| 层 | 通过 | 失败 | 不可测（如实 ⬜/⛔） |
|---|---|---|---|
| L1 静态语法门 | 5/5 | 0 | — |
| L2 构建配置门 | 4/4 | 0 | — |
| L3 工具语义门 | 9/9 | 0 | — |
| L4 仓库卫生门 | 1/1 | 0 | — |
| L5 门禁/投放全链 | 7/7 | 0 | — |
| L6 模拟器环境事实 | 4/4 | 0 | P1–P5 探针（无产物）⛔ |
| **合计** | **30/30** | **0** | 见 §四 |

## 二、逐层证据（关键摘录）

### L1 静态语法门
- `node --check` ×4（provision/make-elf-fixture/fetch/lock-writeback）全 0；`bash -n` build 脚本 0。

### L2 构建配置门
- `:python-cli:tasks` BUILD SUCCESSFUL；`assembleDebug` 产出 **4.77MB** AAR（含投放内容）；
  `jni/arm64-v8a/` 三件（libpython_cli.so + libpip.so + libpip3.so）；`assets/python-bridge-tools/`
  四件（Lib/ + ensurepip/ + cacert.pem + manifest.json，**1078 文件，version=3.14.10**）；
  `Lib/site-packages/` 含 pip + pip-26.2.2.dist-info（TC-003-17 ✅）。

### L3 工具语义门（退出码三值纪律全对位）
- 未投放 `--check` → **2**（文案「未投放」+ draft 提示）；已投放 → **0**。
- 夹具两侧：好夹具 0；broken-{interp,align,type,machine,needed} → 全 **2**（TC-003-16 ✅）。
- build：dry-run 0 / collect-only 0 / 缺参 1；fetch：未登记版本 1 / 钉选缓存路径 0；
  lock-writeback 0（diff 含 size/sha256/ndk/flags/released）。

### L4 仓库卫生门
- `git status --porcelain` 无 jniLibs/assets/META-INF properties 条目（生成物全被忽略，C3 ✅）。

### L5 门禁/投放全链（FR-001-030…033）
- 静态性：assets 源树含 .so → **2**（拒绝投放）。
- 伪装：真二进制内容 libpip.so → **2**（白名单内容校验，TC-101-18 ✅）。
- 篡改检出：多文件 → **2**；既有文件哈希漂移 → **2**；恢复重投放 → **0**。
- pip 树构成：`pip/__init__.py` 在、无 `bin/`、dist-info METADATA `Version: 26.2.2` = lock 钉选 **MATCH**
  （⚠️ 用例正典修正：pip 26.x 无 `__version__.py`，改以 dist-info 判据——TC-101-15 已更新）。
- 壳脚本：`#!/system/bin/sh` + `exec …-m pip "$@"`，`sh -n` 两件全过（TC-101-16 ✅）。
- manifest 登记 pip 树（TC-101-17 ✅）。

### L6 模拟器环境事实（Medium_Phone_API_37.0，可见窗口）
- `adb devices`：emulator-5554 device；boot_completed=1。
- `/system/bin/linker64` 存在（symlink → `/apex/com.android.runtime/bin/linker64`）——PT_INTERP 契约目标实证。
- `getconf PAGE_SIZE` = **4096**（本镜像 4KB 页；16KB 对齐门禁面向 16KB 页设备，记录事实）。
- `ro.product.cpu.abilist` = **x86_64,arm64-v8a** —— 本镜像带 ndk_translation（arm64 翻译层）！
  **⬜ 待 CI 首产后实测**：arm64 libpython_cli.so 在此模拟器经翻译层直接 exec 是否可行
  （C6：未实测不预支结论；若可行，设备侧冒烟可在本机完成）。
- arm64 独立 AVD（QEMU 全仿真）**不可行**：`FATAL: Avd's CPU Architecture 'arm64' is not
  supported by the QEMU2 emulator on x86_64 host`（emulator 37.2.12，日志留档 scratch）。

## 三、用例正典修正（1 处，随本批提交）

- TC-101-15 判据 `pip/__version__.py` → `pip-<ver>.dist-info/METADATA Version:`（pip 26.x 实测无该文件）。

## 四、不可测项登记（⛔/⬜ 如实）

| 项 | 原因 | 归属 |
|---|---|---|
| 交叉编译①–⑤ 真实执行 | 本机无 NDK/Linux；设计上留 CI | tag `v3.14.10` 推送后首跑 |
| TC-003-01…15 设备侧 | 无真实 libpython_cli.so（合成夹具非功能性） | CI 首产 + M2-T2（⬜） |
| TC-101-01…14 设备侧 | 同上（uv 组合另依赖 aosp-uv-cli） | 同上（BLOCKED 机制） |
| workflow 真实跑批 | 需 tag 推送权限 | M1-T7 收口 |
| symlink 拒绝路径 | 本机无创建特权（评审 #10 附注） | CI/真机补测 |

## 五、回归

测试中发现的唯一偏差（TC-101-15 判据失真）属用例正典问题而非实现缺陷，已修正文档并复核 MATCH；
无需代码修复 ⇒ 无回归轮次。

---

## 六、CI 流水线（14 轮迭代，M1-T7 收口）与设备侧探针（第七轮终判，2026-11-02 晚）

### CI 修复轨迹（每轮实证 → 修复 → 重跑）

| 轮 | 发现 | 修复 |
|---|---|---|
| 1 | setup-android action 内置 `sdkmanager "tools"` 在新版 SDK 仓库已下架 | 弃用 action，runner 预装 SDK 直跑 sdkmanager |
| 2 | fetch 子 shell cd 后相对路径失效 ⇒ Configure ENOENT | OUT/OPENSSL_SRC/SQLITE_DIR 绝对化 |
| 3 | OpenSSL android 目标从 PATH 找 NDK clang（不读 CC） | PATH 前置工具链 bin + `-D__ANDROID_API__` |
| 4 | android.py HOST 不含 API 后缀；API 经 `ANDROID_API_LEVEL` 环境变量 | HOST 用纯三元组 + env 传 API |
| 5 | make-host 硬编码 `-j cpu_count` 不可控 | 直跑 `make -C`（configure 已捕获 env 进 Makefile） |
| 6 | `--disable-shared` 下 lib-dynload 模块 undefined Py* | `MODULE_BUILDTYPE=static`（官方开关）全量转静态 |
| 7 | OpenSSL 4.x 删 `SSLv3_method`（CPython 3.14 不兼容） | 降版钉选 3.5.9 |
| 8 | Setup.local 写源码树（树外构建不读） | 写构建目录 `$HOST_BUILD_DIR/Modules/` |
| 9 | makesetup 源 token 原样拼 .o 名（绝对路径非法） | amalgamation 复制进源码树用相对名 |
| 10 | `-L<beeware prefix>` 先于我方 `-L`，SONAME=libssl_python 被引用 | `-l:libssl.a` 按名直取静态档 |
| 11-12 | beeware prefix pkg-config LIBDIR/PATH 注入（前一轮路径） | `PKG_CONFIG_LIBDIR` 覆盖 + `_ctypes` 入禁用段 |
| 13 | ✅ **CI 全绿**：交叉编译→七项门禁→AAR→Release | — |
| 14 | sysconfigdata 生成于 `build/lib.android-<abi>-3.14/` | glob 兼容两种目录 |
| 15 | ✅ **CI 全绿**（sysconfigdata 入包） | — |

### 设备侧探针终判（第七轮，Medium_Phone_API_37.0 x86_64 / ndk_translation / CPython 3.14.10 真实产物）

**PASS 32 / FAIL 0 / BLOCKED 2（REPL=PTY 需终端 App；uv=外部依赖）**

| 域 | 结果 |
|---|---|
| P1 版本/`-c`/退出码/stderr/UTF-8 | 6/6 PASS |
| P2 sqlite3/zlib/hashlib | 3/3 PASS |
| P3 TLS/CA + 失败路径 | 2/2 PASS |
| stdlib 13 模块导入 + ctypes 缺席 | PASS |
| `-m json.tool` / 脚本文件 / P6 事实 | 3/3 PASS |
| PYTHONHOME 缺失错误注入 | PASS |
| P4 pip --version/pip3/离线首启/--help | 4/4 PASS |
| pip install packaging + import + list | 3/3 PASS |
| C 扩展 sdist 边界拒绝（numpy）+ 无残留 | 2/2 PASS |
| numpy wheel 边界（PASS-REJECTED 事实记录） | PASS |
| pip uninstall / 卸载后 import 失败 | 2/2 PASS |
| ensurepip 兜底 / CLI 脚本不可 exec 事实 / pip 自升级 | 3/3 PASS |
| 无网络失败可读（代理黑洞+no-cache） | PASS |

### 三项消费方打包契约发现（探针实证，C8 已回写构建面）

1. **POSIX 布局**：stdlib 必须物化为 `lib/python3.14/`（小写，含 site-packages/ensurepip）；
2. **`<dir>_*` 打包丢弃**：aapt 默认 ignoreAssetsPattern 丢弃 `_internal`/`_vendor`/`_bundled` 整目录，消费方 App 须覆写 pattern（容器已同步内置）；
3. **构建期 `_sysconfigdata__android_*`**：pip/ensurepip 依赖的平台数据模块，随 stdlib 采集。

### lock 回写（G4 达成）

`size=15754472` / `sha256=1112574a…` / `ndk=27.3.13750724` / `status=released`。
