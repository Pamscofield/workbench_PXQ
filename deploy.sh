#!/bin/bash
# 部署工作台到 GitHub Pages (或任何 git 远端)
# 用法:
#   GH_REPO=https://<TOKEN>@github.com/<user>/<repo>.git bash deploy.sh
# 远程地址只在本次进程内使用, 不写进任何文件。
set -e
cd /Users/xiaoqingpan/Desktop/Hermes/deploy
GIT=/Users/xiaoqingpan/miniconda3/bin/git
REPO="${GH_REPO:?请提供 GH_REPO 环境变量(含 token 的 https 地址)}"

# 每次部署都用最新生成的单文件覆盖 index.html
cp /Users/xiaoqingpan/Desktop/Hermes/workbench/workbench.html index.html

if [ ! -d .git ]; then
  $GIT init -q
  $GIT checkout -b main 2>/dev/null || $GIT checkout -b master
  $GIT remote add origin "$REPO"
fi
$GIT add -A
$GIT -c user.email=hermes@local -c user.name=Hermes commit -q -m "deploy $(date +%F_%T)" || echo "无需提交(无变化)"
$GIT push -q -f origin HEAD
echo "✅ 已推送。请到仓库 Settings > Pages 选择该分支, 稍等 1-2 分钟即可通过:"
echo "   https://<user>.github.io/<repo>/"
echo "(若已开过 Pages, 刷新即更新)"
