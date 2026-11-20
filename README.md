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

## Laser data (Lantmäteriet)
Terrain, building heights, roof shapes and trees come from Lantmäteriet's open laser scans (product "Laserdata Nedladdning, skog", CC BY 4.0, scanned 2021).
- Tile list: STAC API `https://api.lantmateriet.se/stac-hojd/v1`, collection `dsm-skoglig-copc`; the files on `dl1.lantmateriet.se` need a free Geotorget login (HTTP basic auth).
- `tools/laser_grid.py <dir with .laz> data2/laser.npz` rasterises the point clouds onto the model's grid (needs `laspy`, `lazrs`, `scipy`).
- `build.py` uses `data2/laser.npz` when it is there; without it, heights, roofs and trees fall back to estimates. The .laz tiles (about 1 GB) and `laser.npz` (69 MB) are not in the repository.

## Timetables
The train and the buses run by the real clock, so every viewer sees them in the same place.
- Train: Roslagsbanan's Näsbypark branch on a fixed 12-minute pattern. The pattern is invented; the track and stops are real.
- Buses: the 58 mapped stops are real, with their real names. The four lines (A–D) joining them are invented, because real routes are not in the open map: each is the driving route between two far-apart stops, calling at every stop it passes, with a bus about every ten minutes.
The route planner uses these timetables for departure, wait and arrival times. It plans one ride with a walk at each end; it does not change between lines.
