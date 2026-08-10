#!/bin/bash
# 部署工作台到 GitHub Pages。
# 直接运行即可(remote origin 已配好 SSH deploy key):
#   bash ~/Desktop/Hermes/deploy/deploy.sh
# 也可显式指定远端:
#   GH_REPO=https://<TOKEN>@github.com/<user>/<repo>.git bash deploy.sh
set -e
cd /Users/xiaoqingpan/Desktop/Hermes/deploy
GIT=/Users/xiaoqingpan/miniconda3/bin/git
# 用专属 deploy key (无明文 token, 永不过期)
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/workbench_deploy -o IdentitiesOnly=yes"

# 用最新生成的单文件覆盖站点入口
cp /Users/xiaoqingpan/Desktop/Hermes/workbench/workbench.html index.html

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
