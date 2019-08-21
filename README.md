
# Screenshot

<img src="https://raw.githubusercontent.com/hkucsplearn/peer-learning/master/assets/demo/1.jpg" width="240"><img src="https://raw.githubusercontent.com/hkucsplearn/peer-learning/master/assets/demo/2.jpg" width="480">

<img src="https://raw.githubusercontent.com/hkucsplearn/peer-learning/master/assets/demo/3.jpg" width="480"><img src="https://raw.githubusercontent.com/hkucsplearn/peer-learning/master/assets/demo/4.jpg" width="240">

# Credit

This project is based on the release 1.0.117 of [Requarks/wiki-v1](https://github.com/Requarks/wiki-v1)

Documentation: https://docs-legacy.requarks.io/

# Requirements (tested on those versions)

1. Ubuntu 16.04 / Ubuntu 18.04 / MacOs v10.13.6 / Windows 10
2. Node.js 8.16.0
3. Yarn 1.16
4. MongoDB v4.0.x running on localhost port 27017

# Build from source code

`yarn`

`yarn run build`

# Configuration

`cp ./deploy/config.server.yml ./config.yml` (the server only recognizes config.yml)

`yarn run dev-configure` (run config to test the settings and create admin user)

`(Stop the process after finished)`

A local git Repository is used to to store the articles content and change history. The configuration will ask you to specify a remote git repository, which the local git repo will sync with, and information to access the remote git repo, **but you can skip this part to use local git repository only**. Related information: [Connecting to GitHub with SSH](https://help.github.com/en/articles/connecting-to-github-with-ssh)


# For Development

## Run the server in development mode

`sudo yarn run dev`

## Icon Remarks

`i.nc-icon-outline.business_hierarchy-55`

* an icon with id `business_hierarchy-55` which can be found here: [list of icons](https://www.sindicalistasdebase.es/assets/css/icons/demo-glyph.html)

# For Production

## Run and stop the server in production mode

`sudo yarn start`

`sudo yarn stop`

## Deploy updates to AWS EC2 server

```
ssh -i \path\to\ssh\key ubuntu@peerlearning.cs.hku.hk
(cd to local repository)
sudo bash ./deploy/deployUpdates.sh
```

## Set up reverse proxy and certbot for HTTPS traffic

The web application itself does not provide HTTPS traffic, thus, Nginx is used as a reverse proxy to enableHTTPS.

Install and configure the nginx reverse proxy:

```
sudo apt update
sudo apt install nginx
sudo cp -f ./deploy/nginx.conf /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

Install certbot to obtain SSL certificate automatically:

```
sudo apt-get install software-properties-common
sudo apt-get install python-certbot-nginx
sudo certbot --nginx -d peerlearning.cs.hku.hk
sudo cp -f ./deploy/nginx.conf /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl restart nginx
sudo crontab -e
(paste "0 1 * * * /usr/bin/certbot renew --quiet" to the editor and save)
```
