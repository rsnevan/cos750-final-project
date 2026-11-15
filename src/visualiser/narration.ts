export function speakNarration(
  speechSynthesis: Pick<SpeechSynthesis, 'cancel' | 'speak'>,
  text: string,
  cancelPrevious: boolean,
  rate = 1,
  onComplete?: () => void,
): void {
  if (cancelPrevious) speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  if (onComplete !== undefined) {
    // Some browsers never fire end (no voices installed, tab in the
    // background), so a timer moves playback on if the speech goes quiet.
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      globalThis.clearTimeout(fallback);
      onComplete();
    };
    const fallback = globalThis.setTimeout(finish, Math.max(2500, (text.length * 90) / rate) + 1500);
    utterance.onend = finish;
    utterance.onerror = finish;
  }
  speechSynthesis.speak(utterance);
}
