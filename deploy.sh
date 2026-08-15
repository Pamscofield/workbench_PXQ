#!/bin/bash
# 部署工作台到 GitHub Pages。
# 直接运行即可(remote origin 已配好 SSH deploy key, 永不过期, 无明文 token):
#   bash ~/Desktop/Hermes/deploy/deploy.sh
# 也可显式指定远端:
#   GH_REPO=https://<TOKEN>@github.com/<user>/<repo>.git bash deploy.sh
set -e
SRC=/Users/xiaoqingpan/Desktop/Hermes/workbench
DST=/Users/xiaoqingpan/Desktop/Hermes/deploy
cd "$DST"
GIT=/Users/xiaoqingpan/miniconda3/bin/git
# 用专属 deploy key (无明文 token, 永不过期)
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/workbench_deploy -o IdentitiesOnly=yes"

# 把能完整运行的站点文件全部同步到 deploy/ (多文件版: index.html + app.js + style.css + data/)
# 注意: 不是只推一个单文件 html —— 单文件外壳仍运行时 fetch('data/*.json'),
# 所以必须连 data/ 与 app.js 一起推上去, 否则手机端 fetch 404 导致空白/不更新。
rm -rf "$DST/data" "$DST/app.js" "$DST/style.css" "$DST/index.html"
cp "$SRC/index.html" "$DST/index.html"
cp "$SRC/app.js"    "$DST/app.js"
cp "$SRC/style.css" "$DST/style.css"
mkdir -p "$DST/data"
cp "$SRC/data/"*.json "$DST/data/"

# 确保 git 仓库已初始化
if [ ! -d .git ]; then
  $GIT init -q
  $GIT checkout -b main 2>/dev/null || $GIT checkout -b master
  if [ -n "$GH_REPO" ]; then
    $GIT remote add origin "$GH_REPO"
  fi
fi

$GIT add -A
$GIT -c user.email=hermes@local -c user.name=Hermes commit -q -m "deploy $(date +%F_%T)" || echo "无需提交(无变化)"
$GIT push -q origin HEAD
echo "✅ 已推送。稍候 1-2 分钟, 手机刷新即见更新:"
echo "   https://pamscofield.github.io/workbench_PXQ/"
