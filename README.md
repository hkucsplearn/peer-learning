# Credit
This project is based on the release 1.0.117 of Requarks/wiki-v1 (https://github.com/Requarks/wiki-v1)

Documentation: https://docs-legacy.requarks.io/

# Requirements
1. Ubuntu 16.04
2. Node.js v8.10.0
3. Yarn 1.16.0
4. MongoDB running on localhost port 27017

# Build the server

`yarn`

`yarn run build`

# Configure the server

`cp ./config.localhost.yml ./config.yml`

`yarn run config`

(skip the Git Repository configuration and don't press "start" at the end)

# Run the server

`sudo yarn start`

(pm2 is used as process manager, see http://pm2.keymetrics.io/)

# Stop the server

`sudo yarn stop`

# Run the server in development mode

`sudo yarn run dev`

# Nginx Reserve Proxy (optional)

`sudo apt update`

`sudo apt install nginx`

`cp -f ./nginx.proxy.conf /etc/nginx/sites-available/default`

`sudo nginx -t`

`sudo systemctl enable nginx`

`sudo systemctl restart nginx`
