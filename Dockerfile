FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements/base.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/
COPY services/ ./services/
COPY dev_utils/ ./dev_utils/

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "10000"]