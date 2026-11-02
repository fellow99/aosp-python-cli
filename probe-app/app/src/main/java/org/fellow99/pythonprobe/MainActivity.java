package org.fellow99.pythonprobe;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * python-cli 探针载体（M2-T1 / specs 003-cli + 101-pip-integration tasks T4.1）。
 *
 * 职责（镜像 docs/000-工程规划.md §3 消费方环境引导层 + §7 环境变量契约）：
 *  1) 物化：assets/python-bridge-tools/** → filesDir/python-bridge-tools（marker 幂等）；
 *  2) 注入：PYTHONHOME/SSL_CERT_FILE/HOME/TMPDIR/PATH（规划 §7 全表）；
 *  3) 执行：ProcessBuilder exec nativeLibraryDir/libpython_cli.so 与 libpip.so（非 PTY 子集；
 *     REPL/PTY 语义归终端 App，TC-003-13 按 BLOCKED 登记）；
 *  4) 判据：TC-003-01…15 与 TC-101-01…14 的可执行子集，逐条 PASS/FAIL/BLOCKED + JSON 报告。
 */
public class MainActivity extends Activity {

    private TextView logView;
    private File toolsDir;      // filesDir/python-bridge-tools
    private String nativeDir;  // applicationInfo.nativeLibraryDir
    private String pyExe;      // nativeDir/libpython_cli.so
    private String pipSh;      // nativeDir/libpip.so
    private final StringBuilder uiLog = new StringBuilder();
    private final List<JSONObject> report = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        nativeDir = getApplicationInfo().nativeLibraryDir;
        pyExe = nativeDir + "/libpython_cli.so";
        pipSh = nativeDir + "/libpip.so";
        toolsDir = new File(getFilesDir(), "python-bridge-tools");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        Button run = new Button(this);
        run.setText("RUN ALL PROBES");
        run.setOnClickListener(v -> runAll());
        ScrollView scroll = new ScrollView(this);
        logView = new TextView(this);
        logView.setTypeface(android.graphics.Typeface.MONOSPACE);
        logView.setTextIsSelectable(true);
        logView.setTextSize(11f);
        int pad = (int) (getResources().getDisplayMetrics().density * 8);
        logView.setPadding(pad, pad, pad, pad);
        scroll.addView(logView);
        root.addView(run, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
        log("probe-app ready\nnativeDir=" + nativeDir + "\ntoolsDir=" + toolsDir
                + "\n点击 RUN ALL PROBES 执行（首次会物化 assets，约 1-2 分钟）");
    }

    private void log(String s) {
        runOnUiThread(() -> {
            uiLog.append(s).append('\n');
            logView.setText(uiLog.toString());
        });
    }

    // ── 物化（marker 幂等：manifest.json totalSha256 与上次一致则跳过）──────────

    private String assetsMarker() {
        try {
            InputStream is = getAssets().open("python-bridge-tools/manifest.json");
            String m = readAll(is, 1 << 20);
            int i = m.indexOf("\"totalSha256\"");
            if (i < 0) return null;
            int q1 = m.indexOf('"', i + 13) + 1;
            int q2 = m.indexOf('"', q1);
            return m.substring(q1, q2);
        } catch (IOException e) {
            return null;
        }
    }

    private void materialize() throws IOException {
        String marker = assetsMarker();
        SharedPreferences prefs = getSharedPreferences("probe", Context.MODE_PRIVATE);
        String prev = prefs.getString("tools.sha", "");
        File done = new File(toolsDir, "manifest.json");
        if (marker != null && marker.equals(prev) && done.isFile()) {
            log("物化跳过（marker 一致：" + marker.substring(0, 12) + "…）");
            return;
        }
        long t0 = System.currentTimeMillis();
        deleteRecursive(toolsDir);
        toolsDir.mkdirs();
        int n = copyAssetTree("python-bridge-tools", toolsDir);
        prefs.edit().putString("tools.sha", marker == null ? "" : marker).apply();
        log("物化完成：" + n + " 文件，" + (System.currentTimeMillis() - t0) + "ms");
    }

