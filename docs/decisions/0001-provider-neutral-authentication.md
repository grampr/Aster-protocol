# ADR-0001: 認証方法と Aster Session を分離する

- Status: Accepted
- Date: 2026-08-17

## Context

Aster は Password 認証から実装を始め、後から Google OpenID Connect を追加する予定です。
認証方法ごとに Client が異なる Token を扱うと、API 認可、保存方法、Session 失効処理が Provider の仕様へ結合します。
また、Google の Token を Desktop Client に渡すと、漏えい時の影響範囲と Token Lifecycle の管理対象が広がります。

## Decision

Password と外部 Provider は、User の本人確認方法として扱います。
本人確認に成功した後は、Aster Server が Provider 非依存の Access Token と Refresh Token を発行します。
Aster API と Gateway は Aster Access Token だけを受け付けます。

Refresh Token は Public Client 向けの Replay 対策として Rotation します。
使用済み Refresh Token の再利用を検知した場合、Server は同じ Session の Token Family を無効化できます。

Password は15文字以上を要求し、128文字まで受け付けます。
Client は文字種の組み合わせを強制しません。
Server は Password を Salt 付きの Memory-hard Password Hash で保存し、既知の漏えい Password を拒否できます。

Google Login は Authorization Code Flow と PKCE `S256` を使用します。
Server は OAuth `state`、OpenID Connect `nonce`、Issuer、Audience、署名を検証します。
Google の Token は Server 側に留め、Desktop Client には短時間かつ一度だけ使える Aster Exchange Code を返します。
Desktop Client は Exchange Code と PKCE Verifier を Aster Session Token へ交換します。

外部 Identity の安定した識別子は Provider と Provider Subject の組です。
確認済み Email Address は Account Link の補助情報にできますが、Email Address だけを根拠に既存 Account へ自動 Link しません。

## Consequences

- Password Login と Google Login の後続処理は、同じ Session 保存、更新、Logout の実装を共有できます。
- Client は Google Token の保管と更新を担当しません。
- Provider を追加しても、通常の API と Gateway の認可方式は変わりません。
- Google Login の Redirect URI、Callback、Exchange Endpoint は、Desktop の Deep Link 方針を決めてから別の Protocol 変更として追加します。
- Account Link、Unlink、Email Verification、Password Reset は、この ADR の境界を守る独立した Flow として定義します。

## References

- [OAuth 2.0 Security Best Current Practice (RFC 9700)](https://www.rfc-editor.org/rfc/rfc9700)
- [NIST SP 800-63B-4: Passwords](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google OAuth 2.0 for Mobile and Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
