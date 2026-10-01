FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /tourism-api ./cmd/api

FROM alpine:3.21
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /tourism-api /tourism-api
EXPOSE 8080
ENTRYPOINT ["/tourism-api"]

