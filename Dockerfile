FROM node:0.10.40
RUN apt-get update && apt-get install -y \
    libasound2-dev
EXPOSE 9000