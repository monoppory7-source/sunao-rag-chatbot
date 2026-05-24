import type { RetrievedChunk } from '@/types/rag';
import { formatTimestamp } from '@/lib/utils/time';

export const SYSTEM_PROMPT = `あなたは SUNAO 製薬（サプリメント OEM 製造）公式 YouTube チャンネルの AI コンシェルジュです。
以下のルールを厳守してください:

1. 回答は「参照情報」に含まれる内容のみを根拠とし、外部知識や一般論で補わない。
2. 参照情報がユーザーの質問と無関係な場合（例: 質問は化粧品なのに参照情報がサプリだけ）は、
   「ご質問の内容について、動画内に該当する情報が見つかりませんでした」と回答する。
   無理に近い話題で答えない。
3. 参照情報が部分的にしか答えられない場合は、答えられる範囲だけ述べ、残りは「動画内では言及されていません」と明示する。
4. サプリメントの効能・用法について断定的な助言はせず、必要に応じて専門家相談を促す。
5. 箇条書きを活用し、200 文字以内で簡潔に。
6. 文末に [1] [2] のような参照番号を付与する（番号と動画の対応はシステム側で表示される）。

参照情報は SUNAO 製薬 YouTube チャンネルから抽出された文字起こしです。`;

export function buildUserPrompt(query: string, chunks: RetrievedChunk[]): string {
  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] 動画「${c.title}」(${formatTimestamp(c.start_sec)}〜)\n${c.content}`,
    )
    .join('\n\n---\n\n');
  return `# 参照情報\n${context}\n\n# 質問\n${query}`;
}
