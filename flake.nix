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

        bashInteractive = pkgs.bashInteractive;
        nodejs = pkgs.nodejs_24;
        prisma-engines = pkgs.prisma-engines;
      in {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = [
            bashInteractive
          ];

          buildInputs = [
            nodejs
            prisma-engines
            pkgs.openssl
            pkgs.pkg-config
          ];

          shellHook = ''
            export PRISMA_MIGRATION_ENGINE_BINARY="${prisma-engines}/bin/migration-engine"
            export PRISMA_QUERY_ENGINE_BINARY="${prisma-engines}/bin/query-engine"
            export PRISMA_QUERY_ENGINE_LIBRARY="${prisma-engines}/lib/libquery_engine.node"
            export PRISMA_INTROSPECTION_ENGINE_BINARY="${prisma-engines}/bin/introspection-engine"
            export PRISMA_FMT_BINARY="${prisma-engines}/bin/prisma-fmt"
            echo "Node.js: $(node --version)"
            echo "npm: $(npm --version)"
          '';

          packages = [
            (pkgs.writeShellScriptBin "db-start" ''
              set -euo pipefail
              PGDATA="$PWD/api/postgres"
              SOCKET_DIR="$PGDATA/socket"
              mkdir -p "$SOCKET_DIR"
              pg_ctl -D "$PGDATA" -l "$PGDATA/logfile" start -o "-h 127.0.0.1 -k $SOCKET_DIR"
              # createuser -s postgres -h 127.0.0.1
            '')
          ];
        };
      });
}
