import { ChatContainer } from '@/components/chat/ChatContainer';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Sunao Pharmaceutical
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          AI コンシェルジュ
        </h1>
        <p className="text-sm text-neutral-600">
          Sunao 製薬の公式 YouTube 動画から、ご質問に最も近い解説と参照タイムスタンプを返します。
        </p>
      </header>
      <ChatContainer />
    </main>
  );
}
