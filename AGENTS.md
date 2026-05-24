# AGENTS.md

AI/開発エージェント向けのプロジェクトガイド。コーディングエージェント (Claude Code, Codex,
Cursor, Copilot 等) が本リポジトリで作業するときに最初に読むべきドキュメント。

ゲームのルール・体験面の詳細は [doc/game.md](doc/game.md)、エンドユーザー
向けの操作ガイドは [doc/user-manual.md](doc/user-manual.md) を参照。

## プロジェクト概要

- **名前**: 3D Connect Four (3D 4目並べ)
- **形式**: Web ブラウザで動作する 4×4×4 立体版コネクトフォー
- **デプロイ**: Vercel 想定 (`.vercel/` あり)
- **対戦モード**: 2 プレイヤー (同一画面) / vs AI / オンライン対戦

## 技術スタック

| 領域                      | 技術                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| フレームワーク            | Next.js 15.2.4 (App Router)                                       |
| 言語                      | TypeScript 5 (strict)                                             |
| UI                        | React 19, Radix UI, Tailwind CSS 3, shadcn/ui (`components.json`) |
| 3D 描画                   | Three.js 0.179, `@react-three/fiber` 9, `@react-three/drei` 10    |
| フォーム / バリデーション | react-hook-form, zod                                              |
| アイコン                  | lucide-react                                                      |
| パッケージマネージャ      | pnpm (lockfile は `pnpm-lock.yaml`)                               |

> **注意**: `next.config.mjs` で `eslint.ignoreDuringBuilds` と
> `typescript.ignoreBuildErrors` が有効。ビルドが通るからといって型/Lint が
> 通っているとは限らない。修正時は `pnpm lint` と `tsc --noEmit` を別途回すこと。

## ディレクトリ構成

```
app/
├── layout.tsx               # ルートレイアウト (ThemeProvider)
├── globals.css              # Tailwind + 全体スタイル
├── page.tsx                 # エントリ。画面遷移ステートマシン + 3D ヘルパー群
└── api/game/                # オンライン対戦用 API ルート
    ├── create/route.ts          # ルーム新規作成
    ├── join/[roomId]/route.ts   # 既存ルームへ参加
    ├── quick-match/route.ts     # マッチング (空きルームに合流 or 新規作成)
    ├── debug/route.ts           # デバッグ用
    └── [roomId]/
        ├── start/route.ts       # ゲーム開始シグナル (3 回ブロードキャスト)
        ├── move/route.ts        # 駒を打つ
        └── events/route.ts      # SSE で部屋の状態を配信
components/
├── title-page.tsx           # タイトル画面 (モード選択 + 背景プレビュー)
├── online-menu.tsx          # オンライン: クイックマッチ/作成/参加 タブ
├── online-waiting.tsx       # オンライン: 待機ルーム (ホストが Start)
├── game-page.tsx            # 実プレイ画面 (R3F Canvas, 設定 UI)
├── theme-provider.tsx       # next-themes ラッパー
├── background/              # タイトル背景バリエーション
└── ui/                      # shadcn/ui (Radix ベース) 約 50 コンポーネント
hooks/
├── useOnlineGame.ts         # SSE 接続 + REST 呼び出しを集約
├── use-toast.ts / use-mobile.{ts,tsx}
lib/
├── game-manager.ts          # サーバ側のインメモリ状態 (シングルトン)
└── utils.ts                 # cn() など
types/
├── GameBoard.ts             # Player = 1|2|null, GameBoard = Player[][][]
└── online.ts                # GameRoom / Player / GameMove / GameEvent
public/                      # タイトル背景画像など静的アセット
```

`pages/` ディレクトリは存在するが空。App Router のみを利用している。

## 画面遷移ステートマシン (`app/page.tsx`)

```
menu ──選択──▶ playing                (two-player / vs-ai)
            └▶ online-menu ──作成/参加/QM──▶ online-waiting ──Start──▶ playing
```

`GameState` は `"menu" | "playing" | "online-menu" | "online-waiting" | "online-playing"`
だが、実際にレンダリングされるのは前 4 つ。オンライン対戦中も `playing` で
`gameMode === "online"` を渡している。

## ゲームロジック

- 盤面は 3 次元配列 `board[x][y][z]` (各軸 4)。
- **重力ルール**: ある (x, z) 列は最下段 y=0 から積み上がる。
  - クライアント側: `app/page.tsx` の `getValidMoves` / `simulateMove`
  - サーバ側: `lib/game-manager.ts` の `makeMove` 内の y 探索
- 勝利判定 (`checkWinnerForBoard`) は 26 方向のうち重複を除いた 13 方向を
  `directions` 配列で列挙し、4 連を探す。
- AI (`getAIMove`) は **ヒューリスティクス**:
  1. 自分の勝ち手があれば即着手
  2. 相手の勝ち手をブロック (easy は 30% スキップ)
  3. `evaluatePosition` (中央寄り + ライン評価) + 難易度別ランダム
- リーチライン表示 (`findReachLines`) は「3 ピース + 重力で置ける空き 1 マス」を
  検出して 3D で点滅描画。

> **注意**: クライアントとサーバで勝利判定ロジックが二重実装されている。
> サーバ側 `GameManager.checkWinner` は現状スタブ (`return null`) なので、
> オンライン対戦の勝利判定はクライアント表示にしか反映されない。修正対象として
> 認識しておくこと。

## オンライン対戦アーキテクチャ

