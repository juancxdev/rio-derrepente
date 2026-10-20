FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /tourism-api ./cmd/api
RUN CGO_ENABLED=0 go build -o /tourism-worker ./cmd/worker
RUN CGO_ENABLED=0 go build -o /adminctl ./cmd/adminctl

FROM alpine:3.21
RUN apk add --no-cache tzdata && adduser -D -u 10001 appuser
USER appuser
COPY --from=build /tourism-api /tourism-api
COPY --from=build /tourism-worker /tourism-worker
COPY --from=build /adminctl /adminctl
EXPOSE 8080
ENTRYPOINT ["/tourism-api"]
