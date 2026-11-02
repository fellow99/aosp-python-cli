# DEV_CHECKLIST — 20261102-1（开发阶段，001/002/003/101 模块 M1 代码）

> 对应 specs/001-building·002-building-workflow·003-cli·101-pip-integration tasks.md。
> 环境：Windows host（Git Bash + Node 24.7 + Gradle 9.4.1 @D:/Java/gradle-9.4.1 + Temurin 21）。
> 交叉编译本体留 CI（ubuntu + NDK r28c + host python 3.14.10）⬜；本地完成全部可测项。

## T1 lock 扩展与版本钉选
- [x] builtFrom.deps 五源表（cpython/openssl/sqlite/pip/cacert）— FR-001-001/004
- [x] 版本钉选（用户指令）：CPython **3.14.10**（3.14.0 → 3.14.10 全仓切换：lock/gradle.properties/规划/specs）
- [x] 五源 sha256 引导取值（--report-sha256 实测官方下载）并回写 lock：
  cpython 9e4996c1…/openssl 50c17baf…/sqlite 0a9c8e34…/pip fd7f4dfa…（与 PyPI API 公布值一致）/cacert 796f1389…
- [x] 发现并修复：GNU tar 把 `D:\` 冒号解析为远程主机（fetch 解压改 cwd+相对路径）

## T2 fetch 全量实现（替换骨架）
- [x] 未钉选拒绝（exit 1 + 列出未钉键）；--report-sha256 引导模式
- [x] 可重入下载（哈希一致跳过；不一致=缓存污染 exit 1）— FR-001-002
- [x] sha256 校验失败 exit 2；解压（tgz/zip，顶层目录归一化）
- [x] FETCH-METADATA.json（五源 url/version/sha256/size + 不改源声明）— FR-001-003
- [x] E2E 实测：五源全过（3.14.10 tgz 31.7MB/openssl 55.7MB/sqlite 3.0MB/pip 1.8MB/cacert 200KB），exit 0

## T3 build 脚本全量实现（八步 + 双 configure 模式）
- [x] 参数面：--host-python/--jobs/--dry-run/--extension-mode/--skip-extensions/--configure-mode/--collect-only/--stdlib-src/--deps/--android-sdk
- [x] 官方 android.py 包装（configure-build/make-build/configure-host/make-host + --disable-shared --with-static-libpython + vendored --with-openssl 覆盖 beeware 预编译共享库）；manual 退路 — 规划 §4.3
- [x] vendored OpenSSL（lock 钉版源 android-arm64 no-shared）+ Setup.local *static* 段（源行抄自 3.14.10 树 Setup.stdlib.in）— FR-001-011/012
- [x] host python 版本断言 — FR-001-010；llvm-strip → libpython_cli.so — FR-001-014
- [x] ⑥⑦⑧ collect-only 实测（真实 3.14.10 stdlib + pip 26.2.2 wheel）：剔除 3 目录/0 pyc、pip 树入 site-packages、bin 剔除、libpip*.so 壳脚本、ensurepip+cacert、BUILD-METADATA — FR-001-020/021/022/023/034
- [x] --dry-run 全链打印实测 exit 0；bash -n 过

## T4 provision 扩展
- [x] --assets stage（静态性检查 + 幂等投放 + manifest 生成）/ --assets-mode verify — FR-001-030/031/032
- [x] manifest：逐文件 sha256 + totalSha256（排序无关）+ fileCount + version/abi
- [x] jniLibs 白名单扩展：libpip.so/libpip3.so（内容须 #!/system/bin/sh + "-m pip"，伪装拒绝）— FR-001-033
- [x] --out 自动投放同目录 libpip*.so；--check 集成 assets 复验
- [x] 实测：好夹具七项✔ exit 0；5 种坏夹具（interp/align/type/machine/needed）全 exit 2；
      伪装 libpip.so 投放拒绝 exit 2；assets 新增文件/哈希漂移均检出 exit 2；恢复后 exit 0

## T5 CI workflow + lock 回写
- [x] 双 Job（gate 全触发 + release 仅 tag/dispatch；修复 gate-if 连带 skip 缺陷与 tag 触发缺失）
- [x] 断言可达模式 `|| code=$?`（000 缺陷 #1 修复，FR-002-004）；显式 setup-node（#4）
- [x] 装机钉版 env 块（Gradle/Node/JDK/NDK/API）+ setup-python host 3.14.10 + resolve 版本与 lock 断言
- [x] fetch→build→provision（out/assets/check）→assembleRelease→归档+sha256 侧车→Release→artifacts
- [x] 缓存层（fetch 五源按 lock 哈希键 + ccache）— FR-002-008
- [x] tools/lock-writeback.mjs（回写四值+released；只出 diff 不落库）实测：diff 正确（size/sha256/ndk/flags/status/gates note）
- [x] workflow 结构 10 项断言 + YAML parse 全过；VERSION_NAME 加注（000 §9 #2 处置）

## T6 打包面（host 侧 E2E）
- [x] 合成夹具投放 jniLibs + 真实 stdlib-assets 投放 → `gradle :python-cli:assembleDebug`
      → AAR 4.77MB：jni/arm64-v8a/{libpython_cli.so,libpip.so,libpip3.so} +
      assets/python-bridge-tools/{Lib,ensurepip,cacert.pem,manifest.json(1078 文件)} ✓（TC-003-17）

## 遗留 ⬜（如实登记，非本批可完成）
- 交叉编译①–⑤真实执行（CI ubuntu；NDK r28c 精确版本号首跑核对）
- Setup.local 静态段与 android.py 覆盖参数的首轮实测回写（R1/R2）
- beeware transitive deps（bzip2/xz/zstd/libffi）入 lock 记录面（首产时评估）
- Release 真实跑批 + lock 回写 PR（须 tag 推送权限）
