# 002-building-workflow — 模块技术方案（plan.md）

> **性质**：**实现特定**。回答 002 的「怎么做」：workflow 双 Job 结构、装机矩阵、断言修复模式、
> 归档与 lock 回写物生成、缓存策略。
> **成对文档**：功能规格见 [spec.md](./spec.md)（`FR-002-001…009` 唯一权威定义处）；任务分解见
> [tasks.md](./tasks.md)；上游契约见 [`../001-building/plan.md`](../001-building/plan.md)。
> **状态**：⬜ 本批实现 workflow 文件；真实跑批与 Release ⬜ 待 tag 推送（本机不可推）。

---

## 1. 技术上下文

| 项 | 取值 | 说明 |
|---|---|---|
| runner | `ubuntu-24.04` | 规划 §9 |
| JDK | Temurin 21（`actions/setup-java`） | Gradle 配置门沿用 |
| Node | 20（`actions/setup-node`，修复 000 登记的「CI 未显式 setup-node」建议项） | provision/fetch 运行时 |
| NDK | r28c（`android-actions/setup-android` + sdkmanager 或直接解包钉 sha256）⬜ 首跑核对 | 规划 §4.1 |
| host build python | `deadsnakes`/官方 tarball 自建，版本 = 目标版本（3.14.x）⬜ | FR-001-010 前置 |
| 工具 | curl/file/tar/xz/unzip（runner 预装）+ ccache（`apt`/`actions/cache`） | 规划 §9 缓存 |

## 2. workflow 双 Job 结构（FR-002-001/003/006）

改造 `.github/workflows/build-python-cli-android.yml`（保留文件名，Job 重排）：

```
on: push(branches main, paths 忽略 docs) · pull_request · workflow_dispatch(inputs: python_version)
    · push(tags: 'v*')
jobs:
  gate:            # 配置期门禁（push/PR/dispatch 全触发）
    - checkout · setup-java 21 · setup-node 20
    - gradle :python-cli:tasks（FR-000-040）
    - node --check tools/*.mjs scripts/*.mjs；bash -n scripts/*.sh（FR-000-042）
    - 退出码断言（修复后模式，§3）
    permissions: contents: read
  release:         # 仅 tag v* / dispatch 显式输入版本触发
    needs: gate
    - 装机（§1 矩阵）→ resolve 版本（tag 去掉 v 前缀，与 lock active 比对）
    - node scripts/fetch-python-cli-source.mjs --python <ver> --out .dist/src
    - bash scripts/build-python-cli-android.sh --python <ver> --api <lock> --src … --ndk … --out .dist/out --host-python <hp>
    - node tools/provision.mjs --out python-cli/src/main/jniLibs --from .dist/out/libpython_cli.so
    - node tools/provision.mjs --assets .dist/out/stdlib-assets
    - node tools/provision.mjs --check（含 assets verify：门禁全过才继续）
    - gradle :python-cli:assembleRelease（AAR 产物一并归档验证）
    - 打包 tar.gz + sha256 侧车 + lock 回写 diff artifact（§4）
    - softprops/action-gh-release（tag 钉 commit）
    permissions: contents: write（仅本 Job）
```

- **失败即停**：Job 步骤默认 fail-fast；显式断言步骤只用于「预期非零」场景（§3）。
- **触发隔离**：release Job 用 `if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'`。

## 3. 退出码断言修复（FR-002-004，000 缺陷 #1）

现状缺陷（[`../000-scaffold/plan.md`](../000-scaffold/plan.md) §9 #1）：Actions 默认
`bash -eo pipefail`，`node tools/provision.mjs --check` 退出 2 时 shell 在 `code=$?` 赋值前
终止，断言分支永不执行。修复模式（所有「预期非零」自检统一）：

```yaml
- name: provision --check must exit 2 before provisioning
  run: |
    code=0
    node tools/provision.mjs --check || code=$?
    if [ "$code" -ne 2 ]; then
      echo "::error::expected exit 2, got $code"; exit 1
    fi
```

（`|| code=$?` 使非零退出被捕获，随后显式断言；fetch 骨架语义断言同模式。）

## 4. 归档与 lock 回写物（FR-002-005/007）

- 归档：`python-cli-v${VER}-android-arm64-v8a.tar.gz`（`libpython_cli.so` + `libpip.so` +
  `libpip3.so` + `stdlib-assets/` + `BUILD-METADATA.txt` + `FETCH-METADATA.json` +
  `LICENSE` + `python-cli/THIRD-PARTY-NOTICES.md`）+ `sha256sum` 侧车 + AAR 一并上传。
- lock 回写 diff：脚本化生成（`node tools/lock-writeback.mjs --from .dist/out --build-meta …`，
  输出回写后的 lock 全文 + diff 到 artifact `lock-writeback`），**不 push main**——维护者
  下载 artifact 后人工 PR（M4 再评估自动化）。回写四值：`size`/`sha256`/`builtFrom.ndk`/
  `builtFrom.flags` + `status:"released"` + `gates` 注释行。

## 5. 缓存（FR-002-008）

- `actions/cache` 键：`fetch-<cpython-sha256前12>-<openssl-sha256前12>-<sqlite-sha256前12>`，
  path `.dist/src`（fetch 可重入保证命中正确性，FR-001-002）。
- ccache：`~/.cache/ccache`，键含 NDK 版本 + Setup.local 摘要。
- OpenSSL/sqlite 构建中间物首轮实测耗时后决定是否独立缓存层（规划 §9 ⬜）。

## 6. 测试考虑

- 本批静态验证：YAML 解析（`node -e yaml` 或 actionlint 若可得）+ 断言模式 grep 检查
  （`|| code=$?` 存在性）+ 触发条件/permissions 结构核对。
- 真实跑批 ⬜：首次 tag `v3.14.x` 推送后按 [`../overall-test-cases.md`](../overall-test-cases.md)
  TC-002-xx 执行并回填。

## 7. 不一致与风险登记

| # | 项 | 处置 |
|---|---|---|
| 1 | NDK 装机方式（setup-android vs 直接钉链接）首跑核对 ⬜ | workflow 内集中一个 env 钉版本；实测后回写 |
| 2 | host python 3.14 在 ubuntu-24.04 的可得性（deadsnakes 跟进节奏）⬜ | 失败退路 = 官方 tarball 自建步骤（注释保留） |
| 3 | Gradle wrapper 仍缺（000 登记建议项 #2） | 本批维持 setup-gradle 钉版口径；wrapper 引入另立任务 |
