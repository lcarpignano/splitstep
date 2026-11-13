"""Genera los íconos PNG de la app sin dependencias externas (zlib + struct)."""
import math, struct, sys, zlib, os

BG_TOP = (0x1a, 0x22, 0x1c)
BG_BOT = (0x0a, 0x0d, 0x0b)
BALL = (0xd6, 0xf2, 0x3d)
SEAM = (0x0a, 0x0d, 0x0b)
LINE = (0xd6, 0xf2, 0x3d)

CX, CY, R = 0.57, 0.5, 0.29
SEAM_OFF, SEAM_R, SEAM_W = 0.40, 0.29, 0.026
LINES = [(0.13, 0.27, 0.38), (0.08, 0.25, 0.50), (0.13, 0.27, 0.62)]
LINE_W = 0.034

def seg_dist(px, py, x1, x2, y):
    cx = min(max(px, x1), x2)
    return math.hypot(px - cx, py - y)

def color_at(x, y):
    t = y
    c = tuple(BG_TOP[i] * (1 - t) + BG_BOT[i] * t for i in range(3))
    d = math.hypot(x - CX, y - CY)
    if d <= R:
        c = BALL
        for sx in (CX - SEAM_OFF, CX + SEAM_OFF):
            if abs(math.hypot(x - sx, y - CY) - SEAM_R) < SEAM_W / 2:
                c = SEAM
        # sombreado suave en el borde inferior derecho
        shade = max(0.0, ((x - CX) * 0.6 + (y - CY) * 0.8) / R)
        c = tuple(v * (1 - 0.18 * shade ** 2) for v in c)
    for x1, x2, ly in LINES:
        if seg_dist(x, y, x1, x2, ly) < LINE_W / 2:
            alpha = 0.35 + 0.65 * (x - x1) / (x2 - x1) if x2 > x1 else 1
            alpha = max(0.0, min(1.0, alpha))
            c = tuple(c[i] * (1 - alpha) + LINE[i] * alpha for i in range(3))
    return c

def render(size, ss=3):
    rows = bytearray()
    for py in range(size):
        rows.append(0)
        for px in range(size):
            acc = [0.0, 0.0, 0.0]
            for sy in range(ss):
                for sx in range(ss):
                    c = color_at((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size)
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
            n = ss * ss
            rows += bytes(int(round(v / n)) for v in acc)
    return bytes(rows)

def write_png(path, size):
    raw = render(size)
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print('ok', path)

out = sys.argv[1]
for name, size in (('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)):
    write_png(os.path.join(out, name), size)
