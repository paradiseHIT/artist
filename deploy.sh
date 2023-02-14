#!/bin/bash
###
 # @Author: xing paradisehit@gmail.com
 # @Date: 2023-02-10 00:13:37
 # @LastEditors: xing paradisehit@gmail.com
 # @LastEditTime: 2023-02-14 23:13:48
 # @FilePath: /web/deploy.sh
 # @Description: deploy on server
 # Copyright (c) 2023 by xing shi email: paradisehit@gmail.com, All Rights Reserved.
### 
set -x
WORK_DIR=`dirname $(readlink -f $0)`
echo $WORK_DIR
git pull
sudo cp $WORK_DIR/* -R /usr/share/nginx/html/artist/
sudo cp /usr/share/nginx/html/artist/sde.js /usr/share/nginx/html/artist/sd.js 
sudo chown -R nginx:nginx /usr/share/nginx/html/artist/
