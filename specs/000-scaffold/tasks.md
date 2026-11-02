# 000-scaffold 任务拆解

> 对应：[spec.md](./spec.md)。原则：骨架完整、简单编译通过；不本地产出 `.so`；真实交叉编译属 M1。

## T1 Gradle 工程骨架
- [x] T1.1 `settings.gradle.kts`（rootName=aosp-python-cli，include :python-cli）— FR-000-001
- [x] T1.2 `gradle/libs.versions.toml`（AGP 9.2.1）
- [x] T1.3 `gradle.properties`（CLI_VERSION=3.14.0 draft、POM_*、RELEASE=false）— FR-000-003
- [x] T1.4 `gradle.properties.local.example`
- [x] T1.5 `publish.gradle.kts`（移植 node-cli 发布面，url 改为 aosp-python-cli）
- [x] T1.6 `python-cli/build.gradle.kts`（**useLegacyPackaging=true**，版本覆盖）— FR-000-002/004
- [x] T1.7 验收：无 `.so` 下 `gradle :python-cli:assembleDebug` 成功

## T2 唯一事实源
- [x] T2.1 `python-cli.lock.json`：active=3.14.0/arm64-v8a，draft（exec gates 键，无 pairedRuntime）

## T3 投放与门禁工具
- [x] T3.1 `tools/provision.mjs`（exec profile：ET_DYN/INTERP=系统 linker64/AArch64/白名单/16K/sha/size）
- [x] T3.2 仅投放 libpython_cli.so；jniLibs 禁入 libnode.so；META-INF/python-cli.properties
- [x] T3.3 退出码 0/2/1 + `node --check`

## T4 构建脚本（骨架）
- [x] T4.1 `scripts/fetch-python-cli-source.mjs`（接口 + SCAFFOLD 退出码 2）
- [x] T4.2 `scripts/build-python-cli-android.sh`（PEP 738 + 静态扩展六条纪律注释）
- [x] T4.3 `node --check` / `bash -n`

## T5 CI（scaffold）
- [x] T5.1 `.github/workflows/build-python-cli-android.yml`：配置期门禁 + 自检

## T6 卫生 / 许可 / 文档
- [x] T6.1 `.gitignore`（jniLibs .so、assets 树、.dist）
- [x] T6.2 `python-cli/THIRD-PARTY-NOTICES.md`（CPython PSF-2.0）
- [x] T6.3 `README.md` + `README_zh.md`

## T7 规格文档
- [x] T7.1 `specs/000-scaffold/{spec,tasks,test-cases}.md`

## T8 验证
- [x] T8.1 `gradle :python-cli:assembleDebug` 通过
- [x] T8.2 provision `--check` 未投放退出码 2；语法门全过
- [x] T8.3 提交（Conventional Commits；父工程不提交）
