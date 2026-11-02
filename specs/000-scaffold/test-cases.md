# 000-scaffold 测试用例

> 对应：[spec.md](./spec.md) §4。执行环境：Windows + Gradle 9.4.1 + Temurin 21。

| # | 用例 | 步骤 | 期望 |
|---|---|---|---|
| TC-01 | 干净工程可配置 | `gradle :python-cli:tasks` | BUILD SUCCESSFUL |
| TC-02 | AAR 容器可产出 | `gradle :python-cli:assembleDebug` | aar 产物存在 |
| TC-03 | 版本坐标解析 | 配置日志 | version = `CLI_VERSION`（3.14.0 draft） |
| TC-04 | provision 语法 | `node --check tools/provision.mjs` | 0 |
| TC-05 | provision 未投放语义 | `node tools/provision.mjs --check` | 退出码 = 2 |
| TC-06 | fetch 骨架语义 | `node scripts/fetch-python-cli-source.mjs --python 3.14.0` | 退出码 = 2 |
| TC-07 | build 骨架语义 | `bash scripts/build-python-cli-android.sh --python 3.14.0 --src x --ndk y --out z` | 退出码 = 2 |
| TC-08 | 脚本语法 | `bash -n scripts/build-python-cli-android.sh` | 0 |
| TC-09 | 二进制不入库 | `git status --porcelain` | jniLibs/assets 无条目 |

## 执行记录（2026-11-02，scaffold 提交前）

- TC-01/02：✅ `assembleDebug` BUILD SUCCESSFUL（python-cli-debug.aar 产出）。
- TC-03：✅（version = CLI_VERSION=3.14.0 draft）。TC-04：✅。
- TC-05：✅（exit=2，文案含"未投放"与"draft 无锁值"）。
- TC-06/07：✅（fetch/build 骨架 exit=2 符合）。TC-08：✅（bash -n 过）。TC-09：✅。
