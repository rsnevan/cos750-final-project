import { drawTree } from '../../visualiser';
import { checkPart } from '../../content';
import type { Part, PartResponse, Question } from '../../content';
import type { Highlight, Slot } from '../../engine';
import { el } from '../dom';

interface PartState {
  response?: PartResponse;
  confirmed: boolean;
}

export interface QuestionForm {
  reset(): void;
  destroy(): void;
}

export interface QuestionFormOptions {
  readonly highlight?: Highlight;
}

function partName(part: Part, index: number): string {
  if (part.label.trim() !== '') return part.label;
  switch (part.type) {
    case 'pick': return `Choose an answer for part ${index + 1}`;
    case 'click': return part.mode === 'one' ? 'Choose one node' : part.mode === 'set' ? 'Choose nodes' : 'Choose nodes in order';
    case 'order': return 'Put the cards in order';
    case 'place': return 'Place the keys';
  }
}

function copyBase(question: Question, overlay?: Highlight): Highlight {
  return { ...question.base, ...overlay };
}

function sequenceFeedback(part: Part, response: PartResponse): string {
  const result = checkPart(part, response);
  if (result.correct) return 'Sequence complete.';
  if (result.onTrack) return 'Correct so far. Continue to the next step.';
  return 'That is not the next step. Undo the last choice and try again.';
}

