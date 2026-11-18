"""Rasterise Lantmäteriet laser scans (COPC/LAZ, SWEREF 99 TM, RH 2000) onto the model's local grid.

Usage: python3 laser_grid.py <dir with .laz> <out.npz>   (extent from LX/LZ like build.py)
Writes 1 m grids over the mapped extent: highest return, mean ground height, point counts;
and a 5 m mean-ground grid over the wider terrain area.
"""
import sys, os, glob, math, numpy as np, laspy
LAT0, LON0, MX, MZ = 59.4240, 18.0741, 56770.0, 111403.0
XW, ZW, PAD = int(os.environ.get('LX', 1900)), int(os.environ.get('LZ', 1700)), 960
M = 60                                   # margin round the core grid, metres
W1, H1 = 2 * (XW + M), 2 * (ZW + M)      # 1 m core grid
C5 = 5; W5, H5 = 2 * (XW + PAD) // C5, 2 * (ZW + PAD) // C5

def sweref_to_local(E, N):
    """Inverse transverse Mercator (GRS80, central meridian 15 E, k0 0.9996), then the model's flat projection."""
    a, f, k0, l0, fe = 6378137.0, 1 / 298.257222101, 0.9996, math.radians(15), 500000.0
    n = f / (2 - f); A = a / (1 + n) * (1 + n * n / 4 + n ** 4 / 64); e2 = f * (2 - f)
    xi = N / (k0 * A); eta = (E - fe) / (k0 * A)
    b = [n / 2 - 2 * n * n / 3 + 37 * n ** 3 / 96, n * n / 48 + n ** 3 / 15, 17 * n ** 3 / 480]
    xp, ep = xi.copy(), eta.copy()
    for j in range(3):
        xp -= b[j] * np.sin(2 * (j + 1) * xi) * np.cosh(2 * (j + 1) * eta); ep -= b[j] * np.cos(2 * (j + 1) * xi) * np.sinh(2 * (j + 1) * eta)
    chi = np.arcsin(np.sin(xp) / np.cosh(ep)); lam = l0 + np.arctan2(np.sinh(ep), np.cos(xp))
    A_ = e2 + e2 ** 2 + e2 ** 3 + e2 ** 4; B_ = -(7 * e2 ** 2 + 17 * e2 ** 3 + 30 * e2 ** 4) / 6; C_ = (224 * e2 ** 3 + 889 * e2 ** 4) / 120; D_ = -(4279 * e2 ** 4) / 1260
    s2 = np.sin(chi) ** 2
    phi = chi + np.sin(chi) * np.cos(chi) * (A_ + B_ * s2 + C_ * s2 ** 2 + D_ * s2 ** 3)
    return (np.degrees(lam) - LON0) * MX, -(np.degrees(phi) - LAT0) * MZ

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    zmax = np.full(W1 * H1, -999, np.float32); gsum = np.zeros(W1 * H1); gcnt = np.zeros(W1 * H1, np.int32); ncnt = np.zeros(W1 * H1, np.int32)
    wsum = np.zeros(W5 * H5); wcnt = np.zeros(W5 * H5, np.int32); classes = {}
    for path in sorted(glob.glob(os.path.join(src, '*.laz'))):
        with laspy.open(path) as fh:
            tot = 0
            for pts in fh.chunk_iterator(3_000_000):
                x, z = sweref_to_local(np.asarray(pts.x), np.asarray(pts.y)); h = np.asarray(pts.z, np.float32); cl = np.asarray(pts.classification)
                tot += len(h)
                for c, k in zip(*np.unique(cl, return_counts=True)): classes[int(c)] = classes.get(int(c), 0) + int(k)
                ok = (cl != 7) & (cl != 18)                                    # drop noise
                ix = np.floor(x + XW + M).astype(np.int64); iz = np.floor(z + ZW + M).astype(np.int64)
                m = ok & (ix >= 0) & (ix < W1) & (iz >= 0) & (iz < H1); idx = iz[m] * W1 + ix[m]; hh = h[m]
                if len(idx):
                    o = np.argsort(idx, kind='stable'); idx_s = idx[o]; hs = hh[o]; st = np.flatnonzero(np.r_[True, idx_s[1:] != idx_s[:-1]]); cells = idx_s[st]
                    zmax[cells] = np.maximum(zmax[cells], np.maximum.reduceat(hs, st)); ncnt += np.bincount(idx, minlength=W1 * H1).astype(np.int32)
                    g = cl[m] == 2
                    gsum += np.bincount(idx[g], weights=hh[g], minlength=W1 * H1); gcnt += np.bincount(idx[g], minlength=W1 * H1).astype(np.int32)
                jx = np.floor((x + XW + PAD) / C5).astype(np.int64); jz = np.floor((z + ZW + PAD) / C5).astype(np.int64)
                m = (cl == 2) & (jx >= 0) & (jx < W5) & (jz >= 0) & (jz < H5); j = jz[m] * W5 + jx[m]
                wsum += np.bincount(j, weights=h[m], minlength=W5 * H5); wcnt += np.bincount(j, minlength=W5 * H5).astype(np.int32)
            print(os.path.basename(path), tot, 'points', flush=True)
    print('classes', classes)
    np.savez_compressed(out, zmax=zmax.reshape(H1, W1), gsum=gsum.reshape(H1, W1).astype(np.float32), gcnt=gcnt.reshape(H1, W1), ncnt=ncnt.reshape(H1, W1),
                        wsum=wsum.reshape(H5, W5).astype(np.float32), wcnt=wcnt.reshape(H5, W5), meta=np.array([XW, ZW, M, PAD, C5]))
    print('covered core cells', round(float((ncnt > 0).mean()), 3), 'ground cells', round(float((gcnt > 0).mean()), 3))
