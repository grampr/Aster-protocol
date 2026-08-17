# Aster Protocol へのコントリビューション

Aster Protocol の変更は、通信相手となる Client、Server、Bot に影響します。
Schema の差分から互換性への影響を判断できる Pull Request にしてください。

## 開発環境

- Node.js 22.12 以降
- pnpm 11 以降
- Go 1.25 以降

依存関係を取得し、検証を実行します。

```bash
pnpm install
pnpm check
```

## Schema の変更手順

1. `protocol` 以下の OpenAPI または JSON Schema を変更する。
2. Request、Response、Gateway Message の例を更新する。
3. `pnpm check` を実行する。
4. Schema と生成物を同じ Commit に含める。
5. 互換性への影響を Pull Request に記載する。

生成物を直接編集しても、次の `pnpm generate` で上書きされます。

## OpenAPI の記述規則

開発者が Endpoint の目的と入出力をファイル単位で追える状態を保ちます。

- Path は `paths/<domain>/<resource>.yaml` に配置する。
- Schema は `components/schemas/<domain>/<Name>.yaml` に配置する。
- Resource 名と Schema 名には、意味を省略した略語を使わない。
- `operationId` は動詞から始め、生成された関数名だけで操作を区別できる名前にする。
- `summary` は一行で操作を示す。
- `description` には、`summary` の言い換えではなく、認可条件や副作用などの判断材料を書く。
- Request と Response には、Field の関係が分かる例を置く。
- 共通化は、複数の Operation が同じ意味と制約を共有するときに限る。

同じ形をしていても意味が異なるデータは、別の Schema として定義します。
形だけを理由に共通化すると、一方の制約変更が無関係な API へ波及するためです。

## Gateway の記述規則

Gateway Message は方向と Lifecycle を説明に含めます。
Opcode と Event 名は Schema の `const` で固定し、生成された判別共用体から利用します。

Opcode と Intent を追加するときは `protocol/gateway/common` の `$defs` を変更します。
TypeScript の Runtime Constant は生成物であり、直接編集しません。

Intent の値には1 Bit だけを立てた整数を割り当てます。
既存の値は Client と Bot の設定に保存されるため、別の意味へ再割り当てしません。

実在する Token、Password、Message 本文などの秘密情報や利用者データを Example に含めません。
認証情報の Example が必要な場合は、`example-access-token` や `<password>` のように秘密ではない Placeholder を使用します。

認証方法を追加するときも、Aster Session の Request と Response を Provider 固有の Token 形式へ結合しません。
外部 Identity は Provider と Provider Subject の組で識別し、Email Address だけで既存 Account へ自動 Link しません。

## Commit と Pull Request

Commit Message は Conventional Commits を使用します。

```text
feat: add message create schema
fix: require sequence in resume command
docs: explain cursor pagination
```

破壊的変更を含む場合は、変更理由、移行方法、影響を受ける Package を Pull Request に記載し、`CHANGELOG.md` を更新します。
