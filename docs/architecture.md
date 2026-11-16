# DST SwapFit：架构约定

## 分层

1. **桌面 host（src-tauri）**：文件读取、ZIP/SCML 关联图片、路径安全（拒绝穿越与符号链接）、输出目录预留与打开、对话框。所有二进制与文件系统访问只经 Tauri command 白名单暴露，前端不持有任意路径读取能力。
2. **importers（src/importers）**：BILD v6、ANIM v4、KTEX（BC1/2/3 与未压缩）、Spriter SCML。读取器对损坏输入显式拒绝（截断、计数越界、版本不符、非有限值、哈希冲突），不做静默兜底。输出统一、不可变的 AssetPackage。
3. **core（src/core）**：包注册表、通道收集、素材解析、跨包 override、图片局部偏移、工程命令与撤销重做。纯 TypeScript，不依赖 React/Tauri/Canvas。
4. **renderer（src/renderer）**：从 core 生成的绘制项绘制。Canvas2D 三角形纹理映射；同一 UV 映射的相邻三角形合并裁剪，避免共享边透明缝。不假定 build 帧是四边形。
5. **UI（src/cooking、src/Workbench、src/App）**：料理/手持共用一个 CookingWorkspace（kind 区分 profile 与显隐规则），通用资源工作区独立。

## 坐标契约

统一 x 向右、y 向下的素材局部坐标；导入器负责源格式的轴向、UV 行序与预乘 alpha，UI 不做额外翻转。

仿射矩阵 `[a,b,c,d,tx,ty]`：`x'=a*x+c*y+tx`，`y'=b*x+d*y+ty`。

```
图片位置 = View × AnimElement × 图片局部偏移 × 素材顶点
红点位置 = View × AnimElement × 原点
```

- AnimElement 原矩阵不因拖动图片而改变。
- 鼠标屏幕位移经 `(View × AnimElement)` 线性部分的逆矩阵换算为局部 delta；反射、非均匀缩放、shear 保留完整矩阵，不拆 rotation/scale。
- 奇异矩阵不可逆时禁用拖动并报告，不产生 NaN。
- 制作工作区中场景（锅子/人物）完全不参与命中检测；只有导入图片的自身范围与手柄可选中，被场景遮挡不受影响。

## 稳定身份

- 包以内容摘要为 ID；build/symbol/frame 引用始终携带 packageId，不用全局 build 名当 key。
- 动画元素同时保留 symbolHash 与 layerHash，二者不是同一概念；override 匹配 symbol，可限定 layer，来源为另一包的 symbol。
- 规则默认保留动画素材 frame 编号，可显式 fixedFrame；缺素材通道保留在列表中（可选中、显示红点、可 override），不拿别的图兜底。

## 制作工作区（料理/手持）

- profile（`src/workspaces/profile.ts`）区分默认内部名、输出前缀、显隐规则：料理 `swap_low` 单层（对应游戏 potlevel），手持隐藏 `ARM_normal`。
- 图片导入即预留 `output/前缀-原图片名/` 目录（重名加编号）；内部名独立校验 `[A-Za-z_][A-Za-z0-9_]{0,79}`，非法弹窗，默认 `defaultdish`/`defaultitem`。
- 导出复制完整模板目录树（含最外层），仅做 `exportPlaceholder`（当前 `xplaceholderx`）的字面替换（SCML 内容、文件名、目录与引用路径）并替换目标 PNG；`applyAllImages` 时替换模板内全部同尺寸 PNG，任一尺寸不符拒绝导出。SCML 除该替换外保持原字节，源模板不改。

## 工程与编辑

通用资源工作区的 Project(schemaVersion=1) 保存包引用、选择、override、局部偏移；源文件不可变，修改经纯命令产生新工程，拖动结束一次提交，撤销占一条历史。制作工作区的变换历史独立于通用工程。

## 验收

1. 纯核心测试：矩阵逆、反射/缩放拖动、红点不变、包 ID 冲突、frame 保留/缺失、撤销重做、工程校验。
2. 合成 ZIP/SCML：加载、采样、多素材帧、方向、z 顺序、透明像素、多块网格。
3. 真实素材（本机 `data/resources`，不入公开仓库，CI 中自动跳过）：场景显隐、预设加载、模板导出逐字节核对。
4. 浏览器 CDP 交互回归：拖动/手柄/快捷键/视图不变式（视图变化不影响导出字节）。
5. 打包与发布回归（进行中：NSIS + 官方 Updater）。
