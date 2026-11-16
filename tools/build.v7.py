import json, math, random, hashlib, sys
from shapely.geometry import shape, box, Point, LineString, Polygon, MultiPolygon
from shapely.ops import transform, linemerge, unary_union
from shapely.prepared import prep
D='../data/'
LAT0,LON0=59.4240,18.0741
MX,MZ=56770.0,111403.0
XW,ZW=1050,1150
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
for g,p in water:
    if g.geom_type in('Polygon','MultiPolygon'):
        if p.get('class')=='swimming_pool': addpoly('pool',g,0.2,3)
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
raillines=[]
for g,p in seg:
    st=p.get('subtype'); c=p.get('class')
    if st=='rail':
        raillines.append(g)
        for l in lines(g.intersection(BOX)): rails.append(flat(l.simplify(0.3).coords))
        continue
    if st!='road': continue
    n=nm(p); ni=-1
    if n:
        if n not in nidx: nidx[n]=len(names); names.append(n)
        ni=nidx[n]
    flags=json.dumps(p.get('road_flags') or '')
    br = 1 if 'is_bridge' in flags else (2 if 'is_tunnel' in flags else 0)
    for l in lines(g.intersection(BOX)):
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
W['train']={'p':flat(path.coords),'stops':sorted(set(round(path.project(h)) for h in halt))}
print('halts',[(round(h.x),round(h.y),nm(p)) for h,p in [(g,p) for g,p in infra if p.get('class')=='railway_halt']],file=sys.stderr)
# ---------- buildings
def _pl(g):
    return [x for x in getattr(g,'geoms',[g]) if x.geom_type=='Polygon' and x.area>0.3]
def hip(q, maxrise, maxslope):
    """Hipped roof as height bands: mitred insets of the footprint are the roof's contour lines."""
    off=lambda d: q.buffer(-d, join_style=2, mitre_limit=3)
    lo,hi=0.0,60.0
    for _ in range(24):
        m=(lo+hi)/2
        if _pl(off(m)): lo=m
        else: hi=m
    R=lo
    if R<1.2: return None
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
bl=L('building')
B=[];bgeoms=[]
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
        if t in (0,2) or (t==3 and c=='church'):
            r=q.minimum_rotated_rectangle
            if r.geom_type=='Polygon' and r.area>0 and a/r.area>0.8:
                cs=list(r.exterior.coords)
                e1=(cs[1][0]-cs[0][0],cs[1][1]-cs[0][1]); e2=(cs[2][0]-cs[1][0],cs[2][1]-cs[1][1])
                l1=math.hypot(*e1); l2=math.hypot(*e2)
                if l1<l2: e1,e2,l1,l2=e2,e1,l2,l1
                roof=[round(r.centroid.x*10),round(r.centroid.y*10),round(l1*5),round(l2*5),round(math.atan2(e1[1],e1[0])*1000)]
        d={'p':ring(q.exterior),'h':round(H*10),'t':t,'s':h%97}
        if roof: d['r']=roof
        elif t==0 or (t==1 and H<=13):
            k=hip(q, 3.3 if t==0 else 2.4, 0.8 if t==0 else 0.4)
            if k: d['k']=k
        n=nm(p)
        if n: d['n']=n
        B.append(d); bgeoms.append(q)
W['buildings']=B
print('buildings',len(B),'gabled',sum(1 for b in B if 'r' in b),file=sys.stderr)
# ---------- trees
random.seed(7)
obst=unary_union(roadgeoms+[b.buffer(2.5) for b in bgeoms]+[w.buffer(1) for w in waterpolys]+[l.buffer(4) for l in raillines])
T=[]
def scatter(geoms,per,conifer,cap):
    u=unary_union(geoms).difference(obst)
    n=0
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
scatter(forest,75,0.6,9000)
scatter([unary_union(parks).difference(fu)],450,0.2,1200)
scatter([unary_union(resid).difference(fu)],520,0.25,5000)
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
W['places']=[]

# ---------- terrain
import numpy as np
from shapely import contains_xy
H=np.load(D+'dem.npy'); PAD,DX=960,20; nz_,nx_=H.shape
def blur(a):
    p=np.pad(a,1,mode='edge'); return (p[:-2,:-2]+p[:-2,1:-1]+p[:-2,2:]+p[1:-1,:-2]+2*p[1:-1,1:-1]+p[1:-1,2:]+p[2:,:-2]+p[2:,1:-1]+p[2:,2:])/10
H=blur(blur(H))
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

# ---------- addresses
import re, statistics
stl={}
for g,p in seg:
    n=nm(p)
    if n and p.get('subtype')=='road': stl.setdefault(n.lower(),[n,[]])[1].append(g)
stg={k:(v[0],unary_union(v[1])) for k,v in stl.items()}
A={}
_seen=set()
for l in [(k,x) for k in ('node','way') for x in open(D+'addr_'+k+'.jsonl')]:
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
W['meta']={'lat0':LAT0,'lon0':LON0,'mx':MX,'mz':MZ,'xw':XW,'zw':ZW}
s=json.dumps(W,separators=(',',':'),ensure_ascii=False)
open('../world.json','w').write(s)
print({k:len(json.dumps(v)) for k,v in W.items()},len(s),file=sys.stderr)
for q in P:
    if not q['k'].startswith('poi') : print(q)
print(len([q for q in P if q['k'].startswith('poi')]),'pois')
print(sorted(set(names)))
import collections
print(collections.Counter(g['k'] for g in G))
