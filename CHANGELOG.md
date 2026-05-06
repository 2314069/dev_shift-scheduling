# Changelog

## [Unreleased]

### Added
- Phase 1-1 オンボーディングフロー: 新規ユーザーがサインイン後に店舗を作成し、初期データ投入ガイドへ進める
- 組織管理 API: `POST /api/organizations`, `GET /api/organizations/me`, `GET /api/me`
- `/schedule` に初期データ投入ヒントカードを表示（データ未投入時のみ）
- 「店舗」表記を全 UI で統一

### Changed
- ルート (`/`) のリダイレクトを 3 状態（未認証 / 組織なし / 組織あり）に分岐

### Fixed
- M3 ブロッカー解消: 新規ユーザーが組織未所属で API 403 になる問題を解消（明示オンボーディング画面で店舗作成）
