# Lahäll Walkabout

Explorable 3D model of Lahäll (Täby, Sweden): real terrain, buildings, streets, traffic, people, street furniture.

- `lahall.html` + `world.json` — the published page (fragment; needs three.js r128 from cdnjs). Earlier versions are in `versions/`.
- `tools/build.py` — builds `world.json` from `data/` (run from `tools/`: `python3 build.py`). Needs shapely, numpy.
- `tools/fetch.py` — Overture Maps fetch (S3, pyarrow). `tools/dem.py` — terrain tiles. `tools/addr.py` — Daylight OSM address scan (the `way` scan takes ~80 min; results are in `data/addr_way.jsonl`).
- `tools/shot*.js` — Playwright checks (need `npm i three@0.128.0 playwright`; serve a wrapped copy of the page from `test/`).
- `tools/bsec.js`, `traffic.js`, `furn.js` — source snippets already merged into `lahall.html`.

Data: © OpenStreetMap contributors via Overture Maps / Daylight; elevation from Mapzen terrain tiles.

## Larger area (3.8 x 3.4 km)
Source data for the larger extent is in `data2/`. Rebuild with:
`cd tools && LX=1900 LZ=1700 LD=../data2/ python3 build.py` (terrain: same variables with `dem.py`; fetch: `fetchall.sh`; addresses: `addr2.py node 3`, `addr2.py way 6`).
`world.small.json` is the last world file for the original 2.1 x 2.3 km extent.

## Standalone copy (GitHub Pages)
`docs/` holds a self-contained copy of the page (`index.html` + `world.json`) for GitHub Pages:
Settings → Pages → Source "Deploy from a branch", branch `main`, folder `/docs`.
After changing `lahall.html` or `world.json`, run `tools/make_site.sh` and commit `docs/`.
Unlike the Claude artifact, this copy can reach the Open-Meteo weather service, so the Live button also syncs the weather.

## Route planner
The Route button plans a trip between two addresses, streets or places, on foot, by car, by bike, or by train with walking at each end, and can play the trip back. Routing runs in the browser on the same road graph the traffic uses. Car trips to the Enebyberg/Ekeby corner in the south-west fail by design: those streets only connect to the rest by roads outside the mapped area.
