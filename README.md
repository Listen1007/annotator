# 通用标注工具

基于 Vue 2 的通用文本实体标注（NER）工具：导入 txt / json 文本，按词库自动提取实体，支持自定义标签、手动框选标注、错词纠正、重叠检查与 JSON 导出。

## 快速开始

**推荐：双击项目根目录的「启动.bat」**，首次运行会自动安装依赖并构建，之后自动打开浏览器（http://localhost:8090）。后续启动秒开。关闭窗口即停止服务。

命令行方式：

```bash
npm install
npm run build    # 构建（新版 Node 需先设 NODE_OPTIONS=--openssl-legacy-provider）
npm start        # 启动本地服务，等价于双击 启动.bat
```

## 使用流程

1. 点击「导入 txt / json」或将文件拖入左侧文本区（自动识别 UTF-8 / GBK 编码）
   - txt：直接作为待标注文本
   - 结构化 json（键值对象）：自动拼接为「字段名：值」的可读文本
   - 本工具导出的标注文件（含 originalText 与 entities）：恢复文本和已有标注，继续标注
2. 导入后自动按词库提取标注，在右侧列表中逐条核对
3. 在文本中框选文字 + 选择标签类型（点击色块或按数字键 `1-9`/`0`），按 `Enter` 添加标注
4. 标签类型可在页面上自定义：点击「＋ 标签」打开管理面板，可添加、删除标签（保存到 `src/data/labels.json`，重启后仍生效；本地服务未启动时暂存于浏览器）
5. 点击标注卡片可在文本中定位；卡片上的「编辑」支持改类型 / 改文本 / 用新框选替换
6. 「整理标签」会按位置排序并移除重复与被包含的标注；导出前需保证无重叠标注
7. 「纠正错字」按错词本批量替换；「标记错字」可将当前框选原文与正确写法加入错词本（仅本次会话生效，持久化需更新 `src/data/correctBook.json`）
8. 「导出 JSON」输出 `{ originalText, entities: [{ label_type, label_text, start_pos, end_pos }] }`，可再次导入继续标注

### 快捷键

| 按键 | 功能 |
| --- | --- |
| `Enter` | 将当前框选添加为标注 |
| `[` / `]` | 追踪上一条 / 下一条 |
| `Delete` | 删除当前标注 |
| `1-9` `0` | 切换标签类型 |
| `Esc` | 取消编辑 |

## 目录结构

```
启动.bat                # 双击一键启动（自动装依赖/构建/开浏览器）
server.js               # 本地服务：静态托管 dist + 维护接口（仅监听本机）
src/
  utils/annotation.js   # 标注核心算法（提取、排序去重、覆盖检测、高亮渲染、纠错）
  utils/fileReader.js   # txt 读取（UTF-8 自动回退 GBK）
  utils/toast.js        # 轻量通知
  utils/api.js          # 与本地服务的接口通信
  views/Home.vue        # 标注页面
  views/Maintain.vue    # 数据维护页面（页面化维护脚本）
  data/enum.json        # 类型词表（TYPE_ENUM / KEY_ENUM）
  data/labels.json      # 标签类型列表（页面上可增删）
  data/correctBook.json # 错词本
  data/extracted.json   # 已提取文件名单
scripts/                # 维护脚本（可命令行直跑，也被服务页面调用）
  check.js              # 检查重复/未提取文件
  get.js                # 从 extract/ 目录回填词库
  del.js                # 清除 extract/ 中「待删除」实体
  isExtract.js          # 更新 extracted.json
src/views/extract/      # 已导出标注的批量处理目录（脚本使用）
```

## 数据维护（页面操作）

标注页右上角「维护工具」进入维护页面，四个维护脚本均已做成按钮，执行结果直接显示在页面控制台：

- **检查提取进度**：统计待提取 / 已标注文件，列出重名、重复与剩余未提取清单
- **回填词库**：汇总 extract/ 下标注文件的新实体，合并进 enum.json 词库
- **清除待删除实体**：批量移除 extract/ 下标注中的「待删除」实体
- **更新已提取名单**：以样例目录重算 extracted.json

维护功能需要本地服务在运行（双击 启动.bat 即可）；页面顶部会显示服务连接状态。

> 注：`待提取/`、`中毒1_part1/`、`src/views/extract/` 等为本地工作数据目录，不入库。目录缺失时维护功能会给出相应提示，不影响其他功能；如需使用，自行创建同名目录并放入数据即可。

命令行仍可用：`npm run extract:check` / `extract:merge` / `extract:clean` / `extract:list`。
