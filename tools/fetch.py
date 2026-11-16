import sys, json, os
import pyarrow as pa, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.fs as fs
from shapely import wkb
from shapely.geometry import mapping
REL="2026-10-21.0"
theme,typ,out=sys.argv[1],sys.argv[2],sys.argv[3]
W,S,E,N=[float(x) for x in sys.argv[4].split(',')]
cols=sys.argv[5].split(',') if len(sys.argv)>5 else None
s3=fs.S3FileSystem(anonymous=True,region="us-west-2",proxy_options=os.environ["HTTPS_PROXY"],connect_timeout=30,request_timeout=120)
d=ds.dataset(f"overturemaps-us-west-2/release/{REL}/theme={theme}/type={typ}/",filesystem=s3)
flt=(pc.field("bbox","xmin")<E)&(pc.field("bbox","xmax")>W)&(pc.field("bbox","ymin")<N)&(pc.field("bbox","ymax")>S)
names=[c for c in d.schema.names if (cols is None or c in cols or c in('id','geometry'))]
print(d.schema.names,file=sys.stderr)
t=d.to_table(filter=flt,columns=names)
feats=[]
for row in t.to_pylist():
    g=wkb.loads(row.pop('geometry'))
    row.pop('bbox',None)
    feats.append({"type":"Feature","geometry":mapping(g),"properties":row})
json.dump({"type":"FeatureCollection","features":feats},open(out,'w'),default=str)
print(typ,len(feats))
