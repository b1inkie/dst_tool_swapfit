# 设置与更新

设置页位于 src/settings/SettingsWorkspace.tsx，官方 Tauri Updater 已注册。流程为手动检查 → 下载并校验签名 → 确认当前工作已保存 → 安装并重启（Windows）。失败可重试；切换工作区保留状态。安装会关闭应用，不自动保存未制作的图片编辑。

当前未配置任何远程 endpoint 或公钥。Debug 版本不启用更新安装；Release 缺少 updater 配置时显示“此版本尚未接入更新服务”，不会将未配置误报为最新版本。浏览器预览无法检查更新。

发布接入仍待完成：
- GitHub 仓库与可公开获取的 latest.json 地址。
- Tauri updater 公钥写入 plugins.updater，私钥由发布环境安全保管，不进仓库。
- NSIS 安装包及 createUpdaterArtifacts、签名附件、版本一致的 manifest。
- 安装与升级时完整部署标准 resources，保护用户模板及 output；实际安装/升级/失败恢复验收。

测试页面时使用模拟 IPC 验证最新版本、网络错误、下载错误、重试、安装确认及切换工作区保留状态；这些检查不等于通过真实签名安装升级验收。
