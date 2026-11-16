import os, sys, json, time, threading
import pyarrow as pa, pyarrow.fs as fs, pyarrow.parquet as pq, pyarrow.compute as pc
from concurrent.futures import ThreadPoolExecutor
typ=sys.argv[1]; W,S,E,N=18.037,59.406,18.111,59.442
def mk(): return fs.S3FileSystem(anonymous=True,region="us-west-2",proxy_options=os.environ["HTTPS_PROXY"],request_timeout=300,connect_timeout=30)
s3=mk()
fl=sorted(s3.get_file_info(fs.FileSelector(f"daylight-openstreetmap/parquet/osm_features/release=v1.58/type={typ}/")),key=lambda f:f.path)
print(typ,len(fl),round(sum(f.size for f in fl)/1e9,1),'GB',flush=True)
out=open(f'../data2/addr_{typ}.jsonl','a'); lock=threading.Lock(); t0=time.time(); done=[0,0]
def work(f):
    for attempt in range(4):
        try:
            pf=pq.ParquetFile(mk().open_input_file(f.path),buffer_size=8<<20)
            rows=[]
            for rg in range(pf.metadata.num_row_groups):
                t=pf.read_row_group(rg,columns=['min_lon','max_lon','min_lat','max_lat'])
                m=pc.and_(pc.and_(pc.less(t['min_lon'],E),pc.greater(t['max_lon'],W)),pc.and_(pc.less(t['min_lat'],N),pc.greater(t['max_lat'],S)))
                if pc.sum(m).as_py():
                    t2=pf.read_row_group(rg,columns=['id','tags','min_lon','max_lon','min_lat','max_lat']).filter(m)
                    for r in t2.to_pylist():
                        tg=dict(r['tags'] or [])
                        if any(k.startswith('addr:') for k in tg): rows.append({'id':r['id'],'lon':(r['min_lon']+r['max_lon'])/2,'lat':(r['min_lat']+r['max_lat'])/2,'tags':tg})
            with lock:
                for r in rows: out.write(json.dumps(r,ensure_ascii=False)+'\n')
                out.flush(); done[0]+=1; done[1]+=len(rows)
                print(f'{typ} file {done[0]}/{len(fl)} rows {done[1]} t={time.time()-t0:.0f}s',flush=True)
            return
        except Exception as e:
            print('ERR',f.path[-12:],attempt,repr(e)[:200],flush=True); time.sleep(5)
with ThreadPoolExecutor(int(sys.argv[2])) as ex: list(ex.map(work,fl))
print('DONE',typ,flush=True)
