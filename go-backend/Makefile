.PHONY: build run test clean deps lint migrate

# Build variables
BINARY_NAME=growvest-api
BUILD_DIR=./bin
MAIN_PATH=./cmd/api

# Go variables
GOFLAGS=-ldflags="-s -w"

## help: Show this help message
help:
	@echo "Growvest Stock Screener - Backend"
	@echo ""
	@echo "Usage:"
	@echo "  make <target>"
	@echo ""
	@echo "Targets:"
	@awk '/^[a-zA-Z\-\_0-9]+:/ { \
		helpMessage = match(lastLine, /^## (.*)/); \
		if (helpMessage) { \
			helpCommand = substr($$1, 0, index($$1, ":")-1); \
			helpMessage = substr(lastLine, RSTART + 3, RLENGTH); \
			printf "  %-20s %s\n", helpCommand, helpMessage; \
		} \
	} \
	{ lastLine = $$0 }' $(MAKEFILE_LIST)

## deps: Download dependencies
deps:
	go mod download
	go mod tidy

## build: Build the application
build:
	@mkdir -p $(BUILD_DIR)
	go build $(GOFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) $(MAIN_PATH)

## run: Run the application
run:
	go run $(MAIN_PATH)/main.go

## dev: Run with hot reload (requires air)
dev:
	air

## test: Run tests
test:
	go test -v -race -cover ./...

## test-coverage: Run tests with coverage report
test-coverage:
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

## lint: Run linter (requires golangci-lint)
lint:
	golangci-lint run

## clean: Clean build artifacts
clean:
	rm -rf $(BUILD_DIR)
	rm -f coverage.out coverage.html

## docker-build: Build Docker image
docker-build:
	docker build -t growvest-api:latest .

## docker-run: Run Docker container
docker-run:
	docker run -p 8080:8080 --env-file .env growvest-api:latest

## migrate: Run database migrations
migrate:
	go run $(MAIN_PATH)/main.go migrate

## seed: Seed database with initial data
seed:
	go run $(MAIN_PATH)/main.go seed

