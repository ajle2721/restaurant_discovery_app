set shell := ["bash", "-cu"]

port := "8000"

default:
  @just --list

install:
  npm install

# Use this on filesystems mounted with noexec (including this workstation's data volume).
install-tmp:
  rm -rf /tmp/restaurant-discovery-app-npm node_modules
  mkdir -p /tmp/restaurant-discovery-app-npm
  cp package.json package-lock.json /tmp/restaurant-discovery-app-npm/
  npm ci --prefix /tmp/restaurant-discovery-app-npm
  ln -s /tmp/restaurant-discovery-app-npm/node_modules node_modules

dev:
  npm run dev -- --host=0.0.0.0 --port={{port}}

build-data:
  npm run build:data

build:
  npm run build

verify-data:
  npm run verify:data

test:
  npm test

preview:
  npm run preview -- --host=0.0.0.0 --port={{port}}

clean:
  rm -rf dist

serve:
  npm run dev -- --host=0.0.0.0 --port={{port}}

serve-open:
  npm run dev -- --host=0.0.0.0 --port={{port}} --open
