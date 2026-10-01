# 前台（Saleor Paper）使用的 Saleor 应用与令牌（可重复执行）。
#
#   PINSO 前台          前台服务端使用：订单号 + 邮箱查询订单（管理订单），读取渠道列表；缓存刷新 webhook 也挂在它上面
#   PINSO 前台内容初始化  saleor/storefront/setup.mjs 创建内容模型用（管理页面、页面类型与属性、翻译，读取合集），
#                       每次部署生成临时令牌，用完由 STOREFRONT_SETUP_MODE=cleanup 删除
#
# 读取的环境变量：
#   STOREFRONT_SETUP_MODE   tokens（默认）或 cleanup
#   NEW_STOREFRONT_TOKEN    设为 1 时为「PINSO 前台」生成新令牌（.env 中还没有时由部署脚本设置）
#
# 输出 KEY=VALUE 行供部署脚本读取：STOREFRONT_APP_TOKEN=…、CONTENT_TOKEN=…
# 用法（在 Saleor 目录）：python manage.py shell < setup_storefront.py

import os

from saleor.app.models import App, AppToken
from saleor.permission.enums import get_permissions_from_names

APPS = {
    "pinso.storefront": ("PINSO 前台", ["MANAGE_ORDERS"]),
    "pinso.storefront-content": (
        "PINSO 前台内容初始化",
        ["MANAGE_PAGES", "MANAGE_PAGE_TYPES_AND_ATTRIBUTES", "MANAGE_TRANSLATIONS", "MANAGE_PRODUCTS"],
    ),
}


def ensure_app(identifier):
    name, permissions = APPS[identifier]
    app = App.objects.not_removed().filter(identifier=identifier).first()
    if not app:
        app = App.objects.create(name=name, identifier=identifier, is_active=True)
        print(f"已创建应用：{name}")
    if not app.is_active:
        app.is_active = True
        app.save(update_fields=["is_active"])
    app.permissions.set(get_permissions_from_names(permissions))
    return app


mode = os.environ.get("STOREFRONT_SETUP_MODE", "tokens")
content_app = ensure_app("pinso.storefront-content")
# 上次部署中断时可能留下临时令牌，先清理
content_app.tokens.all().delete()

if mode == "tokens":
    storefront_app = ensure_app("pinso.storefront")
    if os.environ.get("NEW_STOREFRONT_TOKEN") == "1":
        _, token = AppToken.objects.create(app=storefront_app, name="storefront")
        print(f"STOREFRONT_APP_TOKEN={token}")
    _, token = AppToken.objects.create(app=content_app, name="setup")
    print(f"CONTENT_TOKEN={token}")