export function mountQuestionForm(
  container: HTMLElement,
  question: Question,
  onSubmit: (responses: readonly PartResponse[]) => void,
  options: QuestionFormOptions = {},
): QuestionForm {
  const states: PartState[] = question.parts.map(() => ({ confirmed: false }));
  const fields: HTMLElement[] = [];
  let submitButton: HTMLButtonElement;

  function isComplete(part: Part, state: PartState): boolean {
    if (part.type === 'pick') return typeof state.response === 'number';
    if (part.type === 'click' && part.mode === 'one') return typeof state.response === 'number';
    if (part.type === 'click' && part.mode === 'set') return state.confirmed;
    if (part.type === 'click' && part.mode === 'path') return state.confirmed;
    if (part.type === 'order') {
      return Array.isArray(state.response) && state.response.length === part.cards.length;
    }
    return part.type === 'place' && Array.isArray(state.response) && state.response.length === part.keys.length;
  }

  function refreshSubmit(): void {
    submitButton.disabled = question.parts.some((part, index) => !isComplete(part, states[index] ?? { confirmed: false }));
  }

  function render(): void {
    fields.length = 0;
    question.parts.forEach((part, index) => {
      const state = states[index];
      if (state === undefined) throw new Error(`Question part ${index} is missing`);
      const field = el('fieldset', { class: 'question-part' });
      field.append(el('legend', {}, partName(part, index)));

      if (part.type === 'pick') {
        const group = `answer-${question.id}-${index}`;
        part.options.forEach((option, optionIndex) => {
          const input = el('input', { type: 'radio', name: group, value: String(optionIndex) }) as HTMLInputElement;
          input.checked = state.response === optionIndex;
          input.addEventListener('change', () => {
            state.response = optionIndex;
            refreshSubmit();
          });
          field.append(el('label', { class: 'answer-option' }, input, option));
        });
      } else if (part.type === 'order') {
        const chosen = Array.isArray(state.response) ? [...state.response] as number[] : [];
        const available = part.cards.filter((key) => !chosen.includes(key));
        field.append(el('p', { class: 'question-help' }, 'Select each node in the order you think is correct.'));
        const cards = el('div', { class: 'answer-cards' });
        for (const key of available) {
          const choose = el('button', { type: 'button', class: 'button answer-card' }, String(key));
          choose.addEventListener('click', () => {
            chosen.push(key);
            state.response = chosen;
            render();
          });
          cards.append(choose);
        }
        field.append(cards);
        field.append(el('p', { class: 'answer-sequence', 'aria-live': 'polite' },
          chosen.length === 0 ? 'Your order: not started' : `Your order: ${chosen.join(', ')}`));
        if (chosen.length > 0) {
          field.append(el('p', { class: 'flow-feedback', role: 'status', 'aria-live': 'polite' }, sequenceFeedback(part, chosen)));
        }
        const undo = el('button', { type: 'button', class: 'button' }, 'Undo last choice');
        undo.disabled = chosen.length === 0;
        undo.addEventListener('click', () => {
          chosen.pop();
          state.response = chosen;
          render();
        });
        field.append(undo);
      } else {
        const treeMount = el('div', { class: 'question-tree' });
        if (part.type === 'place') {
          const selection = Array.isArray(state.response) ? [...state.response] as Slot[] : [];
          const keyIndex = selection.length;
          field.append(el('p', { class: 'question-help' },
            keyIndex < part.keys.length
              ? `Choose the empty spot for ${part.keys[keyIndex]}. Place each key in order.`
              : 'All keys have an empty spot.'));
          const updateTree = () => {
            const highlight = copyBase(question, options.highlight);
            const currentSlot = selection.at(-1);
            drawTree(treeMount, question.tree, currentSlot === undefined ? highlight : { ...highlight, slot: currentSlot }, {
              showSlots: true,
              onSlot: (slot) => {
                if (selection.length >= part.keys.length) return;
                selection.push(slot);
                state.response = selection;
                render();
              },
            });
          }
          field.append(treeMount);
          updateTree();
          field.append(el('p', { class: 'answer-sequence', 'aria-live': 'polite' },
            selection.length === 0 ? 'Placements: none' : `${part.keys.slice(0, selection.length).map((key, i) => `${key} at ${selection[i]?.parent === null ? 'the root' : `${selection[i]?.side} of ${selection[i]?.parent}`}`).join('; ')}`));
          if (selection.length > 0) {
            field.append(el('p', { class: 'flow-feedback', role: 'status', 'aria-live': 'polite' }, sequenceFeedback(part, selection)));
          }
          if (selection.length > 0) {
            const undo = el('button', { type: 'button', class: 'button' }, 'Undo last placement');
            undo.addEventListener('click', () => {
              selection.pop();
              state.response = selection;
              state.confirmed = false;
              render();
            });
            field.append(undo);
          }
        } else {
          const selection = Array.isArray(state.response)
            ? [...state.response] as number[]
            : typeof state.response === 'number' ? [state.response] : [];
          let doneButton: HTMLButtonElement | undefined;
          let undoButton: HTMLButtonElement | undefined;
          let sequenceLabel: HTMLParagraphElement | undefined;
          let feedbackLabel: HTMLParagraphElement | undefined;
          const syncSelectionControls = () => {
            if (doneButton !== undefined) doneButton.disabled = !state.confirmed && selection.length === 0;
            if (undoButton !== undefined) undoButton.disabled = selection.length === 0;
            if (sequenceLabel !== undefined) {
              sequenceLabel.textContent = selection.length === 0 ? 'Selected: none' : `Selected: ${selection.join(', ')}`;
            }
            if (feedbackLabel !== undefined) feedbackLabel.textContent = sequenceFeedback(part, selection);
          };
          if (part.mode === 'set') {
            field.append(el('p', { class: 'question-help' }, 'Select all that apply, then finish your selection.'));
          } else if (part.mode === 'path') {
            field.append(el('p', { class: 'question-help' }, 'Click nodes in the order the operation visits them, then finish your path.'));
          }
          const updateTree = () => drawTree(treeMount, question.tree, copyBase(question, options.highlight), {
            selected: selection,
            numbered: part.mode === 'path',
            showSlots: false,
            onNode: (key) => {
              if (part.mode === 'one') {
                selection.splice(0, selection.length, key);
                state.response = key;
              } else if (!state.confirmed && part.mode === 'set') {
                const at = selection.indexOf(key);
                if (at >= 0) selection.splice(at, 1);
                else selection.push(key);
                state.response = selection;
              } else if (!state.confirmed && part.mode === 'path') {
                selection.push(key);
                state.response = selection;
              }
              syncSelectionControls();
              updateTree();
              refreshSubmit();
            },
          });
          field.append(treeMount);
          updateTree();
          if (part.mode === 'path') {
            feedbackLabel = el('p', { class: 'flow-feedback', role: 'status', 'aria-live': 'polite' }, sequenceFeedback(part, selection));
            field.append(feedbackLabel);
          }
          if (part.mode !== 'one') {
            const action = el('div', { class: 'actions' });
            const done = el('button', { type: 'button', class: 'button' },
              state.confirmed ? part.mode === 'set' ? 'Change selection' : 'Change path' : part.mode === 'set' ? 'Finish selection' : 'Finish path');
            doneButton = done;
            done.disabled = !state.confirmed && selection.length === 0;
            done.addEventListener('click', () => {
              state.confirmed = !state.confirmed;
              state.response = selection;
              render();
            });
            action.append(done);
            if (part.mode === 'path') {
              const undo = el('button', { type: 'button', class: 'button' }, 'Undo last node');
              undoButton = undo;
              undo.disabled = selection.length === 0;
              undo.addEventListener('click', () => {
                selection.pop();
                state.response = selection;
                state.confirmed = false;
                render();
              });
              action.append(undo);
            }
            field.append(action);
            sequenceLabel = el('p', { class: 'answer-sequence', 'aria-live': 'polite' },
              selection.length === 0 ? 'Selected: none' : `Selected: ${selection.join(', ')}`);
            field.append(sequenceLabel);
          }
        }
      }

      fields[index] = field;
    });

    submitButton = el('button', { type: 'submit', class: 'button button--primary' }, 'Check answer');
    const form = el('form', { class: 'question-form' }, ...fields, submitButton);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      refreshSubmit();
      if (submitButton.disabled) return;
      const responses = states.map((state) => state.response);
      if (responses.some((response): response is undefined => response === undefined)) return;
      onSubmit(responses as PartResponse[]);
    });
    container.replaceChildren(form);
    refreshSubmit();
  }

  render();
  return {
    reset() {
      states.forEach((state) => {
        delete state.response;
        state.confirmed = false;
      });
      render();
    },
    destroy() {
      container.replaceChildren();
    },
  };
}
