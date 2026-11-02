# 001-building 任务拆解

> 对应：[spec.md](./spec.md) / [plan.md](./plan.md)。原则：代码本批全量落地；交叉编译本体验证留 CI（002）。

## T1 lock 扩展（五源钉选表）
- [x] T1.1 `builtFrom.deps` 五项（cpython/openssl/sqlite/pip/cacert：version+url+sha256 空串）— FR-001-001/004
- [x] T1.2 版本取值核对：OpenSSL/sqlite/pip/cacert 以撰写日官方最新稳定版填 version（sha256 留空待钉）

## T2 fetch 实现（替换骨架）
- [x] T2.1 读 lock deps → 五源计划；空 sha256 ⇒ exit 1（FR-001-001）
- [x] T2.2 下载（可重入，哈希一致跳过；不一致 exit 1）— FR-001-002
- [x] T2.3 解压（tgz/zip）→ `.dist/src/{cpython,openssl,sqlite}` + pip wheel/cacert 原件保留
- [x] T2.4 FETCH-METADATA.json（五源 url/version/sha256/获取时间）— FR-001-003
- [x] T2.5 `node --check` 过 + 真实五源下载实测（网络允许时）

## T3 build 脚本实现（替换骨架）
- [x] T3.1 参数面扩展（--host-python/--jobs/--dry-run/--extension-mode/--skip-extensions）
- [x] T3.2 步① env（NDK toolchain 解析，缺失 exit 1）
- [x] T3.3 步② host python 版本断言 — FR-001-010
- [x] T3.4 步③ configure 命令组装 + Setup.local `*static*` 段生成（_ssl/_hashlib/zlib/_sqlite3 + vendored 路径）— FR-001-011/012
- [x] T3.5 步④⑤ make/strip（llvm-strip → libpython_cli.so）— FR-001-014
- [x] T3.6 步⑥ stdlib 收集与剔除（test/idlelib/tkinter/__pycache__/*.pyc）— FR-001-020
- [x] T3.7 步⑦ pip 树解包（unzip wheel → site-packages）+ libpip.so/libpip3.so 壳脚本 + ensurepip/CA — FR-001-021/022/023
- [x] T3.8 步⑧ BUILD-METADATA.txt — FR-001-034
- [x] T3.9 `--dry-run` 全流程打印（Windows 本地可跑）
- [x] T3.10 `bash -n` 过 + dry-run 断言（⑥⑦ 用 host python Lib/ 替身实测）

## T4 provision 扩展
- [x] T4.1 `--assets <dir> --assets-mode stage|verify` — FR-001-030/031
- [x] T4.2 manifest.json 生成（逐文件 sha256/totalSha256/fileCount/generatedAt）
- [x] T4.3 静态性检查（assets 树禁 `.so`）— FR-001-032
- [x] T4.4 jniLibs 白名单扩展（libpip.so/libpip3.so sh 壳内容校验）— FR-001-033
- [x] T4.5 `node --check` + 合成 fixtures 全链测试（投放/复验/篡改检出）

## T5 验证与登记
- [x] T5.1 host 侧用例执行（见 overall-test-cases.md TC-001-xx host 子集）
- [x] T5.2 000-scaffold plan §9 缺陷 #3（白名单冲突）状态更新为「已实现扩展」
- [x] T5.3 提交（Conventional Commits：feat(build)/feat(provision)…）
