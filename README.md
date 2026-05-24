# Sunao 製薬 AI コンシェルジュ

Sunao 製薬の公式 YouTube 動画を知識ベースとした RAG (Retrieval-Augmented Generation) チャットボットです。
顧客の質問に対し、最も関連する動画の文字起こしを根拠として回答を生成し、参照タイムスタンプ付きで動画 URL を返します。

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| DB / Search | Supabase + pgvector (HNSW index) |
| LLM | OpenAI `gpt-4o-mini` |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) |
| Ingest | Python 3 + yt-dlp + tiktoken + supabase-py |
| Schedule | GitHub Actions cron (Phase C) |

## Setup

### 1. Supabase

1. 新規プロジェクトを作成: <https://supabase.com>
2. SQL Editor で `supabase/migrations/*.sql` を**ファイル名順に**実行
3. Project Settings → API から URL / anon key / service_role key を取得

### 2. OpenAI

API キーを発行: <https://platform.openai.com/api-keys>

### 3. YouTube チャンネル ID

Sunao 製薬の公式チャンネルページを開き、URL から `UC...` で始まる ID を控える（または「チャンネルソース」→ `channel_id` メタタグ）。

### 4. 環境変数

```bash
cp .env.local.example .env.local
$EDITOR .env.local   # 上記で取得した値を投入
```

### 5. Web アプリ起動

```bash
npm install      # 初回のみ
npm run dev      # http://localhost:3000
```

### 6. 動画データ取り込み

```bash
cd scripts/ingest
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# プロジェクトルートの .env.local を読み込む
set -a && source ../../.env.local && set +a

# 通常モード（RSS から新着のみ取り込み）
python pipeline.py

# バックフィルモード（特定の動画IDを直接指定）
python pipeline.py dQw4w9WgXcQ abc123xyz
```

## 動作確認チェックリスト

| # | 確認項目 | 期待結果 |
|---|---|---|
| 1 | `curl http://localhost:3000/api/health` | `{"status":"ok",...}` |
| 2 | `pipeline.py` を 1 本以上の動画で実行 | Supabase の `videos` / `transcript_chunks` に行が増える |
| 3 | ブラウザで `localhost:3000` を開きチャット入力 | 関連動画のチャンクが回答に反映され、ソースカードが表示される |
| 4 | 同じ質問を 2 回目に送る | 応答ヘッダ `X-Cache: HIT-EXACT`、`cached` バッジ表示 |
| 5 | 似たが微妙に違う質問を送る | 応答ヘッダ `X-Cache: HIT-SEMANTIC`（類似度 > 0.95 のとき） |
| 6 | 全く関係ない質問を送る | 「該当する情報が見つかりませんでした」が返り、OpenAI Chat API は呼ばれない |

## アーキテクチャ

```
[YouTube RSS] → [Python ingest (GitHub Actions / 手動)]
                         ↓
               [Supabase: videos + transcript_chunks (pgvector)]
                         ↑
[ブラウザ] ── POST /api/chat ──→ [Next.js Route Handler]
   ↑                                  │
   │                                  ├─ L2 完全一致キャッシュ
   │                                  ├─ L3 セマンティックキャッシュ
   │                                  ├─ クエリ embedding
   │                                  ├─ match_chunks_weighted RPC (類似度 + 鮮度)
   │                                  ├─ プロンプト整形
   │                                  └─ OpenAI streaming
   └──── 本文 (stream) + X-Sources ──┘
```

## ディレクトリ

```
app/                  Next.js App Router (page, API routes)
components/chat/      チャット UI コンポーネント
lib/
  openai/             OpenAI client / embeddings / prompts
  rag/                retriever / formatter / cache
  supabase/           server / browser clients
  utils/              hash, time, youtube
  chat/               useRagChat フック
types/                共有型定義
supabase/migrations/  SQL マイグレーション
scripts/ingest/       Python 取り込みパイプライン
```

## 取り込みの自動化

GitHub Actions が毎時 RSS を確認して新着動画を取り込みます（[.github/workflows/ingest.yml](.github/workflows/ingest.yml)）。

リポジトリの **Settings → Secrets** に以下を登録してください:

| Secret name | Value |
| --- | --- |
| `YOUTUBE_CHANNEL_ID` | `UC...` から始まるチャンネル ID |
| `SUPABASE_URL` | Supabase プロジェクト URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role キー |
| `OPENAI_API_KEY` | OpenAI API キー |
| `SLACK_WEBHOOK_URL` | 任意。完了通知用 |

手動バックフィルは `workflow_dispatch` → `video_ids` 入力欄に空白区切りで動画 ID を指定。

## 検索精度の計測

```bash
# golden_set.json に query → expected_video_ids を ≥20 件登録してから実行
npm run eval
```

詳細は [scripts/eval/README.md](scripts/eval/README.md)。

## 状態

| Phase | 内容 | ステータス |
| --- | --- | --- |
| A | Next.js / Supabase / 依存・スタブ・SQL | ✅ |
| B | `/api/chat` RAG 本実装 + チャット UI + Python ingest | ✅ |
| C | GitHub Actions ingest cron + 評価スクリプト | ✅ |
