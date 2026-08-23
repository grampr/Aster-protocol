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
│   ├── auth/
│   ├── channels/
│   ├── guilds/
│   ├── messages/
│   ├── users/
│   └── system/
└── components/
    ├── headers/
    ├── responses/
    └── schemas/
        ├── auth/
        ├── channels/
        ├── common/
        ├── guilds/
        ├── messages/
        ├── users/
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

## 認証と Session

Password 認証と将来の外部認証は、どちらも Aster Server が発行する同じ `SessionTokenResponse` に合流します。
Client が API に渡すのは Aster Access Token であり、Google の ID Token、Access Token、Refresh Token ではありません。

初期契約は次の Operation を定義します。

- `POST /auth/password/register`：Password Account と Session を作成する
- `POST /auth/password/login`：Password で Session を作成する
- `POST /auth/token/refresh`：Refresh Token を Rotation する
- `POST /auth/logout`：現在の Session を破棄する
- `GET /users/@me`：自分の Account と Link 済み認証方法を取得する

Refresh Token は使用のたびに交換し、使用済み Token を無効にします。
Desktop Client は Access Token を Memory、Refresh Token を OS の Secure Storage に保存する想定です。

Google Login は OpenID Connect の Authorization Code Flow と PKCE `S256` を使います。
Server は `state`、`nonce`、Issuer、Audience、署名を検証し、Google 側の Token を Client へ公開せず、短時間かつ一度だけ使える Aster Exchange Code に変換します。
外部 Identity は Email Address だけでなく、Provider と Provider Subject の組で識別します。

Desktop Login は次の3段階です。

1. `POST /auth/google/authorize` でPKCE ChallengeとClient Stateを登録し、Google Authorization URLを取得する。
2. `GET /auth/google/callback` でServerがGoogleの応答を検証し、`aster://auth/callback`へAster Exchange Codeを返す。
3. `POST /auth/google/exchange` でExchange CodeとPKCE VerifierをAster Session Tokenへ交換する。

Desktop Redirect URIは`aster://auth/callback`に固定します。
CallbackのDeep LinkにはGoogleのTokenを含めません。

この境界の判断理由と将来追加する Flow は [ADR-0001](docs/decisions/0001-provider-neutral-authentication.md) に記録しています。

## Guild、Channel、Message

初期のChat Resourceは、GuildをCommunityの境界、Channelを会話の置き場所、MessageをText Channel内の投稿として分離します。
Channel Typeは`TEXT`と`VOICE`から始め、Category、DM、Threadは専用の表示規則と権限境界を定義してから追加します。

REST APIは、Guild、Channel、Messageの現在の永続状態と明示的な変更を担当します。
新規Messageや更新・削除のリアルタイム通知は、後続のGateway Event契約で定義します。

Message一覧は新しい順で返し、`next_cursor`で過去へ遡ります。
Message本文は1〜4000文字とし、初期契約では添付ファイルだけのMessageを扱いません。
添付ファイルResourceを定義するときに、本文が空のMessageを許可する条件も同時に追加します。

返信は`CreateMessageRequest.reply_to_message_id`で同じText Channel内のMessageを指定します。
Responseの`reply_to`は返信表示に必要な軽量参照で、再帰的な返信構造を持ちません。
返信元が削除済みまたは参照不能になった場合も`reply_to_message_id`は保持し、`reply_to`を`null`にすることでClientが「返信元を表示できない」状態を区別できます。

ReactionはUnicode絵文字を単位として集計し、Messageの`reactions`に件数と認証済みUser自身の状態を返します。
追加と解除は同じResourceへの`PUT`と`DELETE`で冪等に扱い、再試行で件数が重複しないようにします。
Custom Emojiは識別子と利用権限の契約が必要なため、初期Versionには含めません。

## Cursor Pagination

一覧 API は `cursor` と `limit` を共通 Query Parameter として使用します。
`cursor` は Server が発行する不透明な値であり、Client は内容を解析しません。

Response は Resource ごとの `items` と共通の `page` を持つ形にします。
`page` は `has_more` と `next_cursor` を返し、全件数は含めません。
全件数を共通契約にすると、大きな Table でも毎回の集計が必要になるためです。

## Rate Limit

Rate Limit Response は `429`、共通 Error Body、再試行情報を返します。

| Header | 意味 |
| --- | --- |
| `Retry-After` | 再試行までの秒数 |
| `X-RateLimit-Limit` | Window 内で許可する Request 数 |
| `X-RateLimit-Remaining` | Window 内の残り Request 数 |
| `X-RateLimit-Reset` | Window 終了時刻の Unix Timestamp（秒） |
| `X-RateLimit-Bucket` | 同じ制限を共有する Operation 群の識別子 |

Body の `retry_after_ms` は Client の待機制御に使うミリ秒数です。
Header と Body で単位が異なるため、Field 名と説明に単位を含めています。

## Gateway Schema

Gateway は JSON Schema Draft 2020-12 を使用します。
接続制御を `protocol/gateway/lifecycle`、Dispatch Eventを`protocol/gateway/events`、Event Payloadとして共有するResourceを`protocol/gateway/resources`、Opcodeなどの共通値を`protocol/gateway/common`に配置します。

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

Text Channelの同期には次のDispatch Eventを使用します。

- `MESSAGE_CREATE`：作成されたMessage全体を配信する
- `MESSAGE_UPDATE`：更新後のMessage全体を配信する
- `MESSAGE_DELETE`：削除されたMessageの`id`と`channel_id`を配信する
- `MESSAGE_REACTION_ADD`：Reactionを付けたUserと操作後の件数を配信する
- `MESSAGE_REACTION_REMOVE`：Reactionを外したUserと操作後の件数を配信する

Message Eventは`GUILD_MESSAGES` Intentを購読した接続へ配信します。
`MESSAGE_CONTENT` Intentが許可されない接続でもEvent自体は配信しますが、Messageと返信元参照の`content`は`null`にします。
投稿者自身の接続も配信対象に含め、ClientはMessage IDを使ってREST ResponseとGateway Eventを重複排除します。

Reaction Eventは`REACTIONS` Intentを購読した接続へ配信します。
Eventの`count`は増減値ではなく操作後の現在値であり、Clientは再配信されたEventを重ねて加算しません。

すべてのDispatch EventはGateway Session内で単調増加する`s`を持ちます。
Clientは最後に適用したSequenceをHeartbeatとResumeへ渡し、再配信されたEventをSequenceとResource IDで安全に処理します。

Opcode、Event名、Intentの割り当ては`protocol/gateway/common`のJSON Schemaを正とします。
TypeScriptで利用するRuntime Constantも同じSchemaから生成します。

| Opcode | 値 |
| --- | ---: |
| `DISPATCH` | 0 |
| `HEARTBEAT` | 1 |
| `IDENTIFY` | 2 |
| `RESUME` | 6 |
| `INVALID_SESSION` | 9 |
| `HELLO` | 10 |
| `HEARTBEAT_ACK` | 11 |

Intent は32-bit Bitfield とし、初期割り当ては `GUILDS` から `APPLICATION_INTERACTIONS` までの9種類です。
未割り当て Bit は、Schema と Changelog で意味を定義してから使用します。

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
| `packages/protocol-ts/src/generated/gateway-constants.ts` | Gateway Opcode と Intent Schema |
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
