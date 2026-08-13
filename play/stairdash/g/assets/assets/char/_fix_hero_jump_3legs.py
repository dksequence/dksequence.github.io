# hero_jump 다리 3개 → 2개. v2 전략.
# v1(ComfyUI 인페인팅) 실패: 확산모델은 '제거'를 모름 → 다리를 상자로 바꿔놓음.
# v2: ①잉여 다리를 알파에서 제거 ②새로 생긴 절단 경계에만 스프라이트와 동일한 검정 외곽선을 재작화
#     (기존 외곽선은 건드리지 않는다 → 이중선 방지)
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

CHAR = r"E:\00_DK_DEV\000.app_factory\03-APPS\apps0015-stairdash\assets\char"
ART = r"D:\caches\temp\claude\stairdash_art"
SRC = os.path.join(CHAR, "hero_jump.png")

# 잉여 다리(다리 C). 상단 경계는 '바지 밑단'처럼 완만한 곡선으로 → 잘린 티가 덜 남.
CUT = [(120, 1200), (120, 845), (170, 800), (235, 762), (300, 742),
       (352, 748), (398, 782), (432, 838), (452, 905), (455, 1200)]
OUTLINE = (26, 22, 30)      # 스프라이트 잉크 라인 색
OUT_W = 9                   # 외곽선 두께(원본과 비슷하게)


def main():
    src = Image.open(SRC).convert("RGBA")
    w, h = src.size
    rgb = np.array(src.convert("RGB")).astype(np.int16)
    a0 = np.array(src.split()[3])

    cut = Image.new("L", (w, h), 0)
    ImageDraw.Draw(cut).polygon(CUT, fill=255)
    cutm = np.array(cut) > 127

    # ① 알파에서 잉여 다리 제거
    a1 = a0.copy()
    a1[cutm] = 0

    # ② 새 경계 = (지운 뒤 남은 실루엣의 테두리) ∩ (컷 영역 근처)
    #    → 원래부터 있던 외곽선에는 덧그리지 않는다.
    solid = Image.fromarray((a1 > 128).astype(np.uint8) * 255)
    eroded = solid.filter(ImageFilter.MinFilter(2 * OUT_W + 1))       # 안쪽으로 침식
    border = np.array(solid) > 127
    border &= ~(np.array(eroded) > 127)                               # 테두리 밴드

    near_cut = np.array(Image.fromarray((cutm * 255).astype(np.uint8))
                        .filter(ImageFilter.MaxFilter(2 * OUT_W + 5))) > 127
    new_edge = border & near_cut                                      # 새로 생긴 절단면만

    out = np.array(src.convert("RGB")).copy()
    out[new_edge] = OUTLINE

    res = Image.fromarray(out.astype(np.uint8)).convert("RGBA")
    res.putalpha(Image.fromarray(a1))

    # 경계 안티에일리어싱(계단현상 완화)
    aa = np.array(res.split()[3]).astype(np.float32)
    aa = np.array(Image.fromarray(aa.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)))
    res.putalpha(Image.fromarray(aa.astype(np.uint8)))

    res.save(os.path.join(ART, "_hero_jump_fixed.png"))

    # 검수: 원본 / 수정본 / 절단부 확대
    def plate(im):
        b = Image.new("RGB", (w, h), (250, 250, 252))
        b.paste(im, (0, 0), im)
        return b
    sheet = Image.new("RGB", (w * 2 + 30 + 560, h), (30, 30, 36))
    sheet.paste(plate(src), (0, 0))
    sheet.paste(plate(res), (w + 15, 0))
    zoom = res.crop((150, 620, 480, 900)).resize((560, 476), Image.LANCZOS)
    zb = Image.new("RGB", zoom.size, (250, 250, 252)); zb.paste(zoom, (0, 0), zoom)
    sheet.paste(zb, (w * 2 + 25, 40))
    sheet.thumbnail((1500, 950))
    sheet.save(os.path.join(ART, "_legfix_check.png"))
    print("fixed ->", os.path.join(ART, "_hero_jump_fixed.png"))


if __name__ == "__main__":
    main()
