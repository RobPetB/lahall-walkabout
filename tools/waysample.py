import os, time, pyarrow.fs as fs, pyarrow.parquet as pq, pyarrow.compute as pc
W,S,E,N=18.055,59.410,18.110,59.438
s3=fs.S3FileSystem(anonymous=True,region="us-west-2",proxy_options=os.environ["HTTPS_PROXY"],request_timeout=300)
fl=sorted(s3.get_file_info(fs.FileSelector("daylight-openstreetmap/parquet/osm_features/release=v1.58/type=way/")),key=lambda f:f.path)
t0=time.time(); pf=pq.ParquetFile(s3.open_input_file(fl[0].path),buffer_size=8<<20); md=pf.metadata
print(md.num_row_groups, md.num_rows)
rg0=md.row_group(0); print({rg0.column(j).path_in_schema:rg0.column(j).total_compressed_size>>20 for j in range(rg0.num_columns)})
n=a=0
for rg in range(md.num_row_groups):
    t=pf.read_row_group(rg,columns=['min_lon','max_lon','min_lat','max_lat'])
    m=pc.and_(pc.and_(pc.less(t['min_lon'],E),pc.greater(t['max_lon'],W)),pc.and_(pc.less(t['min_lat'],N),pc.greater(t['max_lat'],S)))
    k=pc.sum(m).as_py()
    if k:
        for r in pf.read_row_group(rg,columns=['tags']).filter(m).to_pylist():
            tg=dict(r['tags'] or []); n+=1
            if 'addr:housenumber' in tg: a+=1; print(tg.get('addr:street'),tg.get('addr:housenumber'))
print('ways in bbox',n,'with housenumber',a,'t',round(time.time()-t0))
