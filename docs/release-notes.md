设置页新增 GitHub 仓库与历史版本下载链接（tauri-plugin-opener，仅允许本仓库 URL）；修复按钮回调。发布 v0.1.1。

改进：
- 设置页可直接打开 GitHub 仓库、历史版本下载页与 QQ 交流群（饥荒mod制作技术交流 623398781）链接，仅允许白名单地址。
- start.bat 自动清理残留的 1420 端口开发服务。
- 新增 MIT 许可证与 NOTICES 资源归属说明。

安装本版后，v0.1.0 用户可在设置页检查并安装更新；安装会关闭应用，请先完成当前制作。macOS 仍为 ad-hoc 签名未公证，Gatekeeper 可能拦截；Apple Silicon 产物由 Intel Mac 交叉编译，未做 ARM 实机交互验收。
