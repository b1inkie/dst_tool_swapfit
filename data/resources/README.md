# 外置资源与料理预设

开发：项目 data/resources，输出 data/output。分发：EXE 同目录 resources，输出 EXE 同目录 output。与当前工作目录无关，不打进前端静态资源。

此目录保留锅子预设、完整料理 SCML 模板及 Wilson 预览包。新增模板请保留完整目录结构，并配置 presets.json。

建议结构：

```
resources/
  presets.json
  scenes/cook_pot.zip
  templates/my_dish/
    dish.scml
    food/food-0.png
    ...其余模板文件
```

配置示例（路径和通道必须改成实际值，不保证示例名称符合你的素材）：

```json
{
  "version": 1,
  "presets": [{
    "id": "cooking",
    "name": "锅内料理",
    "scene": "scenes/cook_pot.zip",
    "templateDir": "templates/my_dish",
    "scml": "dish.scml",
    "image": "food/food-0.png",
    "targetSymbol": "实际锅子食物通道",
    "sourceSymbol": "实际SCML的folder名称",
    "exportPlaceholder": "xplaceholderx",
    "animation": "实际动画名",
    "facing": 255,
    "fixedFrame": 0
  }]
}
```

- scene 当前需要同时含 anim.bin、build.bin 和图集的 ZIP。
- scml、image 相对 templateDir；image 要与 SCML file 的路径完全一致。
- sourceSymbol 是模板 SCML 的 folder 名字；targetSymbol 是锅子 ANIM 中的 symbol，不是 layer 名。
- exportPlaceholder 是独立的导出文字占位符（必填），不是完整sourceSymbol。当前模板只替换 xplaceholderx，保留dish_前缀。整个templateDir文件夹（包括最外层名字）均复制进output，不能把内部内容摊平。
- animation、facing 可省略以取第一个动画；fixedFrame 可省略以沿用场景引用的图片编号。只有一张图片的料理建议明确指定其帧编号。
- image 目前只支持替换一个 PNG 画布；多视角、多帧图片分别调整尚未实现。
- 模板原PNG尺寸是输出尺寸。导出只替换 image 像素和 exportPlaceholder 字面内容；SCML动画、pivot、矩阵和其他图片像素保持不变。最外层目录、文件/子目录名与SCML中的路径、名称同步作同一占位符替换。
- 输入自动去透明边，缩放默认1，用户在锅内调整平移、缩放、旋转。画布外部分被裁掉，不会扩大图层。
- 图片导入即创建 EXE/项目根目录 output/料理动画-原图片名/，保留中文、空格、减号（无扩展名），重名加编号。料理名另行校验：图片名合法则使用；不合法弹窗修改或选择defaultdish。弹窗确认同步工程内部名称，后续仍可改，但不会更改原图片名的输出目录。应用写入模板副本；重复应用另建编号副本，不覆盖既有成果。
- 路径不允许越出 resources；模板目录不允许符号链接。
