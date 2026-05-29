'use client';

import { useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';

type Props = {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled?: boolean;
  streaming?: boolean;
};

export function ChatInput({ onSend, onStop, disabled, streaming }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Guards against double-fire when multiple of {touchend, click, form onSubmit}
  // resolve on the same tap. Anything within 400ms is treated as the same gesture.
  const lastFiredAt = useRef(0);

  function submit() {
    const now = Date.now();
    if (now - lastFiredAt.current < 400) return;
    lastFiredAt.current = now;

    if (disabled) return;
    // Prefer the live DOM value over React state. Mobile Japanese IMEs
    // commit text only after the user picks a kanji candidate, so React's
    // onChange can lag the visible text.
    const text = (textareaRef.current?.value ?? value).trim();
    if (!text) return;
    onSend(text);
    setValue('');
    if (textareaRef.current) textareaRef.current.value = '';
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  // On iOS Safari, when a textarea has focus and the user taps the send
  // button, the textarea blurs → keyboard dismisses → viewport reflows, and
  // the synthetic click is frequently dropped because touchend lands on a
  // different element. Firing on touchend (before the reflow) is much more
  // reliable; we then preventDefault to suppress the no-longer-needed click.
  function handleTouchEnd(e: TouchEvent<HTMLButtonElement>) {
    e.preventDefault();
    submit();
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
        ref={textareaRef}
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
          onClick={onStop}
          onTouchEnd={(e) => {
            e.preventDefault();
            onStop();
          }}
          className="touch-manipulation min-h-[44px] min-w-[60px] shrink-0 rounded-lg bg-neutral-200 px-4 text-sm font-medium text-neutral-700 active:bg-neutral-300"
        >
          停止
        </button>
      ) : (
        <button
          type="submit"
          disabled={disabled}
          onClick={submit}
          onTouchEnd={handleTouchEnd}
          className="touch-manipulation min-h-[44px] min-w-[60px] shrink-0 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition active:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          送信
        </button>
      )}
    </form>
  );
}
