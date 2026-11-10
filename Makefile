.PHONY: run pack docker-build docker-run

run:
	go run .

pack:
	go run . --pack

docker-build:
	docker build -t shop-go .

docker-run:
	docker run --rm -p 127.0.0.1:8000:8000 shop-go
