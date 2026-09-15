.PHONY: install backend test test-python docker clean

install:
	python -m pip install -r backend/requirements.txt
	npm install
	npx playwright install chromium

backend:
	python -m uvicorn backend.app.main:app --reload --port 8000

test-python:
	python -m unittest discover -s backend/tests -v

test:
	npm test

docker:
	docker compose up --build

clean:
	rm -rf data test-results playwright-report node_modules web/vendor/shaka-player.compiled.js
