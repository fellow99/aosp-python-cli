# TEST_CHECKLIST — 20261102-1（测试阶段）

> 依据：`specs/overall-test-cases.md`（L1–L6 分层）+ `003-cli/test-cases.md`（TC-003-16/17 host 侧）+
> `101-pip-integration/test-cases.md`（TC-101-15…18 host 侧）+ 各模块 tasks 内嵌用例。
> 环境：Windows host（Git Bash + Node 24.7 + Gradle 9.4.1 @D:/Java/gradle-9.4.1 + Temurin 21）
> + 模拟器 Medium_Phone_API_37.0（x86_64，SDK %LOCALAPPDATA%\Android\Sdk）。
> 状态口径：⬜ 未执行 · 🟡 进行中 · ✅ 通过 · ❌ 失败 · ⛔ 不可测（如实登记原因）。

## L1 静态语法门（FR-000-042）

- [ ] TC-L1-1 `node --check tools/provision.mjs` → exit 0
- [ ] TC-L1-2 `node --check tools/make-elf-fixture.mjs` → exit 0
- [ ] TC-L1-3 `node --check scripts/fetch-python-cli-source.mjs` → exit 0
- [ ] TC-L1-4 `node --check tools/lock-writeback.mjs` → exit 0
- [ ] TC-L1-5 `bash -n scripts/build-python-cli-android.sh` → exit 0

## L2 构建配置门（FR-000-005/040；TC-03/TC-003-17）

- [ ] TC-L2-1 `gradle :python-cli:tasks`（Gradle 9.4.1）→ BUILD SUCCESSFUL
- [ ] TC-L2-2 `gradle :python-cli:assembleDebug` → AAR 产出
- [ ] TC-L2-3 AAR 解包：`jni/arm64-v8a/{libpython_cli.so,libpip.so,libpip3.so}` 三件齐备
- [ ] TC-L2-4 AAR 解包：`assets/python-bridge-tools/{Lib,ensurepip,cacert.pem,manifest.json}` 齐备（TC-003-17）

## L3 工具语义门（FR-000-032 / FR-001-035）

- [ ] TC-L3-1 provision `--check`（未投放态：临时移走 jniLibs）→ exit 2，文案含「未投放」
- [ ] TC-L3-2 provision `--check`（已投放态）→ 七项✔ + 白名单✔ + assets 复验✔ → exit 0
- [ ] TC-L3-3 provision `--inspect` 好夹具 → exit 0；5 种坏夹具 → 各 exit 2（TC-003-16）
- [ ] TC-L3-4 build `--dry-run` → 全链打印 exit 0
- [ ] TC-L3-5 build `--collect-only` → 数据归集 exit 0
- [ ] TC-L3-6 build 缺必需参数 → exit 1
- [ ] TC-L3-7 fetch `--python <未登记版本>` → exit 1
- [ ] TC-L3-8 fetch 五源 E2E（已钉选）→ exit 0（缓存命中路径）
- [ ] TC-L3-9 lock-writeback（fixture 产物）→ exit 0，diff 含四值+released

## L4 仓库卫生门（C3；TC-09）

- [ ] TC-L4-1 `git status --porcelain` 无 jniLibs/assets/META-INF properties 条目

## L5 门禁/投放全链（FR-001-030…033；TC-101-15…18）

- [ ] TC-L5-1 `--assets` 投放 → manifest 生成（fileCount>0，含 Lib/site-packages/pip 条目）（TC-101-17）
- [ ] TC-L5-2 `--assets-mode verify` → exit 0
- [ ] TC-L5-3 静态性检查：assets 树内放入 .so → 拒绝 exit 2
- [ ] TC-L5-4 伪装 libpip.so（真二进制内容）投放 → 拒绝 exit 2（TC-101-18）
- [ ] TC-L5-5 assets 篡改（新增文件 / 既有文件漂移）→ `--check` 检出 exit 2
- [ ] TC-L5-6 pip 树构成：`site-packages/pip/__init__.py` 存在、无 bin/、`pip/__version__.py` = lock 钉选（TC-101-15）
- [ ] TC-L5-7 壳脚本内容与语法：libpip.so/libpip3.so = sh 壳模板、`sh -n` 过（TC-101-16）

## L6 模拟器环境事实（可测项；python/pip 探针 ⬜ 待 CI 首产）

- [ ] TC-L6-1 模拟器启动 + `adb devices` 可见
- [ ] TC-L6-2 `/system/bin/linker64` 存在（PT_INTERP 契约目标实证）
- [ ] TC-L6-3 `getconf PAGE_SIZE` 记录（16KB 对齐门禁的环境相关性）
- [ ] TC-L6-4 记录：x86_64 模拟器不可承载 arm64 产物 → P1–P5 探针须真机/arm64 环境（判据纪律 §四.3）

## 不可测项登记（⛔ 如实）

- 交叉编译①–⑤ 真实执行 → CI ubuntu（NDK r28c + host py 3.14.10）⬜
- TC-003-01…15 / TC-101-01…14 设备侧 → ⬜ 待 CI 首产 + M2-T2（含 uv 组合 BLOCKED）
- workflow 真实跑批 → ⬜ 待 tag 推送
