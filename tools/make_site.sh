#!/bin/sh
# Builds the standalone copy that GitHub Pages serves from docs/.
# lahall.html is a page fragment (the form Claude artifacts use); this wraps it into a full document.
cd "$(dirname "$0")/.." || exit 1
mkdir -p docs
{
  printf '%s\n' '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{height:100%}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style></head><body>'
  cat lahall.html
  printf '%s\n' '</body></html>'
} > docs/index.html
cp world.json docs/world.json
: > docs/.nojekyll
echo "docs/ rebuilt: $(wc -c < docs/index.html) bytes of page, $(wc -c < docs/world.json) bytes of world data"
