# 邮件模板与标题（可重复执行，部署「邮件」阶段在 setup_email.py 之后执行）。
#
# 以 Saleor 自带的默认模板为底稿，部署时逐句替换：
#   顾客邮件（User emails，每个渠道一份）：cn 渠道中文、jp 渠道日文、global 渠道英文
#   员工邮件（Admin emails）：中文；顶部的 Saleor 标志图片（线上 404）换成 PINSO 文字标志
#   所有邮件结尾的「This is an automatically generated e-mail, please do not reply.」换成联系邮箱
#
# 联系邮箱：环境变量 MAIL_CONTACT（/opt/pinso/.env），未设置时读取后台页面 site-settings 的 contact-email；
# 都没有时结尾这一句直接去掉。
#
# 后台「扩展 → User emails / Admin emails」里手工改过的模板和标题不会被覆盖：只写入空的、默认的、
# 或本脚本之前写入的（模板开头带 PINSO_MARKER 注释）。
#
# 用法（在 Saleor 目录）：python manage.py shell < setup_email_templates.py

import os
import re
from pathlib import Path

from saleor.attribute.models import AssignedPageAttributeValue
from saleor.channel.models import Channel
from saleor.plugins import admin_email, user_email
from saleor.plugins.admin_email import constants as admin_c
from saleor.plugins.admin_email.plugin import AdminEmailPlugin
from saleor.plugins.email_common import DEFAULT_EMAIL_VALUE
from saleor.plugins.models import EmailTemplate, PluginConfiguration
from saleor.plugins.user_email import constants as user_c
from saleor.plugins.user_email.plugin import UserEmailPlugin

PINSO_MARKER = "<!-- pinso-email-template -->"
CHANNEL_LANGUAGE = {"cn": "zh", "jp": "ja", "global": "en"}


def contact_email():
    value = os.environ.get("MAIL_CONTACT", "").strip()
    if value:
        return value
    assigned = (
        AssignedPageAttributeValue.objects.filter(
            page__slug="site-settings", value__attribute__slug="contact-email"
        )
        .select_related("value")
        .first()
    )
    return (assigned.value.plain_text or assigned.value.name).strip() if assigned else ""


CONTACT = contact_email()
FOOTER = {
    "zh": f"如有任何问题，请联系我们：{CONTACT}" if CONTACT else "",
    "ja": f"ご不明な点がございましたら、{CONTACT} までお問い合わせください。" if CONTACT else "",
    "en": f"If you have any questions, please contact us at {CONTACT}." if CONTACT else "",
}

