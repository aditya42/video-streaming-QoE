FROM node:22-alpine AS shaka-vendor
WORKDIR /vendor
COPY package.json ./
RUN npm install --ignore-scripts
RUN cp node_modules/shaka-player/dist/shaka-player.compiled.js /shaka-player.compiled.js

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend ./backend
COPY web ./web
COPY --from=shaka-vendor /shaka-player.compiled.js ./web/vendor/shaka-player.compiled.js
RUN mkdir -p /data
ENV QOE_DB_PATH=/data/qoe.db
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
