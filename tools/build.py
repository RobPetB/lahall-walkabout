import json, math, random, hashlib, sys
from shapely.geometry import shape, box, Point, LineString, Polygon, MultiPolygon
from shapely.ops import transform, linemerge, unary_union
from shapely.prepared import prep
import os
D=os.environ.get('LD','../data/')
LAT0,LON0=59.4240,18.0741
MX,MZ=56770.0,111403.0
XW,ZW=int(os.environ.get('LX',1050)),int(os.environ.get('LZ',1150))
BOX=box(-XW,-ZW,XW,ZW)
def proj(x,y,z=None): return ((x-LON0)*MX, -(y-LAT0)*MZ)
def L(n):
    out=[]
    for f in json.load(open(D+n+'.json'))['features']:
        g=transform(proj,shape(f['geometry']))
        if not g.is_valid: g=g.buffer(0)
        if g.intersects(BOX): out.append((g,f['properties']))
    return out
def nm(p): return (p.get('names') or {}).get('primary')
def h32(s): return int(hashlib.md5(s.encode()).hexdigest()[:8],16)
def flat(coords): 
    o=[]
    for x,z in coords: o+= [round(x*10),round(z*10)]
    return o
def polys(g):
    if g.is_empty: return []
    if g.geom_type=='Polygon': return [g]
    if g.geom_type in('MultiPolygon','GeometryCollection'): return [p for q in g.geoms for p in polys(q)]
    return []
def lines(g):
    if g.is_empty: return []
    if g.geom_type=='LineString': return [g]
    if g.geom_type in('MultiLineString','GeometryCollection'): return [p for q in g.geoms for p in lines(q)]
    return []
def ring(r):
    c=list(r.coords)[:-1]
    return flat(c)
W={}
# ---------- ground polygons
G=[]
def addpoly(kind,g,tol=1.2,minarea=6):
    g=g.intersection(BOX)
    for p in polys(g):
        p=p.simplify(tol)
        for q in polys(p):
            if q.area<minarea: continue
            from shapely.geometry.polygon import orient
            q=orient(q)
            G.append({'k':kind,'p':ring(q.exterior),'h':[ring(i) for i in q.interiors if Polygon(i).area>8]})
land=L('land'); lu=L('land_use'); water=L('water'); infra=L('infra')
LU1={'residential':'res','commercial':'com','industrial':'ind','retail':'com','school':'edu','kindergarten':'edu','railway':'rail','construction':'ind','farmland':'farm','animal_keeping':'farm','allotments':'garden','cemetery':'park'}
LU2={'park':'park','grass':'grass','garden':'garden','pitch':'pitch','playground':'play','fairway':'fairway','green':'green','bunker':'sand','tee':'green','water_hazard':'water','pedestrian':'paved','plaza':'paved','track':'pitch','nature_reserve':None,'species_management_area':None}
order=[]
for g,p in lu:
    c=p.get('class')
    if c in LU1: addpoly(LU1[c],g,2.0,30)
LAND={'wood':'forest','forest':'forest','scrub':'scrub','wetland':'wet','grassland':'grass','bare_rock':'rock','beach':'sand','islet':'grass','land':None}
forest=[]
for g,p in land:
    c=p.get('class')
    if g.geom_type in('Polygon','MultiPolygon') and LAND.get(c):
        addpoly(LAND[c],g,1.5,20)
        if LAND[c]=='forest': forest.append(g.intersection(BOX))
parks=[];resid=[]
for g,p in lu:
    c=p.get('class')
    if LU2.get(c): addpoly(LU2[c],g,0.8,8)
    if c=='park': parks.append(g.intersection(BOX))
    if c=='residential': resid.append(g.intersection(BOX))
waterpolys=[]
poolgeoms=[]
for g,p in water:
    if g.geom_type in('Polygon','MultiPolygon'):
        if p.get('class')=='swimming_pool': addpoly('pool',g,0.2,3); poolgeoms.extend(polys(g))
        else:
            addpoly('water',g,1.5,10); waterpolys.append(g.intersection(BOX))
streams=[]
for g,p in water:
    if g.geom_type=='LineString' and p.get('class') in('stream','ditch','drain'):
        for l in lines(g.intersection(BOX)): streams.append(flat(l.simplify(0.8).coords))
platforms=[]
for g,p in infra:
    c=p.get('class')
    if g.geom_type=='Polygon':
        if c in('parking','parking_space'): addpoly('parking',g,0.5,10)
        elif c=='platform': 
            for q in polys(g.intersection(BOX)): platforms.append(ring(q.simplify(0.2).exterior))
        elif c=='bicycle_parking': addpoly('paved',g,0.3,3)
