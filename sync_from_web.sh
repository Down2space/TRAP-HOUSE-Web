#!/bin/bash
# Copies the current web game into the Android app and makes it fully offline (local three.js + fonts).
set -e
SRC=/home/claude/traphouse; W=/home/claude/thapk/app/src/main/assets/www
rm -rf $W/js $W/models $W/sfx $W/tex $W/img
cp -r $SRC/js $SRC/models $SRC/sfx $SRC/tex $SRC/img $W/
cp $SRC/index.html $W/index.html
rm -f $W/models/*.json   # Tim and Dylan ship inside models/tim.js and models/dylan.js
mkdir -p $W/js/vendor && cp /home/claude/vendor3/three.min.js $W/js/vendor/three.min.js
python3 - "$W/index.html" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace('<link rel="preconnect" href="https://fonts.googleapis.com">\n','').replace('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n','')
s=s.replace('<link href="https://fonts.googleapis.com/css2?family=Rubik+Dirt&family=Barlow+Condensed:wght@500;600;700;800&family=Special+Elite&family=Permanent+Marker&display=swap" rel="stylesheet">','<link href="fonts/fonts.css" rel="stylesheet">')
s=s.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>','<script src="js/vendor/three.min.js"></script>')
assert 'googleapis' not in s and 'cdnjs' not in s, 'external link left in index.html'
open(p,'w').write(s)
PY
md5sum $W/js/hands.js
