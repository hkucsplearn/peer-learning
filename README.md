# Credit
This project is based on the release 1.0.117 of Requarks/wiki-v1 (https://github.com/Requarks/wiki-v1)

Developer Guide: https://docs.requarks.io/wiki/developers/developer-guide

# Requirements
1. Ubuntu 16.04
2. Node.js v8.10.0
* `# assume using ubuntu`
* `curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -`
* `sudo apt-get install -y nodejs`
3. Yarn 1.16.0
4. MongoDB running on localhost port 27017

# create config.yml

`cp ./config.localhost.yml ./config.yml`

# Run the server

`yarn`

`yarn run build`

`sudo yarn run dev`

# Nginx Reserve Proxy (optional)

`sudo apt update`

`sudo apt install nginx`

`cp -f ./nginx.proxy.conf /etc/nginx/sites-available/default`

`sudo nginx -t`

`sudo systemctl enable nginx`

`sudo systemctl restart nginx`
