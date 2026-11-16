import math, os, subprocess, json, numpy as np
from PIL import Image
LAT0,LON0,MX,MZ=59.4240,18.0741,56770.0,111403.0
import os as _os
XW,ZW,PAD,DX=int(_os.environ.get('LX',1050)),int(_os.environ.get('LZ',1150)),960,20
DD=_os.environ.get('LD','../data/')
Z=14
def tile(lon,lat):
    n=2**Z; x=(lon+180)/360*n; y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n; return x,y
x0,z0=-(XW+PAD),-(ZW+PAD); nx=int(2*(XW+PAD)/DX)+1; nz=int(2*(ZW+PAD)/DX)+1
cache={}
def get(tx,ty):
    if (tx,ty) not in cache:
        p=f'{DD}dem/{Z}_{tx}_{ty}.png'
        if not os.path.exists(p): subprocess.run(['curl','-sS','-f','-m','60','-o',p,f'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{Z}/{tx}/{ty}.png'],check=True)
        a=np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
        cache[(tx,ty)]=a[:,:,0]*256+a[:,:,1]+a[:,:,2]/256-32768
    return cache[(tx,ty)]
def px(gx,gy):
    tx,ty=int(gx//256),int(gy//256); return get(tx,ty)[int(gy)%256,int(gx)%256]
H=np.zeros((nz,nx))
for j in range(nz):
    for i in range(nx):
        lon=LON0+(x0+i*DX)/MX; lat=LAT0-(z0+j*DX)/MZ
        fx,fy=tile(lon,lat); gx=fx*256-0.5; gy=fy*256-0.5
        ix,iy=math.floor(gx),math.floor(gy); u,v=gx-ix,gy-iy
        H[j,i]=(px(ix,iy)*(1-u)+px(ix+1,iy)*u)*(1-v)+(px(ix,iy+1)*(1-u)+px(ix+1,iy+1)*u)*v
np.save(DD+'dem.npy',H)
print(len(cache),'tiles',nx,nz,'min',H.min(),'max',H.max(),'mean',H.mean())
c=H[PAD//DX:-PAD//DX,PAD//DX:-PAD//DX]; print('core',c.min(),c.max())
i0=int((0-x0)/DX); j0=int((0-z0)/DX); print('station',H[j0,i0])
print(np.round(H[::14,::14]).astype(int))