W['ground']=G; W['streams']=streams; W['platforms']=platforms
# ---------- roads
seg=L('segment')
names=[];nidx={}
roads=[];rails=[];roadgeoms=[]
RW={'motorway':11,'trunk':10,'primary':9,'secondary':8,'tertiary':7,'unclassified':5.5,'residential':5.5,'living_street':4.5,'service':3.4,'pedestrian':4,'track':2.6,'cycleway':3,'footway':1.8,'path':1.3,'bridleway':1.6,'steps':1.8,'unknown':3}
raillines=[]; railfeat=[]
for g,p in seg:
    st=p.get('subtype'); c=p.get('class')
    if st=='rail':
        raillines.append(g); railfeat.append((g,p))
        for l in lines(g.intersection(BOX)): rails.append(flat(l.simplify(0.3).coords))
        continue
    if st!='road': continue
    n=nm(p); ni=-1
    if n:
        if n not in nidx: nidx[n]=len(names); names.append(n)
        ni=nidx[n]
    # bridge and tunnel flags apply to a stretch of the segment ("between" fractions), so cut the segment there
    from shapely.ops import substring
    spans=[]
    for f in (p.get('road_flags') or []):
        v=f.get('values') or []; bt=f.get('between') or [0.0,1.0]
        code=1 if 'is_bridge' in v else (2 if 'is_tunnel' in v else 0)
        if code: spans.append((bt[0],bt[1],code))
    cuts=sorted(set([0.0,1.0]+[x for sp in spans for x in sp[:2]]))
    pieces=[]
    for whole in ([g] if g.geom_type=='LineString' else list(g.geoms)):
        for a,b in zip(cuts,cuts[1:]):
            if b-a<1e-6: continue
            m=(a+b)/2; br=max([sp[2] for sp in spans if sp[0]<=m<=sp[1]] or [0])
            pieces.append((substring(whole,a,b,normalized=True),br))
    for piece,br in pieces:
        for l in lines(piece.intersection(BOX)):
            l=l.simplify(0.4)
            if l.length<1: continue
            roads.append({'c':c,'n':ni,'p':flat(l.coords),'b':br})
            roadgeoms.append(l.buffer(RW.get(c,3)/2+1.5))
W['roads']=roads; W['rails']=rails; W['names']=names
# ---------- train path
m=linemerge(unary_union(raillines))
ml=sorted(lines(m),key=lambda l:-l.length)
print('rail merged',[round(l.length) for l in ml][:6],file=sys.stderr)
ml.sort(key=lambda l:l.distance(Point(1,-4)))
path=ml[0].intersection(box(-XW-150,-ZW-150,XW+150,ZW+150))
path=sorted(lines(path),key=lambda l:-l.length)[0].simplify(0.3)
halt=[g for g,p in infra if p.get('class')=='railway_halt']
_hs={}
for g,p in infra:
    if p.get('class')=='railway_halt' and path.distance(g)<60: _hs[round(path.project(g))]=nm(p) or ''
W['train']={'p':flat(path.coords),'stops':sorted(_hs),'names':[_hs[k] for k in sorted(_hs)]}
print('halts',[(round(h.x),round(h.y),nm(p)) for h,p in [(g,p) for g,p in infra if p.get('class')=='railway_halt']],file=sys.stderr)
# ---------- buildings
def _pl(g):
    return [x for x in getattr(g,'geoms',[g]) if x.geom_type=='Polygon' and x.area>0.3]
def hip(q, maxrise, maxslope, maxR=99):
    """Hipped roof as height bands: mitred insets of the footprint are the roof's contour lines."""
    off=lambda d: q.buffer(-d, join_style=2, mitre_limit=3)
    lo,hi=0.0,60.0
    for _ in range(24):
        m=(lo+hi)/2
        if _pl(off(m)): lo=m
        else: hi=m
    R=lo
    if R<1.2 or R>maxR: return None  # big blocks keep flat roofs
    slope=min(maxslope, maxrise/R)
    ds=[-0.4, R*0.5, R*0.93]
    lv=[_pl(off(d).simplify(0.05)) for d in ds]
    if not lv[0] or not lv[2]: return None
    bands=[]
    for i in range(2):
        for o in lv[i]:
            inner=[x for x in lv[i+1] if o.buffer(0.05).contains(x)]
            bands.append([round(ds[i]*10), ring(o.exterior), round(ds[i+1]*10), [ring(x.exterior) for x in inner]])
    for o in lv[2]: bands.append([round(ds[2]*10), ring(o.exterior), round(ds[2]*10), []])
    return {'s':round(slope*100), 'b':bands}
# ---------- laser scan (optional): real heights above ground on a 1 m grid, see laser_grid.py
import numpy as np
from shapely import contains_xy
LAS=None
if os.path.exists(D+'laser.npz'):
    from scipy import ndimage as _ndi
    _z=np.load(D+'laser.npz'); _lm=int(_z['meta'][2]); _gc=_z['gcnt']
    _g=np.where(_gc>0,_z['gsum']/np.maximum(_gc,1),np.nan).astype(np.float32)
    _g=_g[tuple(_ndi.distance_transform_edt(np.isnan(_g),return_distances=False,return_indices=True))]   # holes take the nearest ground
    _zm=_z['zmax'].astype(np.float32)
    LAS={'nd':np.where(_zm>-900,_zm-_g,0).clip(0,60).astype(np.float32),'has':_zm>-900}
    print('laser grid',LAS['nd'].shape,'covered',round(float(LAS['has'].mean()),3),file=sys.stderr)
