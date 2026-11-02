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
