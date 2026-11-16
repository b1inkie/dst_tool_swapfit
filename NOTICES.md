# 资源与第三方内容说明（NOTICES）

本仓库源代码采用 [MIT License](LICENSE)（版权所有 2026 b1inkie）。

## 游戏素材（不属于 MIT 许可范围）

`data/resources` 与 Release 附件中包含《饥荒联机版》（Don't Starve Together）的游戏资源，供工具**读取、预览和对位**使用：

- `cook_pot.zip` — 锅具动画与图集
- `wilson.zip` — Wilson 角色 build
- `player_idles.zip` — 玩家待机动画
- `dish_xplaceholderx/`、`swap_xplaceholderx/` — 基于上述资源整理的对位模板

这些素材由 Klei Entertainment 版权所有，**不适用 MIT 许可，不随源代码授权**。依据 Klei 的模组政策（https://www.klei.com/faq-mods ），随工具分发仅用于在《饥荒》生态内制作模组内容。除配合本工具对位用途外，不得再分发、倒卖或用于《饥荒》之外的作品。发布相关作品请遵守 Klei 的现行条款。

## 第三方组件

- **Tauri**（MIT/Apache-2.0）、**React**（MIT）、**fflate**（MIT）、**fast-xml-parser**（MIT）等依赖许可见其官方仓库。
- 打包产物包含 **NSIS**（zlib/libpng 许可）及 Tauri 自带的 WebView2 加载逻辑。
- **Meilisearch / FFmpeg 等未包含**；本工具不内嵌 FMOD 或其他受专有许可的第三方二进制。

## 用户内容

用户在 `output` 目录生成的工程及其使用的自有图片归用户所有，工具不主张任何权利。