def las_cells(q):
    nd=LAS['nd']; x0,z0,x1,z1=q.bounds
    i0=max(0,int(math.floor(x0+XW+_lm))); i1=min(nd.shape[1],int(math.ceil(x1+XW+_lm))); j0=max(0,int(math.floor(z0+ZW+_lm))); j1=min(nd.shape[0],int(math.ceil(z1+ZW+_lm)))
    if i1<=i0 or j1<=j0: return np.zeros(0),np.zeros(0),np.zeros(0)
    X,Z=np.meshgrid(np.arange(i0,i1)+0.5-XW-_lm,np.arange(j0,j1)+0.5-ZW-_lm)
    m=contains_xy(q,X,Z)&LAS['has'][j0:j1,i0:i1]
    return nd[j0:j1,i0:i1][m],X[m],Z[m]
def laser_roof(q,axes):
    """Eave height, roof rise, and whether the ridge runs along the short side, from the scan. None when the scan says nothing useful."""
    inner=q.buffer(-1.0)
    if inner.is_empty or inner.area<8: inner=q.buffer(-0.4)
    if inner.is_empty: inner=q
    v,X,Z=las_cells(inner)
    if len(v)<6: return None
    eave=float(np.percentile(v,15)); ridge=float(np.percentile(v,92)); med=float(np.median(v))
    if ridge<2.0: return 'low'          # the scan sees nothing building-sized here
    if ridge>60: return None
    swap=False
    if axes and ridge-eave>=0.9 and len(v)>=20:
        cx,cz,ux,uz=axes; pu=(X-cx)*ux+(Z-cz)*uz; pv=-(X-cx)*uz+(Z-cz)*ux
        def corr(a,b_):
            sa,sb=a.std(),b_.std(); return 0.0 if sa<1e-6 or sb<1e-6 else float(((a-a.mean())*(b_-b_.mean())).mean()/(sa*sb))
        along=corr(v,-np.abs(pv)); across=corr(v,-np.abs(pu))     # a ridge along the long side falls away sideways
        swap=across>along+0.15 and across>0.3
    return eave,ridge-eave,swap,med
from shapely.strtree import STRtree
bl=L('building')
# hand corrections: things the open map gets wrong and someone who knows the place has pointed out
OVR=json.load(open(D+'overrides.json')) if os.path.exists(D+'overrides.json') else {}
for o in OVR.get('add_buildings',[]):
    bl.append((Polygon([(o['ring'][i],o['ring'][i+1]) for i in range(0,len(o['ring']),2)]),{'id':'override:'+o['note'],'class':o.get('class','shed'),'_h':o.get('h'),'_rise':o.get('rise',0)}))
