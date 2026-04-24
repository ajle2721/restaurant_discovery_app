set shell := ["bash", "-cu"]

port := "8080"

default:
  @just --list

serve:
  live-server --port={{port}} --host=0.0.0.0 .

serve-open:
  live-server --port={{port}} --host=0.0.0.0 --open .
