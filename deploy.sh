#!/usr/bin/env bash

# build
# docker build -t lighthouse-service:test .
NODE_ENV=production npm run build

# tag
docker tag lighthouse-service:test 282898975672.dkr.ecr.us-east-1.amazonaws.com/lighthouse-test:latest

# push
docker push 282898975672.dkr.ecr.us-east-1.amazonaws.com/lighthouse-test:latest

# TODO: update lambda after image push