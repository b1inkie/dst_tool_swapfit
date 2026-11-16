# DST SwapFit（DST 贴图对位器）

《饥荒》模组制作辅助工具：把一张料理/手持贴图拖进来，在真实游戏场景中对齐位置、缩放和角度，一键导出可交给打包工具的 Spriter 模板工程。无需安装《饥荒》本体。

- **料理制作**：锅子场景固定 `swap_low` 高度预览，输出 `料理动画-原图片名/` 模板副本。
- **手持制作**：Wilson 持物姿势预览（`ARM_carry` + `swap_object`），输出 `手持动画-原图片名/` 模板副本。
- **动画资源**：通用 ZIP（`build.bin`/`anim.bin`/图集）与 SCML 浏览、播放、跨包 symbol 替换与图片偏移对齐。

导出原则：模板动画、红点、SCML 结构与图层画布尺寸不变，仅替换 `xplaceholderx` 字面占位符与目标 PNG 像素；源模板与用户图片永不被覆盖。

## 玩家使用

1. 下载 Release 中的安装包并安装（每用户目录，无需管理员）。
2. 打开工具，把甲方提供的料理/武器图片拖进窗口。
3. 名称不合规时按弹窗修改，或使用默认名（料理 `defaultdish`、手持 `defaultitem`）。
4. 在场景中拖动图片调整位置；四角手柄缩放（按住 `Shift` 保持比例），上方圆点旋转；右侧可输入精确数值，支持 `Ctrl+Z`/`Ctrl+Y` 撤销重做。
5. 点击“开始制作”，用“打开输出目录”取走工程文件夹。

快捷键：空格＋左键 / 中键 / 空白处拖动平移画布，滚轮缩放，`Ctrl+Z` 撤销，`Ctrl+Shift+Z`/`Ctrl+Y` 重做。

## 数据目录

- 安装版：`resources/`（场景包与模板）在 EXE 同目录，`output/` 为生成工程，均不需要管理员权限。
- 开发版：统一收纳在 `data/resources/` 与 `data/output/`，路径由 `src-tauri/src/resources.rs` 的 `base()` 决定，不依赖工作目录。
- 预设通过 `resources/presets.json` 声明，约定见 [data/resources/README.md](data/resources/README.md)；新增模板只需放入目录并配置预设。

> 注意：`data/resources` 中的游戏场景包（`cook_pot.zip`、`wilson.zip`、`player_idles.zip`）为 Klei 版权素材，**不入 git 仓库**，仅随 Release 附件分发。

## 开发

需要 Node.js 20+、Rust stable（MSVC）、WebView2 Runtime。

```sh
npm install
npm test                                     # 53 项 TS 测试（真实素材缺失时相关项自动跳过）
npm run build                                # 完整 TypeScript 检查 + Vite 构建
npm run tauri dev                            # 桌面开发模式
cargo test --locked --manifest-path src-tauri/Cargo.toml   # Rust 测试
```

Windows 免安装打包（临时分发用，正式发布将改用 NSIS 安装包 + 官方 Updater）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-windows.ps1
```

架构与坐标契约见 [docs/architecture.md](docs/architecture.md)。

## 界面主题

饥荒风视觉：炭棕背景 `#171208`、表面 `#211a10/#2b2215`、边框 `#3f3423`、羊皮纸文字 `#eadfc3/#b7a887/#8b7d61`、火光橙主按钮 `#f19f36` 与点缀 `#ffb340`、手写体标题（Ink Free / Segoe Print，中文回退系统字体）。令牌集中在 `src/style.css` 的 `:root`。窗口为无边框透明圆角壳（12px，最大化取消裁剪），标题栏自定义。活动栏剪影图标未选中 `#8b7d61`、选中 `#ffb340`。

## 许可

源代码采用 [MIT License](LICENSE)；随 Release 分发的游戏素材归 Klei Entertainment 所有，不适用 MIT，约定见 [NOTICES.md](NOTICES.md)。
## 已知限制

- SCML 采样支持 linear/instant 关键帧与骨骼父子变换；复杂曲线与逐关键帧 pivot 显式报错，不做错误预览。
- DYN 动态资源、游戏用动画 ZIP 直接编译导出未实现；导出物为 Spriter 模板工程，交给现有打包工具。
- 程序未签名，Windows SmartScreen 可能告警。
