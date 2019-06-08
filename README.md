# Credit
This project is based on the release 1.0.117 of Requarks/wiki-v1 (https://github.com/Requarks/wiki-v1)

Documentation: https://docs-legacy.requarks.io/

# Requirements (tested on those versions)
1. Ubuntu 16.04 / Ubuntu 18.04 / MacOs v10.13.6
2. Node.js v8.10.x
3. Yarn 1.16.x
4. MongoDB v4.0.x running on localhost port 27017

# Build the server

`yarn`

`yarn run build`

# Configure the server

`cp ./config.localhost.yml ./config.yml`

`yarn run config`

Click "SKIP THIS STEP" in "Git Repository" section, don't press "Start" at the end, simply close the browser tab.

After configured, stop the process, and the server is now ready to be started.

# Run the server in development mode

`sudo yarn run dev`

# Run the server

`sudo yarn start`

(pm2 is used as process manager, see http://pm2.keymetrics.io/)

# Stop the server

`sudo yarn stop`

# Nginx Reserve Proxy (optional)

`sudo apt update`

`sudo apt install nginx`

`cp -f ./nginx.proxy.conf /etc/nginx/sites-available/default`

`sudo nginx -t`

`sudo systemctl enable nginx`

`sudo systemctl restart nginx`
