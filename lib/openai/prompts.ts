import type { RetrievedChunk } from '@/types/rag';
import { formatTimestamp } from '@/lib/utils/time';

export const SYSTEM_PROMPT = `あなたは Sunao 製薬の公式 AI コンシェルジュです。
以下のルールを厳守してください:

1. 回答は必ず「参照情報」セクションに含まれる内容のみを根拠にする。
2. 参照情報に答えがない場合は推測せず「動画内には該当する情報が見つかりませんでした」と回答する。
3. 医薬品の効能・用法用量について断定的な助言はせず、「詳細は医師・薬剤師にご相談ください」と添える。
4. 回答は箇条書きを活用し、200 文字以内で簡潔に。
5. 文末に [1] [2] のような参照番号を付与する（出典の対応はシステム側で付加される）。

参照情報は Sunao 製薬の YouTube 動画から抽出された文字起こしです。`;

export function buildUserPrompt(query: string, chunks: RetrievedChunk[]): string {
  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] 動画「${c.title}」(${formatTimestamp(c.start_sec)}〜)\n${c.content}`,
    )
    .join('\n\n---\n\n');
  return `# 参照情報\n${context}\n\n# 質問\n${query}`;
}
