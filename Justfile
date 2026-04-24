set shell := ["bash", "-cu"]

port := "8080"

default:
  @just --list

build:
  node build-ai-review-index.mjs

serve:
  live-server --port={{port}} --host=0.0.0.0 .

serve-open:
  live-server --port={{port}} --host=0.0.0.0 --open .