# ---------- 顾客邮件：英文原句 → 中文 / 日文（英文渠道只替换结尾） ----------
# 先长后短；表格标题等短词只在整段文字节点上替换（见 LABELS），避免误伤长句
SENTENCES = [
    ("You're receiving this e-mail because you or someone else has requested a deletion of your user account at {{ site_name }}.",
     "你（或他人）申请注销你在 {{ site_name }} 的账号，因此收到这封邮件。",
     "{{ site_name }} のアカウント削除がリクエストされたため、このメールをお送りしています。"),
    ("Click the link below to delete your account.", "点击下方链接注销账号。", "以下のリンクをクリックしてアカウントを削除してください。"),
    ("Please note that this action is permanent and cannot be reversed.", "注意：注销后无法恢复。", "この操作は取り消すことができません。"),
    ("In order to log into {{ site_name }}, you have to confirm your email address first.",
     "登录 {{ site_name }} 前，需要先确认你的邮箱地址。", "{{ site_name }} にログインするには、メールアドレスの確認が必要です。"),
    ("Please click the link below to do so and log into your account.", "请点击下方链接完成确认并登录。", "以下のリンクをクリックして確認し、ログインしてください。"),
    ("Below is the list of ordered products that have been updated with new tracking number.",
     "以下商品的物流单号已更新。", "以下の商品の追跡番号が更新されました。"),
    ("Below is the list of fulfilled products.", "以下是已发货的商品。", "発送済みの商品は以下のとおりです。"),
    ("Below is the list of ordered products.", "以下是你订购的商品。", "ご注文の商品は以下のとおりです。"),
    ("To see your order details please visit:", "查看订单详情：", "ご注文の詳細はこちら："),
    ("To see your payment details please visit:", "查看支付详情：", "お支払いの詳細はこちら："),
    ("Thank you for your order.", "感谢你的订购。", "ご注文ありがとうございます。"),
    ("Thank you for your payment.", "感谢付款。", "お支払いありがとうございます。"),
    ("Your payment was successfully processed.", "付款已成功处理。", "お支払いは正常に処理されました。"),
    ("Your order has been confirmed by staff.", "你的订单已确认。", "ご注文が確定しました。"),
    ("You're receiving this e-mail because you or someone else has changed email for your user account at {{ site_name }}.",
     "你在 {{ site_name }} 的账号邮箱已被修改，因此收到这封邮件。",
     "{{ site_name }} のアカウントのメールアドレスが変更されたため、このメールをお送りしています。"),
    ("If you didn't request this change, please contact the administrator.", "如果不是你本人操作，请联系我们。", "お心当たりがない場合は、お問い合わせください。"),
    ("Here is your gift card!", "这是送给你的礼品卡！", "ギフトカードをお届けします！"),
    ("Gift card code:", "礼品卡码：", "ギフトカードコード："),
    ("Use this card as payment for anything you like in {{ site_name }}.",
     "可在 {{ site_name }} 购买任意商品时使用。", "{{ site_name }} のすべての商品のお支払いにご利用いただけます。"),
    ("Enter the gift card code at checkout to redeem your gift card.", "结算时输入礼品卡码即可使用。", "ご注文手続きの際にギフトカードコードを入力してください。"),
    ("Your order #{{order.number}} has been canceled.", "你的订单 #{{order.number}} 已取消。", "ご注文 #{{order.number}} はキャンセルされました。"),
    ("A payment of {{amount}} {{currency}} has been refunded for your order.",
     "你的订单已退款 {{amount}} {{currency}}。", "ご注文について {{amount}} {{currency}} を返金しました。"),
    ("You're receiving this e-mail because you or someone else has requested a password for your user account at {{site_name}}.",
     "你（或他人）申请重置 {{site_name}} 账号的密码，因此收到这封邮件。",
     "{{site_name}} のアカウントのパスワード再設定がリクエストされたため、このメールをお送りしています。"),
    ("It can be safely ignored if you did not request a password reset.", "如果不是你本人操作，请忽略本邮件。", "お心当たりがない場合は、このメールを破棄してください。"),
    ("Click the link below to reset your password.", "点击下方链接重置密码。", "以下のリンクからパスワードを再設定してください。"),
    ("You're receiving this e-mail because you or someone else has requested an email change for your user account at {{site_name}}.",
     "你（或他人）申请修改 {{site_name}} 账号的邮箱，因此收到这封邮件。",
     "{{site_name}} のアカウントのメールアドレス変更がリクエストされたため、このメールをお送りしています。"),
    ("It can be safely ignored if you did not request an email change.", "如果不是你本人操作，请忽略本邮件。", "お心当たりがない場合は、このメールを破棄してください。"),
    ("Click the link below to confirm new email address.", "点击下方链接确认新邮箱。", "以下のリンクから新しいメールアドレスを確認してください。"),
    ("In order to download invoice {{number}}, click the link below.", "点击下方链接下载发票 {{number}}。", "以下のリンクから請求書 {{number}} をダウンロードしてください。"),
    ("You're receiving this e-mail because you have to set password for your customer account at {{site_name}}.",
     "你需要为 {{site_name}} 账号设置密码，因此收到这封邮件。",
     "{{site_name}} のアカウントのパスワード設定が必要なため、このメールをお送りしています。"),
    ("Click the link below to set up your password.", "点击下方链接设置密码。", "以下のリンクからパスワードを設定してください。"),
    ("Your shipping status has been updated.", "你的物流信息已更新。", "配送状況が更新されました。"),
    ("No billing address", "无账单地址", "請求先住所なし"),
    ("No shipping required", "无需配送", "配送不要"),
    ("Sincerely, {{ site_name }}", "{{ site_name }} 敬上", "{{ site_name }}"),
]

