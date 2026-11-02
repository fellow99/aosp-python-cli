plugins {
    id("com.android.application")
}

android {
    namespace = "org.fellow99.pythonprobe"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.fellow99.pythonprobe"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-probe"
        // 仅 arm64：验证 exec 型产物（x86_64 模拟器经 ndk_translation 可装可跑，abilist 含 arm64-v8a）
        ndk { abiFilters += "arm64-v8a" }
    }

    // 与容器 AAR 同口径：exec 要求物理落盘 nativeLibraryDir（D2）
    packaging {
        jniLibs { useLegacyPackaging = true }
    }

    androidResources {
        // 消费方契约：python 树含 _internal/_vendor/_bundled 等下划线目录，
        // aapt 默认 ignoreAssetsPattern 的 `<dir>_*` 会丢弃（与容器模块同步覆写）
        ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        getByName("debug") {
            isDebuggable = true
        }
    }
}

dependencies {
    // CI 产物 AAR（jni/arm64-v8a 三件 + assets/python-bridge-tools 全树随 APK 合并）
    implementation(files("libs/python-cli-release.aar"))
}
