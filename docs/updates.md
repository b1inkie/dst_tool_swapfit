# 设置与更新

设置页使用官方 Tauri Updater：手动检查 → 下载并校验签名 → 确认当前工作已保存 → 安装并重启。Windows 交由 NSIS 安装器重启，macOS 安装完成后调用 process.relaunch。失败可重试，切换工作区保留状态。未制作的图片调整不会自动保存。

更新地址：`https://github.com/b1inkie/dst_tool_swapfit/releases/latest/download/latest.json`。公钥在 tauri.conf.json；私钥仅在维护者用户目录 .tauri/dst-swapfit 和 GitHub Actions Secret `TAURI_SIGNING_PRIVATE_KEY`，不进仓库。必须备份并长期保留同一私钥，否则既有客户端无法验证更新。

Debug 版本不安装更新；正式版启用。首次 Release 发布前地址会返回404，不能将其视为“最新版本”。

## 发布

1. 同步 package.json、package-lock.json、Cargo.toml/Cargo.lock、tauri.conf.json 版本，更新 docs/release-notes.md。
2. 推送 `v版本` 标签触发 .github/workflows/release.yml。手动运行 workflow 仅构建和上传 Actions 附件，不发布 Release。
3. Windows NSIS 与两个Mac架构全部成功后才生成完整latest.json并发布，防止不完整更新清单。ARM 包暂用 Intel runner 交叉编译，不能替代 ARM 实机验证。
4. Windows 为 currentUser 安装，标准 resources 随包部署，output 不属于安装清单。Mac标准资源在.app内，输出在用户Documents；自定义模板应先备份，标准资源目录不是永久用户存储区。

更新签名与 Apple Developer ID/公证、Windows Authenticode 是不同机制。目前只配置 Tauri 更新签名，Mac仍为ad-hoc测试签名，不代表已公证或免系统拦截。

页面已有模拟IPC回归；真实旧版本→新版本安装、输出保留和系统权限仍需发布产物验收。
