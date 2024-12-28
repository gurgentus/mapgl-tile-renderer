FROM buildpack-deps:jammy

ARG LAMBDA_TASK_ROOT="/app"
ARG LAMBDA_RUNTIME_DIR="/usr/local/bin"

RUN groupadd --gid 1000 node; \
  useradd --uid 1000 --gid node --shell /bin/bash --create-home node

# node
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION v20.13.0
RUN mkdir -p /usr/local/nvm && apt-get update && echo "y" | apt-get install curl
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
RUN /bin/bash -c "source $NVM_DIR/nvm.sh && nvm install $NODE_VERSION && nvm use --delete-prefix $NODE_VERSION"
ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/bin
ENV PATH $NODE_PATH:$PATH

WORKDIR /app

RUN apt-get update; \
  apt-get install -y \
  libcurl4-openssl-dev \
  libglfw3-dev \
  libuv1-dev \
  libpng-dev \
  libicu-dev \
  libjpeg-turbo8-dev \
  libwebp-dev \
  xvfb \
  x11-utils \
  clang \
  git \
  cmake \
  ccache \
  ninja-build \
  pkg-config \
  curl \
  && rm -rf /var/lib/apt/lists/*
  
RUN npm install aws-lambda-ric -g

# Copy function code
COPY ./app/ ${LAMBDA_TASK_ROOT}/
COPY ./src/* ${LAMBDA_TASK_ROOT}/
RUN npm install 


# Prevent this warn
# npm WARN logfile Error: ENOENT: no such file or directory, scandir '/home/sbx_user1051/.npm/_logs'
# https://stackoverflow.com/a/73394694/3957754
RUN mkdir -p /tmp/.npm/_logs
ENV npm_config_cache /tmp/.npm

# (Optional) Add Lambda Runtime Interface Emulator and use a script in the ENTRYPOINT for simpler local runs
WORKDIR ${LAMBDA_TASK_ROOT}
ADD "https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie" "/usr/bin/aws-lambda-rie"
COPY entry.sh /
RUN chmod 755 "/usr/bin/aws-lambda-rie" "/entry.sh"

ENV DISPLAY=:99.0

# Start Xvfb in the background
RUN start-stop-daemon --start --pidfile /tmp/xvfb.pid --make-pidfile --background --exec /usr/bin/Xvfb -- :99 -screen 0 1024x768x24 -ac +extension GLX +render -noreset

ENTRYPOINT [ "/entry.sh" ]
CMD [ "app.handler" ]