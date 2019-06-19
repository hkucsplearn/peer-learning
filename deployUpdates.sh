#!/bin/bash
sudo yarn --cwd /home/ubuntu/peer-learning stop
git -C /home/ubuntu/peer-learning pull
sudo rm -rf /home/ubuntu/peer-learning/data /home/ubuntu/peer-learning/repo
sudo yarn --cwd /home/ubuntu/peer-learning run build
sudo yarn --cwd /home/ubuntu/peer-learning start