_pooltree=STRtree(poolgeoms) if poolgeoms else None
B=[];bgeoms=[];_nlas=0;_npool=0
OUT={'carport','garage','garages','shed','roof','shelter','parking'}
HOUSE={'house','detached','semidetached_house','residential','terrace',None}
for g,p in bl:
    for q in polys(g):
        if not BOX.contains(q.centroid): continue
        q=q.simplify(0.3)
        if q.geom_type!='Polygon' or q.area<6: continue
        from shapely.geometry.polygon import orient
        q=orient(q)
        a=q.area; c=p.get('class'); st=p.get('subtype'); h=h32(p['id'])
        nf=p.get('num_floors'); hh=p.get('height')
        roof=None
        if c in OUT or a<40: t=2; H=2.5+ (h%5)*0.12
        elif c=='apartments' or (c in('residential',None) and a>=420 and st!='education'):
            t=1; fl=nf or (3+h%3 if c=='apartments' else 2+h%2); H=fl*3.0+0.6
        elif c in HOUSE and a<420:
            t=0; H=3.1 if (h%10<4 and c!='terrace') else 5.7
        elif c=='church': t=3; H=11
        else:
            t=3; H=(nf*3.4 if nf else 4.5+(h%4)*1.0)
        if nf and t!=2: H=max(H,nf*3.0+0.4)
        if hh: H=float(hh)
        r=q.minimum_rotated_rectangle; rect=None
        if r.geom_type=='Polygon' and r.area>0:
            cs=list(r.exterior.coords)
            e1=(cs[1][0]-cs[0][0],cs[1][1]-cs[0][1]); e2=(cs[2][0]-cs[1][0],cs[2][1]-cs[1][1])
            l1=math.hypot(*e1); l2=math.hypot(*e2)
            if l1<l2: e1,e2,l1,l2=e2,e1,l2,l1
            if l1>0 and l2>0: rect=(e1,e2,l1,l2,a/r.area>0.8)
        las=laser_roof(q,(r.centroid.x,r.centroid.y,rect[0][0]/rect[2],rect[0][1]/rect[2]) if rect else None) if LAS else None
        if las=='low':
            # a 'building' that the scan shows flat on the ground and that sits on a mapped pool is the pool, not a house
            if _pooltree is not None and sum(q.intersection(poolgeoms[int(i)]).area for i in _pooltree.query(q))>=0.35*a: _npool+=1; continue
            las=None
        rise=None
        if las:
            # the scan decides: wall height to the eaves, how much roof sits on top, and which way the ridge runs
            _nlas+=1; rise=las[1] if las[1]>=0.9 else 0.0; H=max(2.2,las[0] if rise else las[3])
            # a small building under a tree reads as tall as the tree: keep outbuildings and houses within what such buildings are
            if t==2: H=min(H,4.2); rise=min(rise,2.2)
            elif t==0: H=min(H,8.5); rise=min(rise,5.5)
            if rect and las[2]: rect=(rect[1],rect[0],rect[3],rect[2],rect[4])
        if p.get('_h'): H=float(p['_h']); rise=float(p.get('_rise') or 0); las=las or (H,rise,False,H)   # a stated size beats the scan
        pitched=(rise>0) if las else (t in (0,2) or (t==3 and c=='church'))
        if pitched and rect and rect[4]:
            e1,e2,l1,l2,_=rect
            roof=[round(r.centroid.x*10),round(r.centroid.y*10),round(l1*5),round(l2*5),round(math.atan2(e1[1],e1[0])*1000)]
        d={'p':ring(q.exterior),'h':round(H*10),'t':t,'s':h%97}
        if las: d['rr']=round(rise*10)
        if roof: d['r']=roof
        elif las and rise>0:
            k=hip(q, rise, 3.0, 99)
            if k: d['k']=k
        elif not las and (t==0 or (t==1 and H<=13)):
            k=hip(q, 3.3 if t==0 else 2.4, 0.8 if t==0 else 0.4, 99 if t==0 else 8.5)
            if k: d['k']=k
        n=nm(p)
        if n: d['n']=n
        B.append(d); bgeoms.append(q)
W['buildings']=B
print('buildings',len(B),'gabled',sum(1 for b in B if 'r' in b),'hipped',sum(1 for b in B if 'k' in b),'measured by laser',_nlas,'dropped as pools',_npool,file=sys.stderr)
# ---------- trees
random.seed(7)
obst=unary_union(roadgeoms+[b.buffer(2.5) for b in bgeoms]+[w.buffer(1) for w in waterpolys]+[l.buffer(4) for l in raillines])
T=[]
def scatter(geoms,per,conifer,cap):
    u=unary_union(geoms).difference(obst)
    n=0; per=max(per, u.area/cap)   # thin evenly when the cap would bite, never leave whole woods bare
    for q in polys(u):
        k=int(q.area/per+random.random()); 
        if k<=0: continue
        pq=prep(q); x0,z0,x1,z1=q.bounds; got=0;tries=0
        while got<k and tries<k*30:
            tries+=1
            pt=Point(random.uniform(x0,x1),random.uniform(z0,z1))
            if pq.contains(pt):
                T.extend([round(pt.x*10),round(pt.y*10),0 if random.random()<conifer else 1,round(70+random.random()*60)]); got+=1;n+=1
                if n>=cap: return
