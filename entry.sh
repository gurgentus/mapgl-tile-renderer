#!/bin/sh

# Start Xvfb
echo "Starting Xvfb"
Xvfb ${DISPLAY} -screen 0 "1024x768x24" -ac +extension GLX +render -noreset  -nolisten tcp  &
Xvfb_pid="$!"
echo "Waiting for Xvfb (PID: $Xvfb_pid) to be ready..."

timeout=10 # Timeout in seconds
start_time=$(date +%s)
while ! xdpyinfo -display ${DISPLAY} > /dev/null 2>&1; do
    sleep 0.1
    now=$(date +%s)
    if [ $(($now - $start_time)) -ge $timeout ]; then
        echo "Xvfb server didn't start within the timeout period. Exiting..."
        exit 1
    fi
done
echo "Xvfb is running"

# To run the Docker container as an Azure queue service, set the QUEUE_NAME env var
# if [ -n "$QUEUE_NAME" ]; then
#     # Run the Azure queue service
#     node src/azure_queue_service.js
# else
#     # Default to the CLI API
#     node src/cli.js "$@"
# fi



if [ -z "${AWS_LAMBDA_RUNTIME_API}" ]; then
  exec /usr/bin/aws-lambda-rie npx aws-lambda-ric $1
else
  exec npx aws-lambda-ric $1
fi