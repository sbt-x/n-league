# UI

## 前準備

- `ui/.env`に以下のファイルを追加する

```
VITE_API_URL="http://localhost:3000"
VITE_WEBSOCKET_URL="ws://localhost:3000"
```

## ローカルでの起動方法

```sh
# ui/ディレクトリに移動する
cd api

# (初回のみ)パッケージをインストールする
npm install

# APIサーバーを起動する
npm run dev
```
