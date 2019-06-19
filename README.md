# Credit
This project is based on the release 1.0.117 of Requarks/wiki-v1 (https://github.com/Requarks/wiki-v1)

Documentation: https://docs-legacy.requarks.io/

# Requirements (tested on those versions)
1. Ubuntu 16.04 / Ubuntu 18.04 / MacOs v10.13.6 / Windows 10
2. Node.js 8
3. Yarn 1.16
4. MongoDB v4.0.x running on localhost port 27017

# Build the server

`yarn`

`yarn run build`

# Configuring Server

`cp ./deploy/config.server.yml ./config.yml` (the server only recognizes config.yml)

`yarn run dev-configure` (run config to test the settings and create admin user)

`(Stop the process after finished)`

A local git Repository is used to to store the articles content and change history. The configuration will ask you to specify a remote git repository, which the local git repo will sync with, and information to access the remote git repo, but you can skip this part to use local git repository only. Related information: [Connecting to GitHub with SSH](https://help.github.com/en/articles/connecting-to-github-with-ssh)


# Run the server in development mode

`sudo yarn run dev`

# Run the server in production mode

`sudo yarn start`

(pm2 is used as process manager, see http://pm2.keymetrics.io/)

# Stop the server from production mode

`sudo yarn stop`

# Deploy update to server

```
(ssh to server and cd to local repository)
sudo bash ./deploy/deployUpdates.sh
```

# Set up reverse proxy and certbot for https access

```
(install and config nginx)
sudo apt update
sudo apt install nginx
sudo cp -f ./deploy/nginx.conf /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

(install and config certbot)
sudo add-apt-repository ppa:some/ppa
sudo apt-get update
sudo apt-get install python-certbot-nginx
sudo certbot --nginx -d coder.faith
(choose "redirect all traffic to https" option in the prompt)
sudo crontab -e
(paste "0 12 * * * /usr/bin/certbot renew --quiet" to the editor)
```

# Development Remarks

## icon
`i.nc-icon-outline.business_hierarchy-55`
* an icon with id `business_hierarchy-55` which can be found here: [list of icons](https://www.sindicalistasdebase.es/assets/css/icons/demo-glyph.html)
