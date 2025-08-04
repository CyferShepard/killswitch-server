# Use the official Deno image from the Docker Hub
FROM denoland/deno:2.3.6


USER root

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