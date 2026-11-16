# macOS 构建与验证

GitHub Actions `macOS build and test` 在 Apple Silicon（macos-14）和 Intel（macos-15-intel）runner 上分别执行 TS 测试、Rust 测试、Tauri app/DMG 构建、图集与模板完整性校验、代码签名校验和 12 秒进程启动检查。

配置由 Tauri 自动合并 `src-tauri/tauri.macos.conf.json`。透明无边框窗口启用 `macos-private-api`，面向直接下载分发，不以 Mac App Store 为目标。

- Debug：继续使用项目 data/resources 和 data/output。
- Release：标准资源内置在 DST SwapFit.app/Contents/Resources/resources。
- Release 输出：~/Documents/DST SwapFit/output；不写入应用包，升级替换 .app 不会覆盖制作成果。
- 输出目录通过 /usr/bin/open 打开。

产物是 ad-hoc 签名测试版，**没有 Developer ID 签名、公证，也未启用在线更新**。测试版不能当作正式已公证安装包发布。

CI 启动检查仅检测进程存活、启动崩溃与包内容；不代替实际 Mac 上的文件拖放、窗口缩放、手柄编辑、模板导出、Finder 打开和系统权限交互验收。正式发布前仍需要这些人工验证以及 Apple 签名、公证、Updater 签名和升级测试。
