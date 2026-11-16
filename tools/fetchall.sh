#!/bin/sh
B=18.037,59.406,18.111,59.442
f() { python3 fetch.py "$1" "$2" ../data2/$3.json $B "$4" > ../data2/$3.log 2>&1; echo "$3 exit $?"; }
f transportation segment segment names,subtype,class,subclass,road_surface,road_flags,rail_flags &
f buildings building building names,height,num_floors,subtype,class,facade_color,roof_shape,roof_color,has_parts &
f base land_use land_use names,subtype,class &
f base water water names,subtype,class &
wait
f base land_cover land_cover subtype &
f base land land names,subtype,class,elevation &
f base infrastructure infra names,subtype,class &
f places place place2 confidence,addresses,names,basic_category &
wait
echo ALLDONE
