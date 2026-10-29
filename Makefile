# Dome contracts. `build` needs stellar-cli v25.2+, `bindings` also needs
# Node 22.12+; the rest only need Rust.

WASM := target/wasm32v1-none/release/dome_registry.wasm

.PHONY: all build test test-wasm fmt lint audit bindings check-bindings clean

all: lint test

build:
	stellar contract build

test:
	cargo test --workspace

# Also runs the tests that need the built Wasm: upgrade, resource budgets
# and the Wasm size limit (docs/resources.md).
test-wasm: build
	DOME_REGISTRY_WASM=$(CURDIR)/$(WASM) cargo test --workspace

fmt:
	cargo fmt --all

lint:
	cargo fmt --all -- --check
	cargo clippy --workspace --all-targets -- -D warnings

# Needs cargo-audit; ignored advisories are explained in .cargo/audit.toml.
audit:
	cargo audit

bindings: build
	./scripts/bindings.sh

check-# Needs cargo-audit; ignored advisories are explained in .cargo/audit.toml.
audit:
	cargo audit

bindings: build
	./scripts/bindings.sh --check

clean:
	cargo clean