fu=unary_union(forest)
AF=(XW*ZW)/(1050*1150)
scatter(forest,75,0.6,int(9000*min(AF,1.9)))
scatter([unary_union(parks).difference(fu)],450,0.2,int(1200*min(AF,2.2)))
scatter([unary_union(resid).difference(fu)],520,0.25,int(5000*min(AF,1.8)))
if LAS:
    # real trees: the tops of the canopy in the scan, each with its measured height
    nd=LAS['nd']; sm=_ndi.gaussian_filter(nd,1.0); mx=_ndi.maximum_filter(sm,size=7); flat7=_ndi.uniform_filter(nd,7)
    cj,ci=np.nonzero((sm==mx)&(sm>=4.5)&(sm<=40)&LAS['has'])
    xs=ci+0.5-XW-_lm; zs=cj+0.5-ZW-_lm; hs=nd[cj,ci]
    ok=(np.abs(xs)<XW-1)&(np.abs(zs)<ZW-1)&(flat7[cj,ci]<0.88*sm[cj,ci])      # a flat top is a roof, not a tree
    ok&=~contains_xy(obst,xs,zs)
    xs,zs,hs=xs[ok],zs[ok],hs[ok]; order=np.argsort(-hs); cap=int(30000*min(AF,1.0)) if AF<1 else 30000; S=4.0
    while True:
        seen=set(); pick=[]
        for i in order:
            key=(int(xs[i]//S),int(zs[i]//S))
            if key in seen: continue
            seen.add(key); pick.append(i)
        if len(pick)<=cap: break
        S*=1.15
    inf=contains_xy(fu,xs[pick],zs[pick]); T=[]
    for n_,i in enumerate(pick):
        con=random.random()<(0.6 if inf[n_] else 0.25); full=10.7*1.15 if con else 9.2
        T.extend([round(float(xs[i])*10),round(float(zs[i])*10),0 if con else 1,int(max(35,min(330,hs[i]/full*100)))])
    print('laser trees',len(pick),'of',len(order),'candidates, spacing',round(S,1),'m, median height',round(float(np.median(hs[pick])),1),file=sys.stderr)
for g,p in land:
    if g.geom_type=='Point' and BOX.contains(g): T.extend([round(g.x*10),round(g.y*10),1,110])
    if g.geom_type=='LineString':
        l=g.intersection(BOX)
        for ll in lines(l):
            d=0
            while d<ll.length:
                pt=ll.interpolate(d); T.extend([round(pt.x*10),round(pt.y*10),1,100]); d+=9
W['trees']=T
print('trees',len(T)//4,file=sys.stderr)
W['stops']=[v for g,p in infra if p.get('class')=='bus_stop' and g.geom_type=='Point' and BOX.contains(g) for v in (round(g.x*10),round(g.y*10))]
W['lamps']=[v for g,p in infra if p.get('class')=='street_lamp' and BOX.contains(g) for v in (round(g.x*10),round(g.y*10))]
W['barriers']=[{'k':p.get('class'),'p':flat(l.simplify(0.3).coords)} for g,p in infra if p.get('class') in('hedge','fence','wall') for l in lines(g.intersection(BOX)) if l.length>2]
FK={'bench':'bench','post_box':'postbox','waste_basket':'bin','bicycle_parking':'bike','traffic_signals':'signal','give_way':'giveway','stop':'stop','charging_station':'charge','crossing':'cross'}
F={}
for g,p in infra:
    k=FK.get(p.get('class'))
    if k:
        q=g if g.geom_type=='Point' else g.centroid
        if BOX.contains(q): F.setdefault(k,[]).extend([round(q.x*10),round(q.y*10)])
W['furn']=F
# street lamps: the mapped ones, plus generated ones along streets the map leaves unlit
from shapely.geometry import LineString
from shapely.strtree import STRtree
_bt=STRtree(bgeoms); _lp=[(W['lamps'][i]/10,W['lamps'][i+1]/10) for i in range(0,len(W['lamps']),2)]; _n0=len(_lp); _grid={}
def _near(x,z,d):
    gx,gz=int(x//25),int(z//25)
    return any(math.hypot(x-a,z-b)<d for i in(-1,0,1) for j in(-1,0,1) for a,b in _grid.get((gx+i,gz+j),[]))
for a,b in _lp: _grid.setdefault((int(a//25),int(b//25)),[]).append((a,b))
for r in roads:
    if r['c'] not in('residential','tertiary','unclassified','living_street') or r['b']: continue
    ls=LineString([(r['p'][i]/10,r['p'][i+1]/10) for i in range(0,len(r['p']),2)]); w=RW.get(r['c'],5)
    sgn=1 if h32(str(r['p'][:4]))%2 else -1
    for sd in [14+33*i for i in range(int(max(0,ls.length-20)//33)+1) if 14+33*i<ls.length-6]:
        p0=ls.interpolate(sd); p1=ls.interpolate(sd+1); dx,dz=p1.x-p0.x,p1.y-p0.y; l=math.hypot(dx,dz) or 1
        x=p0.x-dz/l*(w/2+1.5)*sgn; z=p0.y+dx/l*(w/2+1.5)*sgn
        if _near(x,z,24) or not BOX.contains(Point(x,z)): continue
        if any(bgeoms[i].distance(Point(x,z))<0.6 for i in _bt.query(Point(x,z).buffer(1))): continue
        _grid.setdefault((int(x//25),int(z//25)),[]).append((x,z)); W['lamps'].extend([round(x*10),round(z*10)])
print('lamps mapped',_n0,'generated',len(W['lamps'])//2-_n0,'furn',{k:len(v)//2 for k,v in F.items()},'barriers',len(W['barriers']),file=sys.stderr)
# ---------- places
P=[]
for g,p in infra:
    n=nm(p); c=p.get('class')
    if n and g.geom_type=='Point' and BOX.contains(g) and c in('bus_stop','railway_halt','railway_station'):
        P.append({'n':n,'k':c,'x':round(g.x),'z':round(g.y)})
for g,p in lu+land+water:
    n=nm(p)
    if n and g.geom_type in('Polygon','MultiPolygon'):
        q=g.intersection(BOX)
        if q.is_empty or q.area<50: continue
        c=q.representative_point(); P.append({'n':n,'k':p.get('class'),'x':round(c.x),'z':round(c.y),'a':round(q.area)})
for b in B:
    if 'n' in b:
        xs=b['p'][0::2]; zs=b['p'][1::2]
        P.append({'n':b['n'],'k':'building','x':round(sum(xs)/len(xs)/10),'z':round(sum(zs)/len(zs)/10)})
for g,p in L('place'):
    n=nm(p)
    if n and BOX.contains(g): P.append({'n':n,'k':'poi:'+str(p.get('basic_category')),'x':round(g.x),'z':round(g.y)})
_seen=set(); W['places']=[]
for q in P:
    key=(q['n'].strip().lower(),q['x']//40,q['z']//40)
    if key in _seen or len(q['n'])>60: continue
    _seen.add(key); W['places'].append([q['n'].strip(),q['x'],q['z']])
print('places',len(W['places']),file=sys.stderr)

# ---------- terrain
import numpy as np
from shapely import contains_xy
H=np.load(D+'dem.npy'); PAD,DX=960,20; nz_,nx_=H.shape
if LAS:
    # terrain from the scan's ground points (RH 2000), averaged onto the 20 m lattice
    _wc=_z['wcnt']; _w=np.where(_wc>0,_z['wsum']/np.maximum(_wc,1),np.nan).astype(np.float32); _hole=np.isnan(_w)
    _w=_w[tuple(_ndi.distance_transform_edt(_hole,return_distances=False,return_indices=True))]
    _w=_ndi.uniform_filter(_w,4); _c=int(_z['meta'][4]); st=DX//_c
    jj=np.minimum(np.arange(nz_)*st,_w.shape[0]-1); ii=np.minimum(np.arange(nx_)*st,_w.shape[1]-1)
    Hl=_w[np.ix_(jj,ii)]; far=_ndi.distance_transform_edt(_hole)[np.ix_(jj,ii)]*_c
    print('terrain: laser vs old, median difference',round(float(np.median(Hl-H)),2),'m; nodes without nearby ground',int((far>60).sum()),file=sys.stderr)
    H=np.where(far>60,H+float(np.median(Hl-H)),Hl).astype(float)
def blur(a):
    p=np.pad(a,1,mode='edge'); return (p[:-2,:-2]+p[:-2,1:-1]+p[:-2,2:]+p[1:-1,:-2]+2*p[1:-1,1:-1]+p[1:-1,2:]+p[2:,:-2]+p[2:,1:-1]+p[2:,2:])/10
H=blur(H) if LAS else blur(blur(H))
gx_,gz_=np.meshgrid(-(XW+PAD)+np.arange(nx_)*DX, -(ZW+PAD)+np.arange(nz_)*DX)
wl=[]
BIG=box(-XW-PAD,-ZW-PAD,XW+PAD,ZW+PAD)
for f in json.load(open(D+'water.json'))['features']:
    p=f['properties']
    if f['geometry']['type'] not in('Polygon','MultiPolygon') or p.get('class')=='swimming_pool': continue
    g=transform(proj,shape(f['geometry']))
    if not g.is_valid: g=g.buffer(0)
    g=g.intersection(BIG)
    if g.is_empty or g.area<1500: continue
    m=contains_xy(g.buffer(12),gx_,gz_)
    if not m.any(): continue
    lvl=0.0 if p.get('class') in('ocean','bay','strait','sea') or p.get('subtype') in ('ocean','physical') else float(np.percentile(H[m],10))
    wl.append((m,lvl)); print('water',nm(p),p.get('class'),round(g.area),round(lvl,1),file=sys.stderr)
for it in range(3):
    for m,l in wl: H[m]=l
    if it<2: H=blur(H)
W['dem']={'x0':-(XW+PAD),'z0':-(ZW+PAD),'dx':DX,'nx':nx_,'nz':nz_,'h':[int(round(v*10)) for v in H.flatten()]}
# ---------- bridges: lift roads that cross over other roads, with ramps up to them
def _bridges():
    import heapq
    from shapely.ops import substring as _sub
    def _h(x,z):
        d=W['dem']; fx=min(max((x-d['x0'])/d['dx'],0),d['nx']-1.001); fz=min(max((z-d['z0'])/d['dx'],0),d['nz']-1.001); i=int(fx); j=int(fz); u=fx-i; v=fz-j; Hh=d['h']; n=d['nx']
        return ((Hh[j*n+i]*(1-u)+Hh[j*n+i+1]*u)*(1-v)+(Hh[(j+1)*n+i]*(1-u)+Hh[(j+1)*n+i+1]*u)*v)/10
    def _ls(r): return LineString([(r['p'][i]/10,r['p'][i+1]/10) for i in range(0,len(r['p']),2)])
    def _xpts(a,b):
        q=a.intersection(b); return [g for g in getattr(q,'geoms',[q]) if g.geom_type=='Point']
    _R=W['roads']; _L=[_ls(r) for r in _R]; _req={}
    FOOT={'footway','path','cycleway','steps','bridleway','pedestrian','track'}
    spans=[]   # stretches of railway that must clear something passing underneath: (line, clearance)
    def _span(line,need):
        if line.length>1: spans.append([line,need])
    for g,p in railfeat:
        for w in ([g] if g.geom_type=='LineString' else list(g.geoms)):
            for f in (p.get('rail_flags') or []):
                if 'is_bridge' in (f.get('values') or []):
                    bt=f.get('between') or [0.0,1.0]; _span(_sub(w,bt[0],bt[1],normalized=True),0)
    for k,r in enumerate(_R):
        if r['b']!=2: continue
        for g in raillines:
            for w in ([g] if g.geom_type=='LineString' else list(g.geoms)):
                if w.crosses(_L[k]):
                    for q in _xpts(w,_L[k]): s0=w.project(q); _span(_sub(w,max(0,s0-7),min(w.length,s0+7)),3.4 if r['c'] in FOOT else 4.8)
    for k,r in enumerate(_R):
        if r['b']!=2: continue
        for j,x in enumerate(_R):
            if j==k or x['b'] or not _L[k].crosses(_L[j]): continue
            for q in _xpts(_L[k],_L[j]):
                sx=_L[j].project(q); hw=RW.get(r['c'],3)/2+5
                _req.setdefault(j,[]).append((max(0,sx-hw),min(_L[j].length,sx+hw),3.4 if r['c'] in FOOT else 4.8))
        r['b']=0
    _new=[]
    for k,r in enumerate(_R):
        if k not in _req: _new.append(r); continue
        sp=sorted(_req[k]); mer=[list(sp[0])]
        for a,b,c in sp[1:]:
            if a<=mer[-1][1]+2: mer[-1][1]=max(mer[-1][1],b); mer[-1][2]=max(mer[-1][2],c)
            else: mer.append([a,b,c])
        pos=0.0; l=_L[k]
        for a,b,c in mer+[[l.length,l.length,0]]:
            if a-pos>0.5: _new.append({'c':r['c'],'n':r['n'],'p':flat(_sub(l,pos,a).coords),'b':0})
            if b-a>0.5: _new.append({'c':r['c'],'n':r['n'],'p':flat(_sub(l,a,b).coords),'b':1,'need':c})
            pos=b
    _R=W['roads']=_new; _L=[_ls(r) for r in _R]; _RL=[LineString([(r[i]/10,r[i+1]/10) for i in range(0,len(r),2)]) for r in W['rails']]
    def _dens(l,step=6):
        n=max(1,int(math.ceil(l.length/step))); return [l.interpolate(l.length*i/n) for i in range(n+1)]
    def _ease(t): t=max(0.0,min(1.0,t)); return t*t*(3-2*t)
    _src={}
    def _touch(j,m):
        a,b=_L[j],_L[m]
        if a.distance(b)>1.5: return None
        for e in (Point(b.coords[0]),Point(b.coords[-1])):
            if a.distance(e)<1.5: return e
        for e in (Point(a.coords[0]),Point(a.coords[-1])):
            if b.distance(e)<1.5: return e
        for ca in a.coords:
            for cb in b.coords:
                if math.hypot(ca[0]-cb[0],ca[1]-cb[1])<1.0: return Point(ca)
        return None
    _tree=STRtree(_L)
    import heapq
    for k,r in enumerate(_R):
        if r['b']!=1: continue
        l=_L[k]; a,b=l.coords[0],l.coords[-1]; ha,hb=_h(*a),_h(*b); Lf=0.0
        for j,x in enumerate(_R):
            if j==k or x['b']==1 or not l.crosses(_L[j]): continue
            for q in _xpts(l,_L[j]):
                t=l.project(q,normalized=True); need=r.get('need') or (3.4 if x['c'] in FOOT else 5.2); Lf=max(Lf,_h(q.x,q.y)+need-(ha+(hb-ha)*t))
        for o in _RL:
            if l.crosses(o):
                for q in _xpts(l,o): t=l.project(q,normalized=True); Lf=max(Lf,_h(q.x,q.y)+5.6-(ha+(hb-ha)*t))
        P=_dens(l); r['p']=flat([(q.x,q.y) for q in P]); r['z']=[max(0,round((ha+(hb-ha)*i/(len(P)-1)+Lf-_h(q.x,q.y))*10)) for i,q in enumerate(P)]; r.pop('need',None)
        if max(r['z'])<4: r['b']=0; del r['z']; continue
        print('bridge',r['c'],names[r['n']] if r['n']>=0 else '-',round(l.length),'lift',round(Lf,1),'max over ground',max(r['z'])/10,file=sys.stderr)
        if Lf<0.3: continue
        Dm=max(45.0,Lf*17); heap=[]; seen={}
        for E in (Point(a),Point(b)):
            for m in _tree.query(E.buffer(2)):
                m=int(m)
                if m!=k and _R[m]['b']!=1 and _L[m].distance(E)<1.5: heapq.heappush(heap,(0.0,m,_L[m].project(E)))
        while heap:
            d0,m,s0=heapq.heappop(heap); key=(m,round(s0/3))
            if d0>=Dm or seen.get(key,1e9)<=d0: continue
            seen[key]=d0; _src.setdefault(m,[]).append((s0,d0,Lf,Dm))
            for n2 in _tree.query(_L[m].buffer(2)):
                n2=int(n2)
                if n2==m or n2==k or _R[n2]['b']==1: continue
                e=_touch(m,n2)
                if e is None: continue
                dd=d0+abs(_L[m].project(e)-s0)
                if dd<Dm: heapq.heappush(heap,(dd,n2,_L[n2].project(e)))
    for m,ss in _src.items():
        l=_L[m]; P=_dens(l); n=len(P)-1
        z=[round(max(Lf*_ease(1-(d0+abs(l.length*i/n-s0))/Dm) for s0,d0,Lf,Dm in ss)*10) for i in range(n+1)]
        if max(z)>=3: _R[m]['p']=flat([(q.x,q.y) for q in P]); _R[m]['z']=z
    out=[]
    for line,need in spans:
        Lf=need
        for j,x in enumerate(_R):
            if x['b']==1 or 'z' in x or not line.crosses(_L[j]): continue
            Lf=max(Lf,3.4 if x['c'] in FOOT else 4.8)
        if Lf>0 and line.intersects(BOX): out.append({'p':flat(line.coords),'L':round(Lf*10),'D':round(max(110,Lf*38))})
    W['railspans']=out
    print('rail bridges',len(out),[o['L'] for o in out],file=sys.stderr)
    print('roads',len(_R),'lifted',sum(1 for r in _R if 'z' in r),'bridges',sum(1 for r in _R if r['b']==1),file=sys.stderr)

_bridges()


# ---------- addresses
import re, statistics
stl={}
for g,p in seg:
    n=nm(p)
    if n and p.get('subtype')=='road': stl.setdefault(n.lower(),[n,[]])[1].append(g)
stg={k:(v[0],unary_union(v[1])) for k,v in stl.items()}
A={}
_seen=set()
for l in [(k,x) for dd in sorted(set(['../data/',D])) for k in ('node','way') if os.path.exists(dd+'addr_'+k+'.jsonl') for x in open(dd+'addr_'+k+'.jsonl')]:
    r=json.loads(l[1]); t=r['tags']
    if (l[0],r['id']) in _seen: continue
    _seen.add((l[0],r['id']))
    if 'addr:housenumber' in t and 'addr:street' in t:
        x,z=proj(r['lon'],r['lat'])
        if BOX.contains(Point(x,z)): A.setdefault((t['addr:street'].strip(),t['addr:housenumber'].upper().replace(' ','')),[]).append((x,z,0))
n_osm=len(A)
for f in json.load(open(D+'place2.json'))['features']:
    ad=(f['properties'].get('addresses') or [{}])[0].get('freeform') or ''
    m=re.match(r'^\s*([^\d,]+?)\s+(\d+)\s?([A-Za-z]?)\s*(,|$)',ad)
    if not m: continue
    key=m.group(1).strip().lower()
    if key not in stg: continue
    x,z=proj(*f['geometry']['coordinates'])
    pt=Point(x,z)
    if not BOX.contains(pt) or stg[key][1].distance(pt)>90: continue
    k=(stg[key][0],m.group(2)+m.group(3).upper())
    if k in A and A[k][0][2]==0: continue
    A.setdefault(k,[]).append((x,z,1))
out=[]
for (st,num),v in A.items():
    out.append([st,num,round(statistics.median(a[0] for a in v)),round(statistics.median(a[1] for a in v)),v[0][2]])
out.sort(key=lambda a:(a[0],int(re.match(r'\d+',a[1]).group()) if re.match(r'\d+',a[1]) else 0,a[1]))
W['addr']=out
print('addresses',len(out),'osm',n_osm,'streets with numbers',len(set(a[0] for a in out)),'of',len(names),file=sys.stderr)
W['meta']={'lat0':LAT0,'lon0':LON0,'mx':MX,'mz':MZ,'xw':XW,'zw':ZW,'laser':1 if LAS else 0}
s=json.dumps(W,separators=(',',':'),ensure_ascii=False)
open(os.environ.get('LOUT','../world.json'),'w').write(s)
print({k:len(json.dumps(v)) for k,v in W.items()},len(s),file=sys.stderr)
for q in P:
    if not q['k'].startswith('poi') : print(q)
print(len([q for q in P if q['k'].startswith('poi')]),'pois')
print(sorted(set(names)))
import collections
print(collections.Counter(g['k'] for g in G))
