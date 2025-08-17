
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app files
COPY app.py .
COPY .env .
COPY templates/ ./templates/
COPY static/ ./static/

# Expose the port
EXPOSE 8989

# Command to run the app
CMD ["python", "app.py"]
