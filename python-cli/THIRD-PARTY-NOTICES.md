# THIRD-PARTY-NOTICES — aosp-python-cli

本 AAR 随包分发的第三方组件与许可：

- **CPython**（`libpython_cli.so` 本体与 `Lib/` stdlib）——
  Python Software Foundation License Version 2（PSF-2.0）：
  https://github.com/python/cpython/blob/main/LICENSE
- **ensurepip 内嵌 wheel**（pip 等，随 CPython 源码分发）——各 wheel 自身许可（pip 为 MIT）
- **OpenSSL**（静态链入 `_ssl` 扩展，若启用）—— Apache-2.0（OpenSSL 3.x）
- **CA bundle**（随包根证书集合）——按所选来源（如 cURL 的 cacert.pem）随 Release 归档分发

纪律：

- 二进制不入库，由 CI 从官方 CPython 源码构建（sha256 校验，源码不改；
  Android 专用配置经 configure 参数注入，符合 PEP 738 官方支持的口径）；
- 完整许可全文随 GitHub Release 归档分发；
- 本仓库自身代码适用仓库根 [LICENSE](../LICENSE)（MIT）。
