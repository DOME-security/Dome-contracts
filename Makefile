# Dome contracts. `build` and `bindings` need stellar-cli v25.2+; the
# rest only need Rust.

WASM := target/wasm32v1-none/release/dome_registry.wasm

.PHONY: all build test test-wasm fmt lint bindings check-bindings clean

all: lint test

build:
	stellar contract build

test:
	cargo test --workspace

# Also runs the upgrade test, which needs the built Wasm.
test-wasm: build
	DOME_REGISTRY_WASM=$(CURDIR)/$(WASM) cargo test --workspace

fmt:
	cargo fmt --all

lint:
	cargo fmt --all -- --check
	cargo clippy --workspace --all-targets -- -D warnings

bindings: build
	./scripts/bindings.sh

check-bindings: build
	./scripts/bindings.sh --check

clean:
	cargo clean
