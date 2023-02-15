#!/bin/bash
###
 # @Author: xing paradisehit@gmail.com
 # @Date: 2023-02-10 00:13:37
 # @LastEditors: xing paradisehit@gmail.com
 # @LastEditTime: 2023-02-16 02:03:50
 # @FilePath: /web/deploy.sh
 # @Description: deploy on server
 # Copyright (c) 2023 by xing shi email: paradisehit@gmail.com, All Rights Reserved.
### 
set -x
WORK_DIR=`dirname $(readlink -f $0)`
echo $WORK_DIR
git pull
/usr/local/bin/uglifyjs js/sd.js -o js/sd.min.js -c -m
sudo cp $WORK_DIR/* -R /usr/share/nginx/html/artist/
#https://obfuscator.io/
sudo chown -R nginx:nginx /usr/share/nginx/html/artist/
