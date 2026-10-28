import numpy as np
from PIL import Image
import cv2
import os

def generate_flawless_master_scroll():
    print("Executing flawless scroll reconstruction from ground truth...")

    # Load authentic master original (1145 x 1374 RGB)
    orig = Image.open('assets/images/SCROLL FOR AR POSTER.png.bak').convert('RGB')
    orig_arr = np.array(orig)
    H, W, _ = orig_arr.shape # 1374, 1145, 3

    # Load GameJam 2026 artwork
    gamejam = Image.open('assets/images/A Call to Adventure_ GameJam 2026.png').convert('RGBA')
    gamejam_arr = np.array(gamejam)

    # Load blank scroll base
    blank = Image.open('assets/images/scroll_blank_base.png.bak').convert('RGBA')
    blank_arr = np.array(blank)

    # =========================================================================
    # 1. CLEAN ANTIALIASED EXTERIOR ALPHA MASK FOR MASTER ORIGINAL
    # =========================================================================
    gray = cv2.cvtColor(orig_arr, cv2.COLOR_RGB2GRAY)
    padded = np.pad(gray, 1, mode='constant', constant_values=0)
    h_p, w_p = padded.shape
    flood_mask = np.zeros((h_p + 2, w_p + 2), dtype=np.uint8)

    for start_pt in [(0, 0), (w_p - 1, 0), (0, h_p - 1), (w_p - 1, h_p - 1)]:
        cv2.floodFill(padded, flood_mask, start_pt, 255, 3, 3)

    ext_bg = flood_mask[1:-1, 1:-1] == 1
    ext_bg = ext_bg[1:-1, 1:-1]

    master_alpha = np.ones((H, W), dtype=np.uint8) * 255
    master_alpha[ext_bg] = 0

    # Ensure all dark wood/rope crevices inside finials have alpha = 255
    # Top-Left finial (Y: 0..220, X: 0..160)
    for y in range(220):
        row_fg = np.where(master_alpha[y, :160] > 0)[0]
        if len(row_fg) > 0:
            master_alpha[y, row_fg[0]:row_fg[-1] + 1] = 255

    # Bottom-Left finial (Y: 1150..1374, X: 0..160)
    for y in range(1150, 1374):
        row_fg = np.where(master_alpha[y, :160] > 0)[0]
        if len(row_fg) > 0:
            master_alpha[y, row_fg[0]:row_fg[-1] + 1] = 255

    # Soften outer edge boundary with 1-pixel Gaussian blur for antialiasing
    blur_alpha = cv2.GaussianBlur(master_alpha.astype(float), (3, 3), 0.5)
    master_alpha = np.clip(blur_alpha, 0, 255).astype(np.uint8)

    # Inpaint any pitch-black crevices in wood/rope inside the finials
    # (keeps authentic wood colors, replaces [0,0,0] shadow holes with [34, 22, 14])
    wood_shadow = np.array([34, 22, 14], dtype=np.uint8)
    for y in range(220):
        for x in range(157):
            if master_alpha[y, x] > 200 and orig_arr[y, x].max() < 12:
                orig_arr[y, x] = wood_shadow

    for y in range(1150, 1374):
        for x in range(148):
            if master_alpha[y, x] > 200 and orig_arr[y, x].max() < 12:
                orig_arr[y, x] = wood_shadow

    # =========================================================================
    # 2. REPAIR TOP ROLLER (Y: 0 to 220)
    # =========================================================================
    top_clean = orig_arr[:220, :].copy()
    top_alpha = master_alpha[:220, :].copy()

    # Donor rolled parchment texture from X: 300 to 450 (150 px wide)
    donor_top = top_clean[25:160, 300:450].copy()
    dh, dw, _ = donor_top.shape

    # A. Fill left parchment cylinder gap (X: 157 to 235)
    for i in range(235 - 157):
        x = 157 + i
        d_x = dw - 1 - (i % dw)
        top_clean[25:160, x] = donor_top[:, d_x]
        top_alpha[25:160, x] = 255

    # Contact shadow next to left gold collar ring (X: 157 to 167)
    for i in range(10):
        x = 157 + i
        shadow = 0.58 + 0.42 * (i / 10.0)
        top_clean[25:160, x] = (top_clean[25:160, x] * shadow).astype(np.uint8)

    # Smooth cosine blend into authentic roll at X: 225 to 245
    for x in range(225, 245):
        t = (x - 225) / 20.0
        w = 0.5 - 0.5 * np.cos(t * np.pi)
        top_clean[25:160, x] = (top_clean[25:160, x] * (1.0 - w) + orig_arr[25:160, x] * w).astype(np.uint8)

    # B. Fill right parchment cylinder gap (X: 840 to 988)
    for i in range(988 - 840):
        x = 840 + i
        d_x = i % dw
        top_clean[25:160, x] = donor_top[:, d_x]
        top_alpha[25:160, x] = 255

    # Contact shadow next to right gold collar ring (X: 978 to 988)
    for i in range(10):
        x = 988 - i
        shadow = 0.58 + 0.42 * (i / 10.0)
        top_clean[25:160, x] = (top_clean[25:160, x] * shadow).astype(np.uint8)

    # Smooth cosine blend at X: 830 to 850
    for x in range(830, 850):
        t = (x - 830) / 20.0
        w = 0.5 + 0.5 * np.cos(t * np.pi)
        top_clean[25:160, x] = (orig_arr[25:160, x] * (1.0 - w) + top_clean[25:160, x] * w).astype(np.uint8)

    # C. Fill top rim notch at X: 670 to 730
    rim_donor = top_clean[25:60, 480:540].copy()
    for x in range(670, 730):
        d_x = (x - 670) % 60
        top_clean[25:55, x] = rim_donor[:30, d_x]

    # D. Symmetrical right endcap from left endcap
    tl_endcap_rgb = top_clean[:, :157].copy()
    tl_endcap_a = top_alpha[:, :157].copy()
    top_clean[:, W - 157:] = np.fliplr(tl_endcap_rgb)
    top_alpha[:, W - 157:] = np.fliplr(tl_endcap_a)

    # =========================================================================
    # 3. REPAIR BOTTOM ROLLER (Y: 1150 to 1374, H = 224)
    # =========================================================================
    bot_clean = orig_arr[1150:, :].copy()
    bot_alpha = master_alpha[1150:, :].copy()
    b_h, _, _ = bot_clean.shape

    # Donor rolled parchment texture from X: 280 to 430
    bot_donor = bot_clean[35:185, 280:430].copy()
    bd_h, bd_w, _ = bot_donor.shape

    # A. Fill left cylinder gap (X: 148 to 220)
    for i in range(220 - 148):
        x = 148 + i
        d_x = bd_w - 1 - (i % bd_w)
        bot_clean[35:185, x] = bot_donor[:, d_x]
        bot_alpha[35:185, x] = 255

    # Contact shadow next to left gold collar ring (X: 148 to 158)
    for i in range(10):
        x = 148 + i
        shadow = 0.58 + 0.42 * (i / 10.0)
        bot_clean[35:185, x] = (bot_clean[35:185, x] * shadow).astype(np.uint8)

    # Smooth cosine blend at X: 210 to 230
    for x in range(210, 230):
        t = (x - 210) / 20.0
        w = 0.5 - 0.5 * np.cos(t * np.pi)
        bot_clean[35:185, x] = (bot_clean[35:185, x] * (1.0 - w) + orig_arr[1150+35:1150+185, x] * w).astype(np.uint8)

    # B. Fill right cylinder gap (X: 925 to 997)
    for i in range(997 - 925):
        x = 925 + i
        d_x = i % bd_w
        bot_clean[35:185, x] = bot_donor[:, d_x]
        bot_alpha[35:185, x] = 255

    # Contact shadow next to right gold collar ring (X: 987 to 997)
    for i in range(10):
        x = 997 - i
        shadow = 0.58 + 0.42 * (i / 10.0)
        bot_clean[35:185, x] = (bot_clean[35:185, x] * shadow).astype(np.uint8)

    # Smooth cosine blend at X: 915 to 935
    for x in range(915, 935):
        t = (x - 915) / 20.0
        w = 0.5 + 0.5 * np.cos(t * np.pi)
        bot_clean[35:185, x] = (orig_arr[1150+35:1150+185, x] * (1.0 - w) + bot_clean[35:185, x] * w).astype(np.uint8)

    # C. Symmetrical right endcap from left endcap
    bl_endcap_rgb = bot_clean[:, :148].copy()
    bl_endcap_a = bot_alpha[:, :148].copy()
    bot_clean[:, W - 148:] = np.fliplr(bl_endcap_rgb)
    bot_alpha[:, W - 148:] = np.fliplr(bl_endcap_a)

    # =========================================================================
    # 4. COMPOSITE ONTO FINAL POSTER CANVASES
    # =========================================================================
    def composite_poster(center_rgba, is_blank=False):
        final = center_rgba.copy()

        # Overwrite entire top roller region: Y = 0 to 220
        # Endcaps (X < 157 or X >= W - 157) are 100% written from top_clean for all Y: 0 to 220
        # Central parchment (157 <= X < W - 157):
        # Y: 0 to 190: 100% top_clean
        # Y: 190 to 220: smooth cosine blend into center_rgba
        for y in range(220):
            for x in range(W):
                if x < 157 or x >= W - 157 or y < 190:
                    final[y, x, :3] = top_clean[y, x]
                    final[y, x, 3] = top_alpha[y, x]
                else:
                    # Y: 190 to 220
                    t = (y - 190) / 30.0
                    w = 0.5 - 0.5 * np.cos(t * np.pi)
                    if not is_blank:
                        col = (top_clean[y, x] * (1.0 - w) + center_rgba[y, x, :3] * w).astype(np.uint8)
                        final[y, x, :3] = col
                    else:
                        final[y, x, :3] = top_clean[y, x]
                    final[y, x, 3] = max(top_alpha[y, x], center_rgba[y, x, 3])

        # Overwrite entire bottom roller region: Y = 1150 to 1374
        # Endcaps (X < 148 or X >= W - 148) are 100% written from bot_clean for all Y >= 1150
        # Central parchment (148 <= X < W - 148):
        # Y: 1150 to 1175: smooth cosine blend from center_rgba into bot_clean
        # Y: 1175 to 1374: 100% bot_clean
        for y_l in range(b_h):
            y = 1150 + y_l
            if y >= H: break
            for x in range(W):
                if x < 148 or x >= W - 148 or y_l >= 25:
                    final[y, x, :3] = bot_clean[y_l, x]
                    final[y, x, 3] = bot_alpha[y_l, x]
                else:
                    # Y_l: 0 to 25 (Y: 1150 to 1175)
                    t = y_l / 25.0
                    w = 0.5 - 0.5 * np.cos(t * np.pi)
                    if not is_blank:
                        col = (center_rgba[y, x, :3] * (1.0 - w) + bot_clean[y_l, x] * w).astype(np.uint8)
                        final[y, x, :3] = col
                    else:
                        final[y, x, :3] = bot_clean[y_l, x]
                    final[y, x, 3] = max(bot_alpha[y_l, x], center_rgba[y, x, 3])

        return final

    final_gamejam_arr = composite_poster(gamejam_arr, is_blank=False)
    final_blank_arr = composite_poster(blank_arr, is_blank=True)

    # Save to disk
    Image.fromarray(final_gamejam_arr).save('assets/images/A Call to Adventure_ GameJam 2026.png')
    Image.fromarray(final_blank_arr).save('assets/images/scroll_blank_base.png')

    all_paths = [
        'assets/images/SCROLL FOR AR POSTER.png',
        'assets/images/scroll_poster.png',
        'assets/images/scroll_poster_transparent.png',
        'assets/A Call to Adventure_ GameJam 2026.png',
        'assets/SCROLL FOR AR POSTER.png',
        'assets/scroll_poster.png',
        'assets/scroll_poster_transparent.png',
        'assets/scroll_blank_base.png'
    ]
    for p in all_paths:
        if 'blank' in p:
            Image.fromarray(final_blank_arr).save(p)
        else:
            Image.fromarray(final_gamejam_arr).save(p)
        print(f"Updated master asset: {p}")

    cw, ch = 280, 240
    Image.fromarray(final_gamejam_arr[:ch, :cw]).save('master_top_left.png')
    Image.fromarray(final_gamejam_arr[:ch, W - cw:]).save('master_top_right.png')
    Image.fromarray(final_gamejam_arr[H - ch:, :cw]).save('master_bot_left.png')
    Image.fromarray(final_gamejam_arr[H - ch:, W - cw:]).save('master_bot_right.png')

    Image.fromarray(final_gamejam_arr[:220, :]).save('master_full_top_roller.png')
    Image.fromarray(final_gamejam_arr[H - 220:, :]).save('master_full_bottom_roller.png')
    Image.fromarray(final_gamejam_arr).save('master_full_scroll.png')

    print("Master reconstruction completed successfully.")

if __name__ == '__main__':
    generate_flawless_master_scroll()
