# 配置 Saleor 自带的邮件插件，通过 Resend 的 SMTP 发信（可重复执行）。
#
# 顾客邮件（注册确认、找回密码、订单确认、支付确认、发货通知等）由 User emails 插件发送，每个渠道各一份配置；
# 后台员工邮件（员工找回密码等）由 Admin emails 插件发送。
#
# 读取的环境变量（服务器上写在 /opt/pinso/.env，Saleor 容器会自动加载）：
#   RESEND_API_KEY     Resend API Key（SMTP 密码）
#   MAIL_FROM          发件地址，需是 Resend 中已验证的域名，如 notice@pinso.top
#   MAIL_SENDER_NAME   发件人名称，可选，默认 PINSO Denim
#   MAIL_TEST_TO       可选，配置完成后向该地址发送一封测试邮件
#
# 用法（在 Saleor 目录）：python manage.py shell < setup_email.py
# 服务器由 deploy/server-deploy.sh 在每次部署时自动执行。

import os
import sys

from saleor.channel.models import Channel
from saleor.plugins.admin_email.plugin import AdminEmailPlugin
from saleor.plugins.email_common import EmailConfig, send_email
from saleor.plugins.models import PluginConfiguration
from saleor.plugins.user_email.plugin import UserEmailPlugin

api_key = os.environ.get("RESEND_API_KEY", "").strip()
sender = os.environ.get("MAIL_FROM", "").strip()
sender_name = os.environ.get("MAIL_SENDER_NAME", "").strip() or "PINSO Denim"
test_to = os.environ.get("MAIL_TEST_TO", "").strip()

if not api_key or not sender:
    print("未配置 RESEND_API_KEY / MAIL_FROM，跳过邮件配置")
    sys.exit(0)

# Resend SMTP：用户名固定为 resend，密码为 API Key；465 端口使用 SSL
smtp = [
    {"name": "host", "value": "smtp.resend.com"},
    {"name": "port", "value": "465"},
    {"name": "username", "value": "resend"},
    {"name": "password", "value": api_key},
    {"name": "sender_name", "value": sender_name},
    {"name": "sender_address", "value": sender},
    {"name": "use_tls", "value": False},
    {"name": "use_ssl", "value": True},
]


def configure(plugin_cls, channel):
    config, _ = PluginConfiguration.objects.get_or_create(
        identifier=plugin_cls.PLUGIN_ID,
        channel=channel,
        defaults={"active": False, "configuration": [dict(c) for c in plugin_cls.DEFAULT_CONFIGURATION]},
    )
    # 保存时 Saleor 会实际登录一次 SMTP，密钥或端口错误会在这里报错
    plugin_cls.save_plugin_configuration(config, {"active": True, "configuration": smtp})
    print(f"已启用 {plugin_cls.PLUGIN_ID}" + (f"（渠道 {channel.slug}）" if channel else ""))


for channel in Channel.objects.order_by("slug"):
    configure(UserEmailPlugin, channel)
configure(AdminEmailPlugin, None)

if test_to:
    send_email(
        config=EmailConfig(
            host="smtp.resend.com", port="465", username="resend", password=api_key,
            sender_name=sender_name, sender_address=sender, use_tls=False, use_ssl=True,
        ),
        recipient_list=[test_to],
        context={},
        subject=f"{sender_name} 邮件服务测试",
        template_str=f"<p>这是一封测试邮件，说明 {sender_name} 的邮件服务已配置成功。</p>",
    )
    print(f"测试邮件已发送至 {test_to}")
