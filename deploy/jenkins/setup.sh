#!/usr/bin/env bash
# 在服务器上安装 Jenkins（一次性，root 执行，可重复运行）
#
#   - Jenkins 以 systemd 服务运行，只监听 127.0.0.1:8080，由 Nginx 在 https://<域名>/jenkins/ 反向代理
#   - 跳过安装向导，通过 Configuration as Code 自动创建管理员账号和「发布商城前台」「发布管理后台」两个任务
#   - jenkins 用户加入 docker 组（在容器中打包前台），并通过 sudo 规则只允许执行部署脚本
#
# 用法：bash setup.sh <域名>
#   管理员账号默认 admin、密码首次随机生成，保存在 /etc/jenkins/admin.env；修改该文件后重启 jenkins 即可更换账号密码
set -euo pipefail

DOMAIN="${1:?用法：setup.sh <域名>}"
JENKINS_VERSION="${JENKINS_VERSION:-2.568.3}"
PLUGIN_MANAGER_VERSION="${PLUGIN_MANAGER_VERSION:-2.15.0}"
REPO_URL="${REPO_URL:-https://github.com/Xia0321/bolt-fuzhuang.git}"
JOB_NAME=pinso-deploy
DASHBOARD_JOB_NAME=pinso-dashboard
JENKINS_HOME=/var/lib/jenkins
HERE="$(cd "$(dirname "$0")" && pwd)"
export DEBIAN_FRONTEND=noninteractive LC_ALL=C.UTF-8

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

step "安装 Java 21"
if ! java -version 2>&1 | grep -q '"21'; then
  apt-get -o DPkg::Lock::Timeout=600 update -qq
  apt-get -o DPkg::Lock::Timeout=600 install -y -qq openjdk-21-jre-headless fontconfig git >/dev/null
fi
java -version 2>&1 | head -1

step "创建 jenkins 用户"
id jenkins >/dev/null 2>&1 || useradd --system --create-home --home-dir "$JENKINS_HOME" --shell /bin/bash jenkins
usermod -aG docker jenkins
mkdir -p /opt/jenkins /etc/jenkins

step "下载 Jenkins $JENKINS_VERSION"
war=/opt/jenkins/jenkins-$JENKINS_VERSION.war
if [ ! -f "$war" ]; then
  curl -fsSL -o "$war.tmp" "https://get.jenkins.io/war-stable/$JENKINS_VERSION/jenkins.war"
  expected="$(curl -fsSL "https://get.jenkins.io/war-stable/$JENKINS_VERSION/jenkins.war.sha256" | awk '{print $1}')"
  echo "$expected  $war.tmp" | sha256sum -c --quiet
  mv "$war.tmp" "$war"
fi
ln -sf "$war" /opt/jenkins/jenkins.war

step "安装插件"
pm=/opt/jenkins/jenkins-plugin-manager-$PLUGIN_MANAGER_VERSION.jar
[ -f "$pm" ] || curl -fsSL -o "$pm" \
  "https://github.com/jenkinsci/plugin-installation-manager-tool/releases/download/$PLUGIN_MANAGER_VERSION/jenkins-plugin-manager-$PLUGIN_MANAGER_VERSION.jar"
install -d -o jenkins -g jenkins "$JENKINS_HOME/plugins"
# 插件列表直接写在脚本里（不用 .txt 文件，避免被本机的文档加密软件加密）
plugins=(configuration-as-code job-dsl workflow-aggregator git pipeline-stage-view localization-zh-cn)
sudo -u jenkins java -jar "$pm" --war "$war" --plugin-download-directory "$JENKINS_HOME/plugins" \
  --plugins "${plugins[@]}" 2>&1 | tail -3

step "写入配置"
if [ ! -f /etc/jenkins/admin.env ]; then
  cat > /etc/jenkins/admin.env <<EOF
JENKINS_ADMIN_USER=admin
JENKINS_ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
EOF
fi
chown root:jenkins /etc/jenkins/admin.env
chmod 640 /etc/jenkins/admin.env
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__REPO_URL__|$REPO_URL|g" -e "s|__JOB_NAME__|$JOB_NAME|g" \
  -e "s|__DASHBOARD_JOB_NAME__|$DASHBOARD_JOB_NAME|g" \
  "$HERE/casc.yaml" > "$JENKINS_HOME/casc.yaml"
chown jenkins:jenkins "$JENKINS_HOME/casc.yaml"

# 部署需要 root：只允许执行两个任务各自工作区中的部署脚本，第二个参数为阶段名（脚本内只接受已知阶段）
workspace="$JENKINS_HOME/workspace/$JOB_NAME"
dashboard_workspace="$JENKINS_HOME/workspace/$DASHBOARD_JOB_NAME"
cat > /etc/sudoers.d/jenkins-pinso <<EOF
jenkins ALL=(root) NOPASSWD: /bin/bash $workspace/deploy/server-deploy.sh $workspace, /bin/bash $workspace/deploy/server-deploy.sh $workspace *
jenkins ALL=(root) NOPASSWD: /bin/bash $dashboard_workspace/deploy/server-deploy.sh $dashboard_workspace dashboard
EOF
chmod 440 /etc/sudoers.d/jenkins-pinso
visudo -cqf /etc/sudoers.d/jenkins-pinso

cat > /etc/systemd/system/jenkins.service <<EOF
[Unit]
Description=Jenkins
After=network-online.target docker.service
Wants=network-online.target

[Service]
User=jenkins
Group=jenkins
Environment=JENKINS_HOME=$JENKINS_HOME
Environment=CASC_JENKINS_CONFIG=$JENKINS_HOME/casc.yaml
EnvironmentFile=/etc/jenkins/admin.env
ExecStart=/usr/bin/java -Xms256m -Xmx512m -Djava.awt.headless=true -Duser.timezone=Asia/Shanghai \\
  -Djenkins.install.runSetupWizard=false \\
  -jar /opt/jenkins/jenkins.war --httpListenAddress=127.0.0.1 --httpPort=8080 --prefix=/jenkins
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

step "启动 Jenkins"
systemctl daemon-reload
systemctl enable jenkins >/dev/null 2>&1
systemctl restart jenkins
for i in $(seq 1 60); do
  # 启动过程中连接会被拒绝，忽略错误继续等待
  code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/jenkins/login || true)"
  if [ "$code" = 200 ]; then
    echo "✓ Jenkins 已启动"
    # 启动时由配置新建的任务可能没被加载（写入早于加载任务阶段），重新从磁盘加载一次
    set -a; . /etc/jenkins/admin.env; set +a
    auth="$JENKINS_ADMIN_USER:$JENKINS_ADMIN_PASSWORD"
    cookie="$(mktemp)"
    crumb="$(curl -s -c "$cookie" -u "$auth" http://127.0.0.1:8080/jenkins/crumbIssuer/api/json \
      | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["crumbRequestField"]+":"+d["crumb"])')"
    curl -s -o /dev/null -b "$cookie" -u "$auth" -H "$crumb" -X POST http://127.0.0.1:8080/jenkins/reload
    rm -f "$cookie"
    echo "✓ 已加载全部任务"
    exit 0
  fi
  sleep 5
done
echo "✗ Jenkins 未能启动"; journalctl -u jenkins -n 40 --no-pager; exit 1
