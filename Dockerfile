# Use the official Deno image from the Docker Hub
FROM denoland/deno:2.3.6


USER root

RUN apt-get update && \
    apt-get install -y wget gnupg ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxrandr2 xdg-utils --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*


# Set the working directory
WORKDIR /app

# Copy the project files to the working directory
COPY . .



# Regenerate the lockfile
RUN deno cache --reload --allow-scripts main.ts
# Expose the port that your Deno application will run on
EXPOSE 8100

# Run the Deno application

CMD ["run","start"]