# Aster Protocol

Aster Protocol は、Aster Client、Aster Server、Bot が通信するときの契約を管理します。

REST API は OpenAPI、WebSocket Gateway は JSON Schema を正とし、TypeScript と Go の型を生成します。

> [!WARNING]
> このリポジトリは初期設計段階です。
> `0.x` の間は、互換性を保たない変更が入る可能性があります。

## 管理するもの

- REST API の OpenAPI Schema
- Gateway Command と Event の JSON Schema
- Client と Bot SDK が利用する TypeScript 型
- Server が利用する Go 型
- 配布用にまとめた Schema
- API の利用例とドキュメント

ドメインロジック、データベースモデル、UI コンポーネントはこのリポジトリへ置きません。

## 人間が読む OpenAPI

開発者が編集する正は、`protocol/openapi` 以下の分割 YAML です。
生成された単一ファイルを編集元にはしません。

```text
protocol/openapi/
├── openapi.yaml
├── paths/
│   └── system/
│       └── health.yaml
└── components/
    ├── headers/
    ├── responses/
    └── schemas/
        ├── common/
        └── system/
```

ファイルの役割は次の規則で揃えます。

- `openapi.yaml`：API 全体の情報、Version、Tag、Path と共通 Component の索引
- `paths/<domain>/<resource>.yaml`：Resource に対する HTTP Operation
- `components/schemas/<domain>/<Name>.yaml`：Request、Response、共通データの構造
- `components/responses/<Name>.yaml`：複数 Operation で共有する HTTP Response
- `components/headers/<Name>.yaml`：複数 Response で共有する HTTP Header

各 Operation には、処理を区別できる `operationId`、一行の `summary`、必要な場合は判断条件を記した `description` を置きます。
Request と Response には、利用者が値の意味を判断できる例を付けます。

`generated/openapi.yaml` は、外部ツールと Release で使う Bundle です。
編集後は `pnpm generate` で更新します。

## Gateway Schema

Gateway は JSON Schema Draft 2020-12 を使用します。
接続制御を `protocol/gateway/lifecycle`、共有データを `protocol/gateway/common` に配置します。

Gateway Message は `op` で処理種別を判定します。
Dispatch Event は `t` に Event 名、`s` に Sequence、`d` に Payload を持ちます。

初期 Schema は接続 Lifecycle の次の Message を定義します。

- `HELLO`
- `IDENTIFY`
- `READY`
- `HEARTBEAT`
- `HEARTBEAT_ACK`
- `RESUME`
- `RESUMED`
- `INVALID_SESSION`

## 開発コマンド

Node.js 22.12 以降、pnpm 11 以降、Go 1.25 以降を使用します。

```bash
pnpm install
pnpm check
```

個別の処理も実行できます。

```bash
pnpm lint:openapi
pnpm validate:gateway
pnpm generate
pnpm typecheck
```

`pnpm check` は Schema の検証、生成、型検査、Go Test を順に実行します。

## 生成物

生成物は Pull Request で Schema の影響を確認できるように Git へ含めます。
生成ファイルを直接編集せず、対応する OpenAPI または JSON Schema を変更してください。

| 生成物 | 入力 |
| --- | --- |
| `generated/openapi.yaml` | 分割された OpenAPI YAML |
| `packages/protocol-ts/src/generated/openapi.ts` | 分割された OpenAPI YAML |
| `packages/protocol-ts/src/generated/gateway.ts` | Gateway JSON Schema |
| `packages/protocol-go/generated/types.gen.go` | OpenAPI Bundle |

## バージョニング

Release は SemVer を使用します。
Protocol、生成型、SDK は同じ Release Tag に対応させます。

- 任意フィールドまたは Event の追加：Minor
- 説明や制約を変えない訂正：Patch
- 必須フィールドの追加、削除、型変更：Major

`0.x` の間も破壊的変更を Changelog へ記録します。

変更手順と記述規則は [CONTRIBUTING.md](CONTRIBUTING.md)、利用者に影響する変更は [CHANGELOG.md](CHANGELOG.md) に記載します。

## ライセンス

Aster Protocol は [Apache License 2.0](LICENSE) の下で公開されています。
