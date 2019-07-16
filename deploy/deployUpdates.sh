#!/bin/bash
sudo yarn --cwd /home/ubuntu/peer-learning stop
ssh-agent bash -c 'ssh-add /home/ubuntu/.ssh/id_rsa; git -C /home/ubuntu/peer-learning pull'
ssh-agent bash -c 'ssh-add /home/ubuntu/.ssh/id_rsa; git -C /home/ubuntu/peer-learning/repo stash'
sudo yarn --cwd /home/ubuntu/peer-learning
sudo yarn --cwd /home/ubuntu/peer-learning run build
sudo yarn --cwd /home/ubuntu/peer-learning start
