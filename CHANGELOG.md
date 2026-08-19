# Changelog

Aster Protocol の利用者に影響する変更を記録します。

形式は Keep a Changelog を参考にし、Version は Semantic Versioning に従います。

## Unreleased

### Added

- 人間が編集する分割 OpenAPI Schema
- REST API の Health Check と共通 Error Schema
- Gateway 接続 Lifecycle の JSON Schema
- Cursor Pagination の共通 Parameter と Page 情報
- Rate Limit の共通 Header、Error Body、Response
- Gateway Opcode と Intent の割り当て
- TypeScript 用 Gateway Runtime Constant の生成
- TypeScript と Go の型生成
- Schema 検証と生成差分を確認する CI
- Password による Account 登録、Login、Session 更新、Logout の OpenAPI Schema
- Bearer 認証と認証済み User 自身を取得する OpenAPI Schema
- Password と将来の Google OIDC が共有する Provider 非依存の Aster Session 契約
- Google OpenID Connect、PKCE S256、Desktop Deep Link、Aster Exchange Code の OpenAPI Schema
- Guild、Text/Voice Channel、Messageの取得・作成・更新・削除を行うOpenAPI Schema
- Message作成・更新・削除を配信するGateway Event Schema
- TypeScript用Gateway Event名Runtime Constant
