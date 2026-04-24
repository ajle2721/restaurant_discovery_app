{
  description = "Development shell for the restaurant discovery app";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        pythonEnv = pkgs.python312.withPackages (ps: with ps; [
          requests
          python-dotenv
          pandas
          python-dateutil
        ]);
      in {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
            pkgs.live-server
            pythonEnv
            pkgs.git
            pkgs.jq
            pkgs.just
            pkgs.ripgrep
          ];

          shellHook = ''
            echo "Dev shell ready."
            echo "Available tools: just, live-server, node, npm, python, rg, jq"
          '';
        };
      });
}