    private int copyAssetTree(String path, File dest) throws IOException {
        AssetManager am = getAssets();
        String[] children = am.list(path);
        if (children == null) return 0;
        int n = 0;
        File dir = new File(dest, path.equals("python-bridge-tools") ? "" : "");
        // 简化：直接按 assets 相对路径递归
        for (String c : children) {
            String sub = path + "/" + c;
            String[] subChildren = am.list(sub);
            if (subChildren != null && subChildren.length > 0) {
                n += copyAssetTree(sub, dest);
            } else {
                File out = new File(dest, sub.substring("python-bridge-tools/".length()));
                out.getParentFile().mkdirs();
                try (InputStream is = am.open(sub); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[65536];
                    int r;
                    while ((r = is.read(buf)) > 0) os.write(buf, 0, r);
                }
                n++;
            }
        }
        return n;
    }

    private void deleteRecursive(File f) {
        File[] c = f.listFiles();
        if (c != null) for (File x : c) deleteRecursive(x);
        f.delete();
    }

    // ── 环境注入（规划 §7）与执行器 ─────────────────────────────────────────────

    private Map<String, String> baseEnv(boolean withPythonHome) {
        Map<String, String> env = new HashMap<>();
        env.put("HOME", new File(getFilesDir(), "home").getAbsolutePath());
        env.put("TMPDIR", new File(getFilesDir(), "tmp").getAbsolutePath());
        env.put("PATH", nativeDir + ":" + new File(getFilesDir(), "home/bin") + ":/system/bin");
        if (withPythonHome) {
            env.put("PYTHONHOME", toolsDir.getAbsolutePath());
            env.put("SSL_CERT_FILE", new File(toolsDir, "cacert.pem").getAbsolutePath());
        }
        // 不设 PYTHONPATH：pip 树在标准布局 Lib/site-packages（规划 §7）
        return env;
    }

    static class Out {
        String stdout = "", stderr = "";
        int exit = -1;
        long ms;
        boolean timedOut;
        String failReason; // 启动失败等
    }

    private Out exec(List<String> argv, Map<String, String> envIn, String stdin, long timeoutMs) {
        Out o = new Out();
        long t0 = System.currentTimeMillis();
        try {
            new File(getFilesDir(), "home").mkdirs();
            new File(getFilesDir(), "tmp").mkdirs();
            ProcessBuilder pb = new ProcessBuilder(argv);
            pb.directory(getFilesDir());
            pb.redirectErrorStream(false);
            Map<String, String> env = pb.environment();
            env.clear();
            env.putAll(envIn);
            env.put("ANDROID_ROOT", "/system");
            env.put("ANDROID_DATA", "/data");
            env.put("LD_LIBRARY_PATH", nativeDir);
            Process p = pb.start();
            if (stdin != null) {
                try (OutputStream os = p.getOutputStream()) {
                    os.write(stdin.getBytes(StandardCharsets.UTF_8));
                }
            } else {
                p.getOutputStream().close();
            }
            StringBuilder so = new StringBuilder(), se = new StringBuilder();
            Thread t1 = pump(p.getInputStream(), so), t2 = pump(p.getErrorStream(), se);
            if (!p.waitFor(timeoutMs, TimeUnit.MILLISECONDS)) {
                p.destroyForcibly();
                o.timedOut = true;
            }
            t1.join(3000);
            t2.join(3000);
            o.stdout = so.toString();
            o.stderr = se.toString();
            o.exit = p.exitValue();
        } catch (Exception e) {
            o.failReason = e.getClass().getSimpleName() + ": " + e.getMessage();
        }
        o.ms = System.currentTimeMillis() - t0;
        return o;
    }