# 正则替换：语序随语言变化的句子（链接、单号、称呼）
PATTERNS = [
    (r"You can track your shipment with(\s*<a [^>]*>[^<]*</a>)\s*link\.", r"点击查看物流：\1", r"配送状況はこちら：\1"),
    (r"You can track your shipment with (\{\{\s*fulfillment\.tracking_number\s*\}\}) code\.", r"物流单号：\1", r"追跡番号：\1"),
    (r"Hi, (\{\{\s*user\.first_name\s*\}\}) (\{\{\s*user\.last_name\s*\}\})", r"\2\1，你好", r"\2 \1 様"),
    (r"Hi, (\{\{\s*recipient_email\s*\}\})", r"\1，你好", r"\1 様"),
    (r"Taxes \(included\)", "税费（已含）", "税（込）"),
    (r"(\}\}\s*)Taxes(\s*\{\{)", r"\1税费\2", r"\1税\2"),
]

# 整段文字节点的短词（表格标题等）
LABELS = [
    ("Hi!", "你好！", "こんにちは。"),
    ("Item", "商品", "商品"),
    ("Quantity", "数量", "数量"),
    ("Qty", "数量", "数量"),
    ("Per unit", "单价", "単価"),
    ("Subtotal", "小计", "小計"),
    ("Shipping", "运费", "送料"),
    ("Discount", "优惠", "割引"),
    ("Total", "合计", "合計"),
    ("Billing address", "账单地址", "請求先住所"),
    ("Shipping address", "收货地址", "お届け先住所"),
]

USER_SUBJECTS = {
    user_c.ACCOUNT_CONFIRMATION_SUBJECT_FIELD: ("请确认你的 {{ site_name }} 账号", "{{ site_name }} アカウントの確認", "Confirm your {{ site_name }} account"),
    user_c.ACCOUNT_SET_CUSTOMER_PASSWORD_SUBJECT_FIELD: ("设置你的 {{ site_name }} 账号密码", "{{ site_name }} パスワードの設定", "Set your {{ site_name }} password"),
    user_c.ACCOUNT_DELETE_SUBJECT_FIELD: ("注销账号确认", "アカウント削除の確認", "Delete your account"),
    user_c.ACCOUNT_CHANGE_EMAIL_CONFIRM_SUBJECT_FIELD: ("账号邮箱已修改", "メールアドレスが変更されました", "Your email address has been changed"),
    user_c.ACCOUNT_CHANGE_EMAIL_REQUEST_SUBJECT_FIELD: ("确认新邮箱", "新しいメールアドレスの確認", "Confirm your new email address"),
    user_c.ACCOUNT_PASSWORD_RESET_SUBJECT_FIELD: ("重置 {{ site_name }} 密码", "{{ site_name }} パスワードの再設定", "Reset your {{ site_name }} password"),
    user_c.INVOICE_READY_SUBJECT_FIELD: ("发票", "請求書", "Invoice"),
    user_c.ORDER_CONFIRMATION_SUBJECT_FIELD: ("订单 #{{ order.number }} 详情", "ご注文 #{{ order.number }} の詳細", "Order #{{ order.number }} details"),
    user_c.ORDER_CONFIRMED_SUBJECT_FIELD: ("订单 #{{ order.number }} 已确认", "ご注文 #{{ order.number }} が確定しました", "Order #{{ order.number }} confirmed"),
    user_c.ORDER_FULFILLMENT_CONFIRMATION_SUBJECT_FIELD: ("订单 #{{ order.number }} 已发货", "ご注文 #{{ order.number }} を発送しました", "Your order #{{ order.number }} has shipped"),
    user_c.ORDER_FULFILLMENT_UPDATE_SUBJECT_FIELD: ("订单 #{{ order.number }} 物流更新", "ご注文 #{{ order.number }} の配送状況のお知らせ", "Shipping update for order #{{ order.number }}"),
    user_c.ORDER_PAYMENT_CONFIRMATION_SUBJECT_FIELD: ("订单 #{{ order.number }} 付款成功", "ご注文 #{{ order.number }} のお支払い確認", "Payment received for order #{{ order.number }}"),
    user_c.ORDER_CANCELED_SUBJECT_FIELD: ("订单 #{{ order.number }} 已取消", "ご注文 #{{ order.number }} のキャンセル", "Order #{{ order.number }} canceled"),
    user_c.ORDER_REFUND_CONFIRMATION_SUBJECT_FIELD: ("订单 #{{ order.number }} 已退款", "ご注文 #{{ order.number }} の返金", "Order #{{ order.number }} refunded"),
    user_c.SEND_GIFT_CARD_SUBJECT_FIELD: ("{{ site_name }} 礼品卡", "{{ site_name }} ギフトカード", "Gift card from {{ site_name }}"),
}

