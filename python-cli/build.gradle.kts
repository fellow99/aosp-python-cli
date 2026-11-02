plugins {
    alias(libs.plugins.android.library)
    id("com.vanniktech.maven.publish.base")
}

// python-cli：exec 型 python 命令行（libpython_cli.so，arm64-v8a PIE）+ stdlib 纯 py 树（assets）。
// 版本号 = 工具上游（CPython）版本（由 python-cli.lock.json 锁定，独立 semver）。
// 关键架构决策（工作区方案 §3.2）：扩展模块全部静态链入（规避 targetSdk≥29 禁止从
// filesDir dlopen 的限制），AAR 内只有一个可执行 + 纯数据 stdlib。
// 二进制/随包树不入库：src/main/jniLibs/ 与 src/main/assets/ 由 tools/provision.mjs 投放。
// 本模块不含任何 Kotlin/Java 源——它只是 AAR 容器。

apply(from = rootProject.file("publish.gradle.kts"))

// 多版本发布：gradle publishToMavenCentral -PCLI_VERSION=3.14.0 -PRELEASE=true
version = (providers.gradleProperty("CLI_VERSION").orNull
    ?: error("python-cli 需要 CLI_VERSION（= CPython 上游版本）；当前未设置"))

afterEvaluate {
    val publishing = extensions.getByType(org.gradle.api.publish.PublishingExtension::class.java)
    publishing.publications.forEach { pub ->
        (pub as Any).javaClass.methods
            .first { it.name == "setVersion" && it.parameterCount == 1 }
            .invoke(pub, version.toString())
    }
}

android {
    namespace = "org.fellow99.pythoncli"
    compileSdk = 36
    defaultConfig {
        minSdk = 24
        ndk {
            abiFilters += "arm64-v8a"
        }
    }
    packaging {
        jniLibs {
            // exec 型工具与 dlopen 库（node-pty）相反：必须物理落盘（extractNativeLibs=true）。
            // targetSdk≥29 的 SELinux 禁止从可写数据目录 exec，nativeLibraryDir 是唯一合规
            // 执行位；useLegacyPackaging=false 时库直接从 APK mmap、不落盘，execve 会 ENOENT。
            useLegacyPackaging = true
        }
    }
}
