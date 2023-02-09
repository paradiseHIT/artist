#!/bin/bash
set -x
WORK_DIR=`dirname $(readlink -f $0)`
echo $WORK_DIR
git pull
sudo cp $WORK_DIR/* -R /usr/share/nginx/html/artist/
sudo chown -R nginx:nginx /usr/share/nginx/html/artist/
