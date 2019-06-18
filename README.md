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

`cp ./config.server.yml ./config.yml` (the server only recognizes config.yml)

`yarn run config` (run config to test the settings and create admin user)

A local git Repository is used to to store the articles content and change history. The configuration will ask you to specify a remote git repository, which the local git repo will sync with, and information to access the remote git repo, but you can skip this part to use local git repository only. Related information: [Connecting to GitHub with SSH](https://help.github.com/en/articles/connecting-to-github-with-ssh)


# Run the server in development mode

`sudo yarn run dev`

# Run the server in production mode

`sudo yarn start`

(pm2 is used as process manager, see http://pm2.keymetrics.io/)

# Stop the server from production mode

`sudo yarn stop`

# Remark

## icon
`i.nc-icon-outline.business_hierarchy-55`
* an icon with id `business_hierarchy-55` which can be found here: [list of icons](https://www.sindicalistasdebase.es/assets/css/icons/demo-glyph.html)
