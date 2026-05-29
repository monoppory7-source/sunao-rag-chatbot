'use client';

import { useState, type KeyboardEvent } from 'react';

type Props = {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled?: boolean;
  streaming?: boolean;
};

export function ChatInput({ onSend, onStop, disabled, streaming }: Props) {
  const [value, setValue] = useState('');

  function submit() {
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
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 rounded-2xl border border-neutral-300 bg-white p-2 shadow-sm focus-within:border-neutral-500"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        rows={1}
        placeholder="質問を入力（Enter で送信）"
        // text-base = 16px: avoids iOS Safari auto-zoom on focus.
        className="flex-1 resize-none bg-transparent px-2 py-2 text-base text-neutral-900 outline-none placeholder:text-neutral-500"
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
          // onMouseDown also fires for touch on iOS Safari; preventing default
          // here keeps the textarea focused so the keyboard does not dismiss
          // and consume the subsequent tap.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onStop}
          className="touch-manipulation min-h-[44px] min-w-[60px] shrink-0 rounded-lg bg-neutral-200 px-4 text-sm font-medium text-neutral-700 active:bg-neutral-300"
        >
          停止
        </button>
      ) : (
        <button
          // type="button" instead of "submit" so the form's onSubmit cannot
          // double-fire alongside this onClick (which previously could send
          // the same message twice on devices that fire both events).
          type="button"
          disabled={!value.trim() || disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
          className="touch-manipulation min-h-[44px] min-w-[60px] shrink-0 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition active:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          送信
        </button>
      )}
    </form>
  );
}