- 状態管理: `lib/game-manager.ts` の `gameManager` シングルトン
  (`Map<roomId, GameRoom>`)。**プロセス内メモリのみ**。サーバ再起動で消える。
  本番のサーバレス環境ではインスタンス分散で破綻するので、永続化が必要なら
  Redis 等への置き換えを検討。
- リアルタイム配信: Server-Sent Events (`app/api/game/[roomId]/events/route.ts`)
  - 接続ごとに `controller` を `roomConnections` に登録
  - 2 秒ごとに状態を JSON 比較 (`lastActivity`/`lastSeen` を除外) し、
    変化時のみ `broadcastToRoom` で全クライアントに push
  - `start/route.ts` は 0ms / 200ms / 500ms の **3 回ブロードキャスト** で
    取りこぼし対策をしている
- **両者同意のスタート / リマッチゲート**: `start/route.ts` は単発で
  `gameStarted` を立てない。各プレイヤーが POST すると
  `GameRoom.readyPlayerIds` に追加され、**両者が揃ったタイミングで初めて**
  `gameStarted: true` (初回) または board リセット (リマッチ) が発火する。
  - 第 2 プレイヤーの POST レスポンスは `{ started: true }` または
    `{ restarted: true }` を返す。第 1 プレイヤーの POST は両方 false。
  - リマッチは `gameOver === true` の状態で markReady されると判定される
    (ゲーム途中での board リセット手段はない)。
- クライアント: `hooks/useOnlineGame.ts`
  - `EventSource` で接続、エラー時は指数バックオフで最大 5 回再接続
  - `createRoom` / `joinRoom` / `quickMatch` / `markReady` / `startGame`
    (markReady の薄いエイリアス) / `makeMove` を提供
  - サーバから `game-restarted` イベントを受けると `restartedTick` を bump。
    `game-page` 側はそれを契機にローカル UI 状態を新ラウンド向けにリセット
- 30 分非アクティブなルームは `cleanupInactiveRooms` で削除
  (`start` ルートで遅延 cleanup を呼ぶ)

## 開発コマンド

```powershell
pnpm install        # 依存インストール
pnpm dev            # http://localhost:3000 で開発サーバ
pnpm build          # 本番ビルド (型/Lint エラーは無視される設定)
pnpm start          # 本番サーバ起動 (build 後)
pnpm lint           # next lint
```

`package.json` の `scripts` には `npm run dev` など npm 表記もあるが、
lockfile は pnpm。pnpm を優先。

## エージェント向け作業ガイド

### 触る場所の早見表

| やりたいこと              | 主に編集するファイル                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| ゲームルール / AI 強さ    | `app/page.tsx` (ヘルパー関数群)                                       |
| 3D 表示 / ピース形状 / 色 | `components/game-page.tsx`, `app/page.tsx` (`GamePiece`, `GridFrame`) |
| タイトル/背景             | `components/title-page.tsx`, `components/background/*`                |
| オンライン UI             | `components/online-menu.tsx`, `components/online-waiting.tsx`         |
| オンライン通信            | `hooks/useOnlineGame.ts` ↔ `app/api/game/**`                          |
| サーバ状態 / 部屋管理     | `lib/game-manager.ts`                                                 |
| 共通 UI                   | `components/ui/*` (shadcn の規約に従う)                               |
| 型                        | `types/GameBoard.ts`, `types/online.ts`                               |

### コーディング規約

- パスエイリアス `@/*` は repo ルート (`tsconfig.json`)。
- 新規 UI は `components/ui/` の既存 shadcn コンポーネントを優先。
  追加するなら shadcn CLI 風の構成 (`components.json` 参照) を踏襲。
- スタイルは Tailwind ユーティリティ + `clsx` / `tailwind-merge` (`lib/utils.ts` の `cn`)。
- 文字列リテラル UI テキストは日本語。新規追加時もトーンを揃える。
- `"use client"` ディレクティブの付け忘れに注意 (Three.js / hooks を使う側は必須)。

### よくある落とし穴

- **`page.tsx` と `game-page.tsx` の重複定義**: `COLOR_PRESETS` / `PIECE_SHAPES` /
  `AI_DIFFICULTIES` / `getValidMoves` などは両ファイルにコピペされている。
  片方だけ直すと挙動が分岐するので、ロジック修正時は両方更新するか
  共通モジュールに抽出する。
- **`components/page.tsx` のサイズ**: 1100 行超。リファクタは歓迎だが
  影響範囲が広いので、機能境界 (3D 描画 / ロジック / UI) で段階的に切り出す。
- **オンライン状態のテスト**: ローカルでは別ブラウザ/シークレットウィンドウを
  2 つ開く。SSE は HMR で再接続が発生するので "切断" バッジが一瞬出るのは正常。
- **`hooks/use-mobile.ts` と `use-mobile.tsx` が両方ある**: import 元を確認の上、
  どちらかに統一するのが望ましい。

### テスト

- テストフレームワークは未導入。挙動確認は `pnpm dev` + ブラウザ手動。
- UI/3D 変更時は最低限: タイトル → 各モード起動 → 1 手着手 まで触ること。

## ライセンス / 由来

- 元は v0.dev で生成されたプロジェクトで、その後手で書き直されている
  (`package.json` name は `3d-connect-four`)。
- README は二言語 ([README.md](README.md) / [README.ja.md](README.ja.md)) で
  プロジェクト概要・セットアップ・スクリプトをまとめている。エージェントの
  詳細仕様は本ファイルを正とする。