# ---------- 员工邮件（中文） ----------
ADMIN_SENTENCES = [
    ("Sorry, we couldn't finish exporting {{data_type}} due to unexpected errors. Please try again.", "抱歉，{{data_type}} 导出失败，请重试。"),
    ("Our appolgies and thank you.", "谢谢。"),
    ("We're happy to let you know that your file with {{data_type}} data is ready to download.", "{{data_type}} 数据已导出完成。"),
    ("To download your {{data_type}} data, simply click the button below.", "点击下方按钮下载。"),
    ("We received your dashboard password reset request.", "我们收到了你的后台密码重置申请。"),
    ("To reset your password, simply click the “Reset my password” button below.", "点击下方「重置密码」按钮设置新密码。"),
    ("This link expires in 24 hours. If you miss the window, please reset your password again.", "链接 24 小时内有效，过期后请重新申请。"),
    ("Didn&apos;t request a reset? Ignore this message (or reply to let us know).", "如果不是你本人操作，请忽略本邮件。"),
    ("You’re in—welcome to Saleor Commerce!", "欢迎加入 PINSO 后台！"),
    ("Someone just added you to a Saleor project. That means you’ve got things to build, break, or ship (preferably in that order).",
     "你已被添加为 PINSO 后台员工。"),
    ("To get in, you’ll need to set a password. Just click the button below.", "点击下方按钮设置密码后即可登录。"),
    ("New order just came in! 🎉", "有新订单！🎉"),
    ("Someone placed a new order in your store.", "商店收到了一笔新订单。"),
    ('To see order details please click the button "See order" below.', "点击下方「查看订单」按钮查看详情。"),
    ("Have a great day and thank you!", "谢谢！"),
    ("Have a great day!", "谢谢！"),
    ("Thank you!", "谢谢！"),
    ("No billing address", "无账单地址"),
    ("No shipping required", "无需配送"),
]
ADMIN_LABELS = [
    ("Hello there!", "你好！"), ("Hello,", "你好："), ("Download data", "下载数据"), ("Reset my password", "重置密码"),
    ("Set my password", "设置密码"), ("See order", "查看订单"),
    ("Item", "商品"), ("Qty", "数量"), ("Per unit", "单价"), ("Subtotal", "小计"), ("Shipping", "运费"),
    ("Discount", "优惠"), ("Total", "合计"), ("Billing address", "账单地址"), ("Shipping address", "收货地址"),
]
ADMIN_SUBJECTS = {
    admin_c.STAFF_ORDER_CONFIRMATION_SUBJECT_FIELD: "新订单 #{{ order.number }}",
    admin_c.SET_STAFF_PASSWORD_SUBJECT_FIELD: "邀请你加入 PINSO 后台",
    admin_c.CSV_EXPORT_SUCCESS_SUBJECT_FIELD: "{{ data_type }} 数据已导出",
    admin_c.CSV_EXPORT_FAILED_SUBJECT_FIELD: "{{ data_type }} 数据导出失败",
    admin_c.STAFF_PASSWORD_RESET_SUBJECT_FIELD: "重置 PINSO 后台密码",
}

