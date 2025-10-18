# n-league

## ディレクトリ構成

- `api/`
  - API サーバーのコード
- `ui/`
  - React で作成した UI のコード

## Nix 用

- `.envrc`
  - ディレクトリ移動時に`flake`を実行するためのスクリプト
- `flake.nix`
  - `prisma`, `node.js`をインストールするスクリプト
