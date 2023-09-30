
install:
	npm install

dev:
	npm run dev

preview: build
	npm run preview

build:
	npm run build

clean:
	rm -rf node_modules
	rm -rf dist