FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod main.go ./
RUN CGO_ENABLED=0 go build -o /shop-server .
FROM alpine:3.23
WORKDIR /app
COPY --from=build /shop-server ./shop-server
COPY site ./site
ENV HOST=0.0.0.0 PORT=8000
EXPOSE 8000
USER 65532:65532
ENTRYPOINT ["./shop-server"]
