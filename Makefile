.PHONY: all
all:
	wasm-pack build --target web

start_http:
	python3 -m http.server 3000

