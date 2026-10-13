"""生成网页版（PWA）用的图标，与安卓自适应图标同一套设计：
陶红底 #a8562f + 一页纸 #f7f0e4 + 三行字（两行淡墨，第三行是"被点出来的那一句"）。
顺带生成分享用的大图 og-cover.png（发到微信/推特时显示的卡片）。
用法：python make_icons.py    （在项目根目录，输出也写在这里）
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))

BOLD_FONT = "C:/Windows/Fonts/msyhbd.ttc"   # 微软雅黑 粗体
TEXT_FONT = "C:/Windows/Fonts/msyh.ttc"     # 微软雅黑

BG = (0xA8, 0x56, 0x2F, 0xFF)      # 品牌陶红
PAPER = (0xF7, 0xF0, 0xE4, 0xFF)   # 纸
INK_FAINT = (0xD9, 0xBD, 0xA6, 0xFF)
INK = (0xA8, 0x56, 0x2F, 0xFF)

SS = 4          # 超采样倍数
PAGE_W, PAGE_H = 50.0, 46.0   # 矢量里的纸：50 x 46
LINE_H = 5.0                  # 矢量里的行高
# 三行的位置与长度（相对纸宽），取自 ic_foreground.xml
LINES = [
    (0.08, 0.72, 0.2609, INK_FAINT),   # x 起点 8%，长 72%，顶端在纸高 26.09%
    (0.08, 0.44, 0.5217, INK_FAINT),
    (0.08, 0.72, 0.7826, INK),
]


def draw_icon(size, page_ratio):
    """page_ratio：纸宽占画布宽的比例。普通图标约 0.68，maskable 留安全区用 0.52。"""
    n = size * SS
    img = Image.new("RGBA", (n, n), BG)
    d = ImageDraw.Draw(img)
    w = n * page_ratio
    h = w * PAGE_H / PAGE_W
    x0, y0 = (n - w) / 2.0, (n - h) / 2.0
    r = w * 6.0 / PAGE_W
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=r, fill=PAPER)
    lh = h * LINE_H / PAGE_H
    for left, length, top, color in LINES:
        lx = x0 + w * left
        ly = y0 + h * top
        d.rectangle([lx, ly, lx + w * length, ly + lh], fill=color)
    return img.resize((size, size), Image.LANCZOS)


def out(name):
    return os.path.join(HERE, name)


def draw_cover():
    """分享大图 1200x630：陶红底 + 米色纸卡 + 三行字，和图标同一套语言。"""
    W, H = 1200, 630
    img = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(img)

    # 纸卡
    d.rounded_rectangle([54, 54, W - 54, H - 54], radius=36, fill=PAPER)

    # 标题与副题
    d.text((108, 128), "概念寓言机", font=ImageFont.truetype(BOLD_FONT, 84), fill=BG)
    d.text((112, 272), "每次打开都是一则新的寓言故事", font=ImageFont.truetype(TEXT_FONT, 38),
           fill=(93, 80, 73, 255))
    d.text((112, 332), "它一直在讲某个概念，但不会一开始就告诉你", font=ImageFont.truetype(TEXT_FONT, 38),
           fill=(93, 80, 73, 255))

    # 三行字：两行淡墨 + 一行陶红（被点出来的那一句）
    for i, (w, color) in enumerate([(470, INK_FAINT), (300, INK_FAINT), (470, BG)]):
        y = 428 + i * 42
        d.rounded_rectangle([112, y, 112 + w, y + 18], radius=9, fill=color)

    # 地址（右下角）
    d.text((W - 108, 522), "realchenchenluo.github.io/concept-fable",
           font=ImageFont.truetype(TEXT_FONT, 26), fill=BG, anchor="ra")

    return img


if __name__ == "__main__":
    draw_icon(192, 0.68).save(out("icon-192.png"))
    draw_icon(512, 0.68).save(out("icon-512.png"))
    draw_icon(512, 0.52).save(out("icon-maskable-512.png"))
    draw_icon(180, 0.68).save(out("apple-touch-icon.png"))
    draw_icon(512, 0.68).save(out("favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    draw_cover().save(out("og-cover.png"))
    print("已生成：icon-192.png / icon-512.png / icon-maskable-512.png / apple-touch-icon.png / favicon.ico / og-cover.png")
