"""Cut the calculator's icons out of the Songs of Syx sprite sheets and write src/icons.json.

Usage:
    1. Unzip the game's base/data.zip somewhere (it contains data/assets/sprite/...).
    2. python src/extract_icons.py <path-to-unzipped-data>/data/assets/sprite

Sheet layout: each sheet has a colour half and a mask half. Tiles sit on a grid with a
6px border, so tile n is at x = 6 + col*(size+6), y = 6 + row*(size+6) in the colour half.
"""
import base64, io, json, pathlib, sys
from PIL import Image

SPRITES = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'data/data/assets/sprite')
OUT = pathlib.Path(__file__).parent / 'icons.json'
SHEET_BG = {(0, 0, 132), (255, 0, 0), (178, 0, 255)}  # border/background colours to make transparent

def tile(path, size, idx):
    im = Image.open(SPRITES / path).convert('RGBA')
    step = size + 6
    cols = (im.size[0] // 2 - 6) // step
    r, c = divmod(idx, cols)
    x, y = 6 + c * step, 6 + r * step
    t = im.crop((x, y, x + size, y + size))
    px = t.load()
    for i in range(size):
        for j in range(size):
            if px[i, j][:3] in SHEET_BG:
                px[i, j] = (0, 0, 0, 0)
    return t

# name: (sheet, tile size, tile index)
ICONS = {
    # rooms and resources
    'lab':        ('icon/32/KNOWLEDGE.png', 32, 0),
    'library':    ('icon/32/KNOWLEDGE.png', 32, 1),
    'innov_book': ('icon/32/KNOWLEDGE.png', 32, 1),
    'admin':      ('icon/32/INFRA.png', 32, 0),
    'mine':       ('icon/32/TECH_MINE.png', 32, 4),
    'hunter':     ('icon/32/WORK.png', 32, 4),
    'woodcutter': ('icon/32/WORK.png', 32, 0),
    'auroch':     ('icon/32/animal/Auroch.png', 32, 0),
    'paperws':    ('icon/32/WORKSHOP.png', 32, 5),
    'cart':       ('icon/32/LOGISTICS.png', 32, 0),
    'clay':       ('icon/24/resource/Clay.png', 24, 0),
    'leather':    ('icon/24/resource/Leather.png', 24, 0),
    'meat':       ('icon/24/resource/Meat.png', 24, 0),
    'paper':      ('icon/24/resource/Paper.png', 24, 0),
    'wood':       ('icon/24/resource/Wood.png', 24, 0),
    'noble':      ('icon/24/_Icons.png', 24, 14),
    'vial':       ('icon/16/_Icons.png', 16, 17),
    'human':      ('icon/16/_Icons.png', 16, 14),
    'pick':       ('icon/16/_Icons.png', 16, 27),
    'nobleS':     ('icon/16/_Icons.png', 16, 37),
    # tech overlays and backgrounds (layered like the game's tech icons)
    'tech0':      ('icon/32/TECH.png', 32, 0),
    'tech1':      ('icon/32/TECH.png', 32, 1),
    'tech2':      ('icon/32/TECH.png', 32, 2),
    'tech3':      ('icon/32/TECH.png', 32, 3),
    'up1':        ('icon/32/TECH.png', 32, 4),
    'up2':        ('icon/32/TECH.png', 32, 5),
    'tools':      ('icon/32/TECH.png', 32, 7),
    'tools2':     ('icon/32/TECH.png', 32, 8),
    'bgmine':     ('icon/32/BG.png', 32, 4),
    'bgpasture':  ('icon/32/BG.png', 32, 2),
    # climates (config/CLIMATE.txt: COLD 3, TEMPERATE 0, HOT 1)
    'cl_cold':      ('icon/32/SEASONS.png', 32, 3),
    'cl_temperate': ('icon/32/SEASONS.png', 32, 0),
    'cl_hot':       ('icon/32/SEASONS.png', 32, 1),
}

out = {}
for name, (path, size, idx) in ICONS.items():
    buf = io.BytesIO()
    tile(path, size, idx).save(buf, 'PNG')
    out[name] = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
OUT.write_text(json.dumps(out))
print(f'wrote {len(out)} icons to {OUT}')
