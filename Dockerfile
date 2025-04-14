# Use Python 3.9 as base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Upgrade pip
RUN pip install --upgrade pip

#Install proper UTF-8 ENG support
ENV LAN=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

RUN apt-get update && apt-get install -y locales && \
    locale-gen en_US.UTF-8 && \
    echo "LANG=en_US.UTF-8" > /etc/default/locale && \
    echo "LC_ALL=en_US.UTF-8" >> /etc/default/locale && \
    export LANG=en_US.UTF-8 && export LC_ALL=en_US.UTF-8

# Copy the rest of the application
COPY . .

# Install system dependencies, including wget and bash
RUN apt-get update && \
    apt-get install -y build-essential gcc cmake ffmpeg espeak libespeak-dev espeak-ng libespeak-ng1 libespeak-ng-dev git wget bash && \
    apt-get install -y python3-dev python3-pip python3-wheel pkg-config && \
    apt-get install -y libopus-dev libffi-dev && \
    rm -rf /var/lib/apt/lists/*
# Create necessary directories
RUN mkdir -p /app/static/audio

# Install setuptools using pip
RUN pip install setuptools
# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PORT=5000

# Install numpy first to avoid binary incompatibility issues
RUN pip install numpy==1.25.0

# Install aeneas
RUN pip install aeneas==1.7.3

# Copy the current directory contents into the container at /app
COPY . /app

# Install other Python packages specified in requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Make port 8080 available to the world outside this container
EXPOSE 5000

# Command to run the application
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]