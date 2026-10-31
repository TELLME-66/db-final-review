# 数据库系统概论 · 期末备考

把本学期 14 个课件 PDF（王珊《数据库系统概论》第 6 版，第 1–7、9–11 章）整理成一套可以「读 → 练 → 考 → 查」的静态站点。

## 打开

双击 `index.html` 即可，无需服务器、无需联网（字体、图标、脚本全部在本地）。

## 页面

| 文件 | 内容 |
| --- | --- |
| `index.html` | 首页：产品页式首屏、十天冲刺表（勾选存本地）、十章卡片与掌握度、高频考点 |
| `db.html` | 讲义索引：10 章 98 节，可跳到任意小节 |
| `db/1.html` … `db/11.html` | 各章讲义：考点卡 / 易错点 / 例题 / 口诀 / 小结，每节可「标记掌握」 |
| `db/quiz.html` | 题库：239 道单选、多选、判断、填空、简答，按章/题型筛选，即时判分，自动错题本 |
| `db/exam.html` | 模拟卷 3 套（基础 / 提高 / 冲刺），90 分钟限时，客观题自动判分，综合题对照给分点自评 |
| `db/cheatsheet.html` | 考前速查卡：SQL 模板、范式判定、锁协议、恢复步骤、高频简答 18 条 |
| `404.html` | GitHub Pages 的 404 页 |

## 设计

参照 Apple 产品页的排版逻辑做的一套静态设计系统：

- **字体**：SF Pro / 系统中文字体，标题紧字距（-0.04em），正文 17px / 1.9，数字用 tabular-nums。
- **版式**：大留白、单栏居中、超大首屏标题、细分隔线，内容最大 1000px。
- **材质**：48px 毛玻璃顶栏、无边框大圆角瓦片、两层柔和阴影，深色用纯黑底。
- **动效**：`.reveal` 入场（IntersectionObserver，带 1.5s 兜底），悬停上浮 2–3px，按压 scale(0.97)，全部尊重 `prefers-reduced-motion`。
- **细节**：iOS 式分段控件（`.mod-switch`、`.chip`）、胶囊按钮、圆形选框、可横滑的手机数据条。
- **主题**：跟随系统 / 日间 / 夜间三态，`?theme=light|dark` 可临时预览（不写入本机）。

## 目录结构

```
index.html  db.html  db/*.html          生成好的页面
assets/                                 样式、交互脚本、题库与试卷数据
  theme.css site.css course.css quiz.css
  site.js study.js quiz.js exam.js
  data/quiz.js  data/exam.js            由 build.py 生成，勿手改
content/chN.html                        讲义正文片段（改这里）
content/chN.quiz.json                   每章自测题
content/chN.exam.json                   每章大题（含参考答案与给分点）
build.py                                生成 db.html / db/*.html / data/*.js
package.sh                              重新生成 + 打包 dist/ 与 zip
dist/                                   可直接部署的静态站点（GitHub Pages 用）
```

## 重新生成与打包

```bash
./package.sh          # = python3 build.py + 复制到 dist/ + 打 zip
```

只改内容时可以只跑 `python3 build.py`。`dist/` 里只放网页需要的文件（不含 PDF、`content/`、`build.py`），大小约 1 MB。

## 发布到 GitHub Pages

把 `dist/` 推到仓库根目录，然后在仓库 Settings → Pages 里选择 `Deploy from a branch`、分支 `main`、目录 `/ (root)`，几分钟后即可访问
`https://<用户名>.github.io/<仓库名>/`。

`.nojekyll` 已包含，避免 GitHub 的 Jekyll 处理干扰。

## 进度保存在哪

全部存在浏览器的 `localStorage`，不上传任何地方：`db-mastery`（小节掌握）、`db-quiz`（做题与错题）、`db-exam`（模拟卷最好成绩）、`db-plan`（冲刺表勾选）、`site-theme`（主题）。题库页底部可一键清空做题记录。

## 说明

题目与解析据课件内容自编，用于练习，**不是往年真题**；真实卷面的题型与分值以老师通知为准。
首页里的统计数字（239 题、98 节等）是手写的；如果增删题目或小节，记得同步改一下首页与 `db/quiz.html`、`db/exam.html` 的副标题。