FOOTER_EN = "This is an automatically generated e-mail, please do not reply."
STAFF_FOOTER_EN = "Certain messages, like this one, are essential to service operations."


def phrase_regex(text):
    # 原模板中句子可能被换行和缩进打断
    return r"\s+".join(re.escape(word) for word in text.split())


def replace_sentence(html, english, translated):
    return re.sub(phrase_regex(english), lambda _: translated, html)


def replace_label(html, english, translated):
    # 只替换整段文字节点：>  Item  <
    return re.sub(r">(\s*)" + phrase_regex(english) + r"(\s*)<", lambda m: f">{m.group(1)}{translated}{m.group(2)}<", html)


def build_user_template(default_html, lang):
    html = replace_sentence(default_html, FOOTER_EN, FOOTER[lang])
    if lang == "en":
        return html
    idx = 1 if lang == "zh" else 2
    for pattern, zh, ja in PATTERNS:
        html = re.sub(pattern, zh if lang == "zh" else ja, html)
    for row in SENTENCES:
        html = replace_sentence(html, row[0], row[idx])
    for row in LABELS:
        html = replace_label(html, row[0], row[idx])
    return html.replace('lang="en"', f'lang="{"zh-CN" if lang == "zh" else "ja"}"')


def build_admin_template(default_html):
    html = replace_sentence(default_html, FOOTER_EN, FOOTER["zh"])
    html = re.sub(r"\s*<br\s*/?>\s*" + phrase_regex(STAFF_FOOTER_EN), "", html)
    html = replace_sentence(html, STAFF_FOOTER_EN, "")
    # Saleor 标志图片在线上 404，换成文字标志
    html = re.sub(
        r"<img[^>]*\{\{\s*logo_url\s*\}\}[^>]*>",
        '<span style="font-family:Helvetica,Arial,sans-serif;font-size:18px;letter-spacing:0.3em;color:#111;">PINSO</span>',
        html,
    )
    for pattern, zh, _ja in PATTERNS:
        html = re.sub(pattern, zh, html)
    for english, zh in ADMIN_SENTENCES:
        html = replace_sentence(html, english, zh)
    for english, zh in ADMIN_LABELS:
        html = replace_label(html, english, zh)
    return html.replace('lang="en"', 'lang="zh-CN"')


def read_default(package, file_name):
    return (Path(package.__file__).parent / "default_email_templates" / file_name).read_text()


def write_templates(config, templates):
    written = 0
    for field, html in templates.items():
        current = EmailTemplate.objects.filter(plugin_configuration=config, name=field).first()
        if current and current.value not in ("", DEFAULT_EMAIL_VALUE) and not current.value.startswith(PINSO_MARKER):
            continue  # 后台手工改过，保留
        EmailTemplate.objects.update_or_create(
            plugin_configuration=config, name=field, defaults={"value": PINSO_MARKER + "\n" + html}
        )
        written += 1
    return written


def write_subjects(config, subjects, defaults, managed):
    changed = 0
    for item in config.configuration:
        name = item.get("name")
        if name in subjects and (item.get("value") or "") in ("", defaults.get(name), *managed.get(name, ())):
            if item.get("value") != subjects[name]:
                item["value"] = subjects[name]
                changed += 1
    if changed:
        config.save(update_fields=["configuration"])
    return changed


