# APIサーバー

## 前準備

- `api/.env`に以下のファイルを追加する

```
JWT_SECRET="your_jwt_secret_key"
DATABASE_URL="postgresql://nleague:secret@localhost:5432/nleague_dev?schema=public"
```

## ローカルでの起動方法

```sh
# api/ディレクトリに移動する
cd api

# (初回のみ)パッケージをインストールする
npm install

# データベースを起動する
docker compose -f docker-compose.postgres.yml up

# APIサーバーを起動する
npm run start:dev
```
