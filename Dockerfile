FROM public.ecr.aws/lambda/nodejs:18

ENV NODE_PATH=/var/lang/lib/node_modules

# TODO: use versions from package.json
RUN npm i -g lighthouse@10.1.0 @sparticuz/chromium@112.0.2

COPY package*.json ${LAMBDA_TASK_ROOT}
COPY dist/main/index.js ${LAMBDA_TASK_ROOT}/dist/main/


CMD [ "dist/main/index.main" ]