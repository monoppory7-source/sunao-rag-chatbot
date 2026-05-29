'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';

type Props = {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled?: boolean;
  streaming?: boolean;
};

export function ChatInput({ onSend, onStop, disabled, streaming }: Props) {
  const [value, setValue] = useState('');

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue('');
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 rounded-2xl border border-neutral-300 bg-white p-2 shadow-sm focus-within:border-neutral-500"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        rows={1}
        placeholder="質問を入力してください（Enter で送信、Shift+Enter で改行）"
        className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-500"
        maxLength={500}
        disabled={disabled && !streaming}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {streaming ? (
        <button
          type="button"
          // Keep the keyboard from being dismissed by the tap so the click
          // fires reliably on iOS Safari.
          onPointerDown={(e) => e.preventDefault()}
          onClick={onStop}
          className="touch-manipulation rounded-lg bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-300"
        >
          停止
        </button>
      ) : (
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          // iOS fix: prevent the textarea blur that would otherwise eat the
          // tap and prevent the click from firing while the keyboard closes.
          onPointerDown={(e) => e.preventDefault()}
          // Safety net: even if the form's onSubmit doesn't fire reliably
          // (rare iOS edge case), the explicit onClick still triggers submit.
          onClick={() => submit()}
          className="touch-manipulation rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          送信
        </button>
      )}
    </form>
  );
}
