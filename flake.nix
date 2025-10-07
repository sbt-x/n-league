{
  description = "Node.js v24 + npm";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        nodejs = pkgs.nodejs_24;
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            nodejs
          ];

          shellHook = ''
            echo "Node.js: $(node --version)"
            echo "npm: $(npm --version)"
          '';
        };
      });
}
