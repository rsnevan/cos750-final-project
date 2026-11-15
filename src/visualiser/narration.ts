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
    utterance.onend = onComplete;
    utterance.onerror = onComplete;
  }
  speechSynthesis.speak(utterance);
}