    private Thread pump(InputStream is, StringBuilder sb) {
        Thread t = new Thread(() -> {
            try (BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) sb.append(line).append('\n');
            } catch (IOException ignored) {
            }
        });
        t.start();
        return t;
    }

    // ── 探针定义 ────────────────────────────────────────────────────────────────

    interface Check {
        String check(Out o); // null=PASS；否则失败原因；以 "BLOCKED:" 开头记 BLOCKED
    }

    static class Probe {
        final String id, title;
        final List<String> argv;
        final Map<String, String> envOverride; // 覆盖/删除基线（value null=删除）
        final String stdin;
        final long timeoutMs;
        final Check check;
        Probe(String id, String title, List<String> argv, Map<String, String> envOverride,
              String stdin, long timeoutMs, Check check) {
            this.id = id; this.title = title; this.argv = argv;
            this.envOverride = envOverride; this.stdin = stdin; this.timeoutMs = timeoutMs; this.check = check;
        }
    }

    private List<String> py(String... args) {
        List<String> a = new ArrayList<>();
        a.add(pyExe);
        for (String s : args) a.add(s);
        return a;
    }

    private List<Probe> probes() {
        List<Probe> l = new ArrayList<>();
        // ── 003-cli：进程与身份 ──
        l.add(new Probe("TC-003-01", "版本串回程", py("--version"), null, null, 30_000,
                o -> o.exit == 0 && o.stdout.startsWith("Python 3.14") ? null
                        : "exit=" + o.exit + " out=" + head(o.stdout)));
        l.add(new Probe("TC-003-02", "-c 执行回程", py("-c", "import sys;print(sys.version_info[:3])"), null, null, 30_000,
                o -> o.exit == 0 && o.stdout.contains("(3, 14,") ? null : "out=" + head(o.stdout) + head(o.stderr)));
        l.add(new Probe("TC-003-03a", "退出码传递 exit 7", py("-c", "import sys;sys.exit(7)"), null, null, 30_000,
                o -> o.exit == 7 ? null : "exit=" + o.exit));
        l.add(new Probe("TC-003-03b", "未捕获异常 exit 1", py("-c", "raise RuntimeError('x')"), null, null, 30_000,
                o -> o.exit == 1 && o.stderr.contains("RuntimeError") ? null : "exit=" + o.exit + " err=" + head(o.stderr)));
        l.add(new Probe("TC-003-04", "stderr 分流", py("-c",
                        "import sys;print('o');print('e',file=sys.stderr)"), null, null, 30_000,
                o -> o.exit == 0 && o.stdout.trim().equals("o") && o.stderr.contains("e") ? null
                        : "out=" + head(o.stdout) + " err=" + head(o.stderr)));
        l.add(new Probe("TC-003-05", "UTF-8 输出", py("-c", "print('你好世界\ud83e\udd86')"), null, null, 30_000,
                o -> o.exit == 0 && o.stdout.contains("你好世界\ud83e\udd86") ? null : "out=" + head(o.stdout)));
        // ── 003-cli：静态扩展（P2）──
        l.add(new Probe("TC-003-06", "sqlite3 闭环", py("-c",
                        "import sqlite3;c=sqlite3.connect(':memory:');c.execute('create table t(a)');"
                                + "c.execute('insert into t values(42)');"
                                + "rows=list(c.execute('select a from t'));print(rows[0][0])"), null, null, 60_000,
                o -> o.exit == 0 && o.stdout.contains("42") ? null : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-003-07", "zlib 闭环", py("-c",
                        "import zlib;d=zlib.compress(b'aosp');print(zlib.decompress(d)==b'aosp')"), null, null, 60_000,
                o -> o.exit == 0 && o.stdout.contains("True") ? null : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-003-08", "hashlib sha256", py("-c",
                        "import hashlib;print(hashlib.sha256(b'aosp').hexdigest()[:16])"), null, null, 60_000,
                o -> o.exit == 0 && o.stdout.trim().matches("[0-9a-f]{16}") ? null : head(o.stdout + o.stderr)));
        // ── 003-cli：stdlib 与 -m ──
        l.add(new Probe("TC-003-10", "stdlib 导入抽查（ctypes 预期缺席）", py("-c",
                        "import importlib.util\nmods=['json','os','sys','re','math','struct','socket','platform','uuid','sqlite3','zlib','hashlib','ssl']\n"
                                + "ok=[m for m in mods if importlib.util.find_spec(m)]\n"
                                + "missing=[m for m in mods if not importlib.util.find_spec(m)]\n"
                                + "print('OK',len(ok));print('MISSING',missing)\n"
                                + "try:\n importlib.import_module('ctypes');print('CTYPES=present')\n"
                                + "except ModuleNotFoundError:print('CTYPES=absent')"), null, null, 60_000,
                o -> o.exit == 0 && o.stdout.contains("OK 13") && o.stdout.contains("CTYPES=absent") ? null
                        : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-003-11", "-m json.tool（stdin 喂入）", py("-m", "json.tool"), null,
                        "{\"a\":1}\n", 30_000,
                o -> o.exit == 0 && o.stdout.contains("\"a\": 1") ? null : head(o.stdout + o.stderr)));
        // ── 003-cli：脚本文件 ──
        l.add(new Probe("TC-003-12", "脚本文件执行", py("t.py"), null, null, 30_000,
                o -> o.exit == 0 && o.stdout.contains("t.py") ? null : head(o.stdout + o.stderr)));
        // TC-003-13 REPL：BLOCKED（PTY 真终端语义归终端 App，本载体 ProcessBuilder 非交互）
        l.add(new Probe("TC-003-13", "REPL 交互", py("-i"), null, null, 5_000,
                o -> "BLOCKED:PTTY 语义需终端 App（node-pty），本探针载体为非交互子集"));
        // ── 003-cli：TLS（P3）──
        l.add(new Probe("TC-003-09", "TLS/CA 生效 HTTPS GET", py("-c",
                        "import urllib.request,ssl;print(urllib.request.urlopen('https://www.python.org',timeout=30).status)"),
                null, null, 90_000,
                o -> o.exit == 0 && o.stdout.contains("200") ? null : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-003-09b", "CA 校验失败路径可预期", py("-c",
                        "import urllib.request;urllib.request.urlopen('https://wrong.host.badssl.com',timeout=30)"),
                envKv("SSL_CERT_FILE", new File(getFilesDir(), "no-such-ca.pem").getAbsolutePath()),
                null, 60_000,
                o -> o.exit != 0 && (o.stderr.contains("CERT") || o.stderr.contains("ssl")) ? null
                        : "exit=" + o.exit + " err=" + head(o.stderr)));
        // ── 003-cli：P6 平台事实 + 错误注入 ──
        l.add(new Probe("TC-003-14", "平台事实记录", py("-c",
                        "import sys,os,platform;print('platform=',sys.platform);print('cpu=',os.cpu_count());"
                                + "print('path0=',sys.path[0] if sys.path else None);print('impl=',platform.python_implementation())"),
                null, null, 30_000,
                o -> o.exit == 0 && o.stdout.contains("platform=") ? null : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-003-15", "PYTHONHOME 缺失错误注入", py("-c", "print(1)"),
                envKv("PYTHONHOME", ""), null, 30_000,
                o -> o.exit != 0 && o.stderr.length() > 0 ? null
                        : "exit=" + o.exit + " err=" + head(o.stderr)));
        // ── 101-pip：命令直出（P4）──
        l.add(new Probe("TC-101-01", "pip --version 直出（libpip.so 壳）",
                arr(pipSh, "--version"), null, null, 60_000,
                o -> o.exit == 0 && o.stdout.startsWith("pip 26.") && o.stdout.contains("python 3.14") ? null
                        : "exit=" + o.exit + " out=" + head(o.stdout) + head(o.stderr)));
        l.add(new Probe("TC-101-02", "pip3 别名（libpip3.so）",
                arr(nativeDir + "/libpip3.so", "--version"), null, null, 60_000,
                o -> o.exit == 0 && o.stdout.startsWith("pip 26.") ? null : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-101-03", "离线首启（代理指向黑洞仍成功=不触网）",
                arr(pipSh, "--version"),
                envKv("https_proxy", "http://127.0.0.1:1", "http_proxy", "http://127.0.0.1:1"), null, 60_000,
                o -> o.exit == 0 ? null : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-101-13", "参数透传 --help", arr(pipSh, "--help"), null, null, 60_000,
                o -> o.exit == 0 && o.stdout.contains("Usage") ? null : head(o.stdout + o.stderr)));
        // ── 101-pip：安装链（P4 主链，需网络）──
        l.add(new Probe("TC-101-04", "纯 py 包安装 packaging", arr(pipSh, "install", "packaging"),
                null, null, 300_000,
                o -> o.exit == 0 ? null : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-101-04b", "import packaging", py("-c", "import packaging;print(packaging.__version__)"),
                null, null, 60_000,
                o -> o.exit == 0 && o.stdout.trim().matches("[0-9.]+") ? null : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-101-05", "pip list / show", arr(pipSh, "list"), null, null, 60_000,
                o -> o.exit == 0 && o.stdout.contains("packaging") && o.stdout.contains("pip") ? null
                        : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-101-06", "sdist 边界拒绝（--no-binary 强制 sdist 路径）",
                arr(pipSh, "install", "--no-binary=:all:", "packaging"), null, null, 300_000,
                o -> o.exit != 0 ? null : "意外成功（sdist 不应可装）" + head(o.stdout)));
        l.add(new Probe("TC-101-06b", "sdist 拒绝后无残留", py("-c",
                        "import importlib.util;print('RESIDUAL' if importlib.util.find_spec('packaging') else 'CLEAN')"),
                null, null, 30_000,
                o -> o.exit == 0 && o.stdout.contains("CLEAN") ? null : head(o.stdout)));
        l.add(new Probe("TC-101-07", "C 扩展包边界（numpy wheel 场景，事实记录）",
                arr(pipSh, "install", "numpy"), null, null, 300_000,
                o -> (o.exit != 0 ? "PASS-REJECTED" : "INSTALLED-RECORD") + "|" + head(o.stdout + o.stderr, 300)));
        l.add(new Probe("TC-101-08", "卸载 packaging", arr(pipSh, "uninstall", "-y", "packaging"),
                null, null, 120_000,
                o -> o.exit == 0 ? null : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-101-08b", "卸载后 import 失败", py("-c", "import packaging"),
                null, null, 30_000,
                o -> o.exit != 0 ? null : "意外可导入"));
        l.add(new Probe("TC-101-09", "ensurepip 兜底", py("-m", "ensurepip", "--upgrade"), null, null, 180_000,
                o -> o.exit == 0 ? null : head(o.stdout + o.stderr)));
        l.add(new Probe("TC-101-11", "CLI 入口脚本事实（exec filesDir 脚本）",
                arr(new File(getFilesDir(), "python-bridge-tools/bin-noexec-probe").getAbsolutePath(), "--version"),
                null, null, 15_000,
                o -> o.failReason != null || o.exit != 0
                        ? "PASS-EXPECTED-UNEXECUTABLE(" + (o.failReason != null ? o.failReason : "exit=" + o.exit) + ")"
                        : "意外可 exec"));
        l.add(new Probe("TC-101-12", "无网络失败可读（代理黑洞）",
                arr(pipSh, "install", "packaging"),
                envKv("https_proxy", "http://127.0.0.1:1", "http_proxy", "http://127.0.0.1:1"),
                null, 120_000,
                o -> o.exit != 0 && (o.stderr.toLowerCase().contains("proxy")
                        || o.stderr.toLowerCase().contains("connection") || o.stderr.toLowerCase().contains("cannot")) ? null
                        : "err=" + head(o.stderr)));
        l.add(new Probe("TC-101-14", "pip 自升级", arr(pipSh, "install", "--upgrade", "pip"),
                null, null, 300_000,
                o -> o.exit == 0 ? null : "BLOCKED:网络/可用性——" + head(o.stderr, 200)));
        l.add(new Probe("TC-101-10", "uv pip 组合", arr(nativeDir + "/libuv.so", "--version"),
                null, null, 15_000,
                o -> "BLOCKED:aosp-uv-cli 未就绪（P5 外部依赖）"));
        return l;
    }


    private static Map<String, String> envKv(String... kv) {
        Map<String, String> m = new HashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(kv[i], kv[i + 1]);
        return m;
    }

    @SafeVarargs
    private static <T> List<T> arr(T... items) {
        List<T> l = new ArrayList<>();
        for (T t : items) l.add(t);
        return l;
    }

    private static String head(String s) {
        return head(s, 160);
    }

    private static String head(String s, int n) {
        if (s == null) return "";
        s = s.replace("\n", "\\n");
        return s.length() > n ? s.substring(0, n) + "…" : s;
    }

    private static String readAll(InputStream is, int max) throws IOException {
        ByteArrayOutputStream2 bos = new ByteArrayOutputStream2();
        byte[] buf = new byte[8192];
        int r, total = 0;
        while ((r = is.read(buf)) > 0 && total < max) {
            bos.write(buf, 0, r);
            total += r;
        }
        return new String(bos.buf(), 0, bos.size(), StandardCharsets.UTF_8);
    }

    private static final class ByteArrayOutputStream2 extends java.io.ByteArrayOutputStream {
        byte[] buf() {
            return buf;
        }
    }

    // ── 主流程 ─────────────────────────────────────────────────────────────────

    private void runAll() {
        new Thread(() -> {
            try {
                report.clear();
                log("── 物化 assets ──");
                materialize();
                // TC-003-12 前置：写脚本文件
                try (OutputStream os = new FileOutputStream(new File(getFilesDir(), "t.py"))) {
                    os.write("import os\nprint('FILE=', __file__)\nprint('NAME=', os.path.basename(__file__))\n"
                            .getBytes(StandardCharsets.UTF_8));
                }
                // TC-101-11 前置：pip 安装产物位置模拟（filesDir 下不可 exec 的事实判据）
                File fake = new File(getFilesDir(), "python-bridge-tools/bin-noexec-probe");
                fake.getParentFile().mkdirs();
                try (OutputStream os = new FileOutputStream(fake)) {
                    os.write("#!/system/bin/sh\necho should-not-run\n".getBytes(StandardCharsets.UTF_8));
                }

                int pass = 0, fail = 0, blocked = 0;
                for (Probe p : probes()) {
                    Map<String, String> env = baseEnv(true);
                    if (p.envOverride != null) {
                        for (Map.Entry<String, String> e : p.envOverride.entrySet()) {
                            if (e.getValue() == null || e.getValue().isEmpty()) env.remove(e.getKey());
                            else env.put(e.getKey(), e.getValue());
                        }
                    }
                    Out o = exec(p.argv, env, p.stdin, p.timeoutMs);
                    // 判据统一交给 check()：预期失败类探针（如 filesDir 不可 exec、uv 缺席）
                    // 需要看到 failReason/非零退出码本身，不得在 runner 层抢先判 FAIL。
                    String verdict = p.check.check(o);
                    String tag = verdict == null ? "PASS"
                            : verdict.startsWith("BLOCKED") ? "BLOCKED"
                            : verdict.startsWith("PASS-") ? "PASS"
                            : "FAIL";
                    if ("PASS".equals(tag)) pass++;
                    else if ("BLOCKED".equals(tag)) blocked++;
                    else fail++;
                    JSONObject j = new JSONObject();
                    try {
                        j.put("id", p.id).put("title", p.title).put("verdict", tag)
                                .put("detail", verdict == null ? "" : verdict)
                                .put("exit", o.exit).put("ms", o.ms)
                                .put("stdout", head(o.stdout, 800)).put("stderr", head(o.stderr, 800));
                    } catch (org.json.JSONException ignored) {
                    }
                    report.add(j);
                    log(String.format("%-12s %-6s %s", p.id, tag, p.title)
                            + (verdict == null ? "" : "  | " + head(verdict, 200)));
                }
                log(String.format("── 汇总：PASS=%d FAIL=%d BLOCKED=%d ──", pass, fail, blocked));
                JSONObject out = new JSONObject();
                out.put("runAt", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ",
                        java.util.Locale.ROOT).format(new java.util.Date()));
                out.put("device", android.os.Build.MODEL + " " + android.os.Build.VERSION.RELEASE
                        + " abi=" + android.os.Build.SUPPORTED_ABIS[0]);
                out.put("nativeDir", nativeDir);
                out.put("probes", new JSONArray(report));
                File f = new File(getFilesDir(), "probe-report.json");
                try (FileOutputStream os = new FileOutputStream(f)) {
                    os.write(out.toString(2).getBytes(StandardCharsets.UTF_8));
                }
                log("报告：" + f + "（adb pull 取回）");
            } catch (Exception e) {
                log("FATAL " + e);
            }
        }).start();
    }
}