# 顾客邮件
user_files = {
    field: getattr(user_c, field_const.replace("_TEMPLATE_FIELD", "_DEFAULT_TEMPLATE"))
    for field_const in dir(user_c)
    if field_const.endswith("_TEMPLATE_FIELD")
    for field in [getattr(user_c, field_const)]
}
user_default_subjects = {
    getattr(user_c, c): getattr(user_c, c.replace("_SUBJECT_FIELD", "_DEFAULT_SUBJECT"))
    for c in dir(user_c)
    if c.endswith("_SUBJECT_FIELD") and hasattr(user_c, c.replace("_SUBJECT_FIELD", "_DEFAULT_SUBJECT"))
}
managed_user_subjects = {field: values for field, values in USER_SUBJECTS.items()}

for channel in Channel.objects.order_by("slug"):
    lang = CHANNEL_LANGUAGE.get(channel.slug, "en")
    config = PluginConfiguration.objects.filter(identifier=UserEmailPlugin.PLUGIN_ID, channel=channel).first()
    if not config:
        print(f"渠道 {channel.slug} 未启用顾客邮件，跳过")
        continue
    templates = {field: build_user_template(read_default(user_email, file_name), lang) for field, file_name in user_files.items()}
    idx = {"zh": 0, "ja": 1, "en": 2}[lang]
    n_tpl = write_templates(config, templates)
    n_sub = write_subjects(config, {f: v[idx] for f, v in USER_SUBJECTS.items()}, user_default_subjects, managed_user_subjects)
    print(f"顾客邮件 {channel.slug}（{lang}）：模板 {n_tpl} 个，标题更新 {n_sub} 个")

# 员工邮件
admin_files = {
    admin_c.STAFF_ORDER_CONFIRMATION_TEMPLATE_FIELD: admin_c.STAFF_ORDER_CONFIRMATION_DEFAULT_TEMPLATE,
    admin_c.SET_STAFF_PASSWORD_TEMPLATE_FIELD: admin_c.SET_STAFF_PASSWORD_DEFAULT_TEMPLATE,
    admin_c.CSV_EXPORT_SUCCESS_TEMPLATE_FIELD: admin_c.CSV_EXPORT_SUCCESS_DEFAULT_TEMPLATE,
    admin_c.CSV_EXPORT_FAILED_TEMPLATE_FIELD: admin_c.CSV_EXPORT_FAILED_TEMPLATE_DEFAULT_TEMPLATE,
    admin_c.STAFF_PASSWORD_RESET_TEMPLATE_FIELD: admin_c.STAFF_PASSWORD_RESET_DEFAULT_TEMPLATE,
}
admin_default_subjects = {
    admin_c.STAFF_ORDER_CONFIRMATION_SUBJECT_FIELD: admin_c.STAFF_ORDER_CONFIRMATION_DEFAULT_SUBJECT,
    admin_c.SET_STAFF_PASSWORD_SUBJECT_FIELD: admin_c.SET_STAFF_PASSWORD_DEFAULT_SUBJECT,
    admin_c.CSV_EXPORT_SUCCESS_SUBJECT_FIELD: admin_c.CSV_EXPORT_SUCCESS_DEFAULT_SUBJECT,
    admin_c.CSV_EXPORT_FAILED_SUBJECT_FIELD: admin_c.CSV_EXPORT_FAILED_DEFAULT_SUBJECT,
    admin_c.STAFF_PASSWORD_RESET_SUBJECT_FIELD: admin_c.STAFF_PASSWORD_RESET_DEFAULT_SUBJECT,
}
config = PluginConfiguration.objects.filter(identifier=AdminEmailPlugin.PLUGIN_ID, channel=None).first()
if config:
    templates = {field: build_admin_template(read_default(admin_email, file_name)) for field, file_name in admin_files.items()}
    n_tpl = write_templates(config, templates)
    n_sub = write_subjects(config, ADMIN_SUBJECTS, admin_default_subjects, {f: (v,) for f, v in ADMIN_SUBJECTS.items()})
    print(f"员工邮件（zh）：模板 {n_tpl} 个，标题更新 {n_sub} 个")

print("联系邮箱：" + (CONTACT or "未设置，结尾不显示联系方式"))
