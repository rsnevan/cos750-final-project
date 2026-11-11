import './visualiser.css';
import { describe } from '../engine';
import type { Highlight, Side, Step, Tree } from '../engine';
import { layoutTree, type NodePosition, type SlotPosition } from './layout';

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_RADIUS = 25;

export interface DrawTreeOptions {
  readonly onNode?: (key: number) => void;
  readonly onSlot?: (slot: { readonly parent: number | null; readonly side: Side | null }) => void;
  readonly showSlots?: boolean;
  readonly selected?: readonly number[];
  readonly numbered?: boolean;
  readonly animate?: boolean;
}

export interface VisualiserSettings {
  readonly highContrast: boolean;
  readonly readableFont: boolean;
  readonly textSize: 'small' | 'medium' | 'large';
  readonly reducedMotion: boolean;
  readonly narration: boolean;
}

export interface PlayerOptions {
  readonly pseudocode?: readonly string[];
  readonly settings?: Partial<VisualiserSettings>;
  readonly speed?: number;
  readonly onSettingsChange?: (settings: VisualiserSettings) => void;
}

export interface PlayerController {
  back(): void;
  step(): void;
  replay(): void;
  pause(): void;
  getIndex(): number;
  destroy(): void;
}

type ToggleSetting = 'highContrast' | 'readableFont' | 'reducedMotion' | 'narration';

const DEFAULT_SETTINGS: VisualiserSettings = {
  highContrast: false,
  readableFont: false,
  textSize: 'medium',
  reducedMotion: false,
  narration: false,
};

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}

function addSvgText(parent: SVGElement, value: string, x: number, y: number, className: string): SVGTextElement {
  const text = svgElement('text');
  text.textContent = value;
  text.setAttribute('x', String(x));
  text.setAttribute('y', String(y));
  text.setAttribute('class', className);
  parent.append(text);
  return text;
}

function setActivatable(
  element: SVGGElement,
  label: string,
  activate: (() => void) | undefined,
): void {
  if (activate === undefined) return;
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-label', label);
  element.addEventListener('click', activate);
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  });
}

function slotMatches(slot: SlotPosition, highlight: Highlight): boolean {
  return highlight.slot !== undefined && slot.parent === highlight.slot.parent && slot.side === highlight.slot.side;
}

export function drawTree(
  container: Element,
  tree: Tree,
  highlight: Highlight = {},
  options: DrawTreeOptions = {},
): SVGSVGElement {
  const layout = layoutTree(tree);
  const svg = svgElement('svg');
  svg.setAttribute('class', 'bst-visualiser__tree');
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('width', String(layout.width));
  svg.setAttribute('height', String(layout.height));
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', tree === null ? 'Empty binary search tree' : 'Binary search tree');
  if (options.animate) {
    svg.animate(
      [
        { opacity: 0, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 180, easing: 'ease-out' },
    );
  }

  const title = svgElement('title');
  title.textContent = tree === null ? 'Empty binary search tree' : 'Binary search tree';
  svg.append(title);

  const highlightedEdges = new Set((highlight.edges ?? []).map(([parent, child]) => `${parent}:${child}`));
  const edgeLabelMap = new Map<string, string>();
  (highlight.edgeLabels ?? []).forEach(([parent, child, label]) => {
    edgeLabelMap.set(`${parent}:${child}`, label);
  });
  for (const edge of layout.edges) {
    const key = `${edge.parent.key}:${edge.child.key}`;
    const line = svgElement('line');
    line.setAttribute('x1', String(edge.parent.x));
    line.setAttribute('y1', String(edge.parent.y));
    line.setAttribute('x2', String(edge.child.x));
    line.setAttribute('y2', String(edge.child.y));
    line.setAttribute('class', highlightedEdges.has(key)
      ? 'bst-visualiser__edge bst-visualiser__edge--highlighted'
      : 'bst-visualiser__edge');
    svg.append(line);
    const edgeLabel = edgeLabelMap.get(key);
    if (edgeLabel !== undefined) {
      addSvgText(
        svg,
        edgeLabel,
        (edge.parent.x + edge.child.x) / 2,
        (edge.parent.y + edge.child.y) / 2 - 7,
        'bst-visualiser__edge-label',
      );
    }
  }

  const markedSlot = layout.slots.find((slot) => slotMatches(slot, highlight));
  const visibleSlots = options.showSlots || tree === null
    ? layout.slots
    : markedSlot === undefined ? [] : [markedSlot];
  for (const slot of visibleSlots) {
    const active = slotMatches(slot, highlight);
    const group = svgElement('g');
    group.setAttribute('class', active ? 'bst-visualiser__slot bst-visualiser__slot--highlighted' : 'bst-visualiser__slot');
    const parentDescription = slot.parent === null ? 'the empty tree' : `${slot.side} of ${slot.parent}`;
    const label = slot.parent === null ? 'Empty spot in the tree' : `Empty spot ${parentDescription}`;
    const circle = svgElement('circle');
    circle.setAttribute('cx', String(slot.x));
    circle.setAttribute('cy', String(slot.y));
    circle.setAttribute('r', String(active ? 12 : 8));
    circle.setAttribute('class', 'bst-visualiser__slot-circle');
    group.append(circle);
    if (slot.parent === null) {
      addSvgText(group, 'Empty tree', slot.x, slot.y + 25, 'bst-visualiser__slot-label');
    }
    const slotLabel = active ? highlight.slotLabel : undefined;
    if (slotLabel !== undefined) {
      addSvgText(group, slotLabel, slot.x + 14, slot.y + 4, 'bst-visualiser__slot-label');
    }
    setActivatable(
      group,
      slotLabel === undefined ? label : `${label}, ${slotLabel}`,
      options.showSlots && options.onSlot !== undefined
        ? () => options.onSlot?.({ parent: slot.parent, side: slot.side })
        : undefined,
    );
    svg.append(group);
  }

  const visited = new Map<number, number>();
  (highlight.visited ?? []).forEach((key, index) => {
    if (!visited.has(key)) visited.set(key, index + 1);
  });
  const selected = new Set(options.selected ?? []);
  const selectedOrder = new Map<number, number>();
  (options.selected ?? []).forEach((key, index) => {
    if (!selectedOrder.has(key)) selectedOrder.set(key, index + 1);
  });
  const nodesByKey = new Map<number, NodePosition[]>();

  for (const node of layout.nodes) {
    const classNames = ['bst-visualiser__node'];
    if (highlight.current === node.key) classNames.push('bst-visualiser__node--current');
    if (highlight.found === node.key) classNames.push('bst-visualiser__node--found');
    if (highlight.offender === node.key) classNames.push('bst-visualiser__node--offender');
    if (highlight.outlined?.includes(node.key)) classNames.push('bst-visualiser__node--outlined');
    if (highlight.dimmed?.includes(node.key)) classNames.push('bst-visualiser__node--dimmed');
    if (highlight.ghost === node.key) classNames.push('bst-visualiser__node--ghost');
    if (selected.has(node.key)) classNames.push('bst-visualiser__node--selected');

    const group = svgElement('g');
    group.setAttribute('class', classNames.join(' '));
    group.setAttribute('data-key', String(node.key));
    const displayedKey = highlight.relabel?.[node.key] ?? node.key;
    const status = [
      highlight.current === node.key ? 'current' : undefined,
      highlight.found === node.key ? 'found' : undefined,
      highlight.offender === node.key ? 'violates the BST rule' : undefined,
      highlight.dimmed?.includes(node.key) ? 'ruled out' : undefined,
      visited.has(node.key) ? `visit ${visited.get(node.key)}` : undefined,
      selected.has(node.key) ? 'selected' : undefined,
      options.numbered && selectedOrder.has(node.key) ? `pick ${selectedOrder.get(node.key)}` : undefined,
      highlight.ghost === node.key ? 'to be removed' : undefined,
      highlight.dots === 'all' ? 'pre-order, in-order, and post-order markers'
        : highlight.dots !== undefined ? `${highlight.dots}-order marker` : undefined,
      highlight.tags?.[node.key],
    ].filter((part): part is string => part !== undefined);
    const nodeLabel = `Node ${displayedKey}${status.length > 0 ? `, ${status.join(', ')}` : ''}`;
    const circle = svgElement('circle');
    circle.setAttribute('cx', String(node.x));
    circle.setAttribute('cy', String(node.y));
    circle.setAttribute('r', String(NODE_RADIUS));
    circle.setAttribute('class', 'bst-visualiser__node-circle');
    group.append(circle);
    if (highlight.found === node.key) {
      const ring = svgElement('circle');
      ring.setAttribute('cx', String(node.x));
      ring.setAttribute('cy', String(node.y));
      ring.setAttribute('r', String(NODE_RADIUS + 5));
      ring.setAttribute('class', 'bst-visualiser__found-ring');
      group.append(ring);
    }
    addSvgText(group, String(displayedKey), node.x, node.y + 6, 'bst-visualiser__node-key');
    const originalKey = highlight.relabel?.[node.key];
    if (originalKey !== undefined) {
      const oldKey = addSvgText(group, String(node.key), node.x, node.y - 7, 'bst-visualiser__relabelled-key');
      oldKey.setAttribute('text-decoration', 'line-through');
    }
    if (highlight.ghost === node.key) {
      addSvgText(group, 'to be removed', node.x, node.y + NODE_RADIUS + 15, 'bst-visualiser__ghost-label');
    }
    const visitNumber = visited.get(node.key);
    if (visitNumber !== undefined) {
      const badge = svgElement('circle');
      badge.setAttribute('cx', String(node.x - NODE_RADIUS + 2));
      badge.setAttribute('cy', String(node.y - NODE_RADIUS + 1));
      badge.setAttribute('r', '10');
      badge.setAttribute('class', 'bst-visualiser__visit-badge');
      group.append(badge);
      addSvgText(group, String(visitNumber), node.x - NODE_RADIUS + 2, node.y - NODE_RADIUS + 5, 'bst-visualiser__visit-number');
    }
    const pickNumber = options.numbered ? selectedOrder.get(node.key) : undefined;
    if (pickNumber !== undefined) {
      const badge = svgElement('circle');
      badge.setAttribute('cx', String(node.x + NODE_RADIUS - 2));
      badge.setAttribute('cy', String(node.y + NODE_RADIUS - 1));
      badge.setAttribute('r', '10');
      badge.setAttribute('class', 'bst-visualiser__pick-badge');
      group.append(badge);
      addSvgText(group, String(pickNumber), node.x + NODE_RADIUS - 2, node.y + NODE_RADIUS + 3, 'bst-visualiser__pick-number');
    }
    const tag = highlight.tags?.[node.key];
    if (tag !== undefined) {
      addSvgText(group, tag, node.x + NODE_RADIUS + 7, node.y + 4, 'bst-visualiser__tag');
    }
    if (highlight.offender === node.key) {
      addSvgText(group, 'x', node.x + NODE_RADIUS - 2, node.y - NODE_RADIUS + 6, 'bst-visualiser__offender-mark');
    }
    if (highlight.dots === 'all' || highlight.dots !== undefined) {
      const positions = highlight.dots === 'all' ? ['pre', 'in', 'post'] as const : [highlight.dots];
      positions.forEach((position) => {
        const dot = svgElement('circle');
        dot.setAttribute('r', '3');
        dot.setAttribute('class', 'bst-visualiser__traversal-dot');
        if (position === 'pre') {
          dot.setAttribute('cx', String(node.x - 16));
          dot.setAttribute('cy', String(node.y - 17));
        } else if (position === 'in') {
          dot.setAttribute('cx', String(node.x));
          dot.setAttribute('cy', String(node.y + 19));
        } else {
          dot.setAttribute('cx', String(node.x + 16));
          dot.setAttribute('cy', String(node.y - 17));
        }
        dot.setAttribute('aria-label', `${position}-order marker`);
        group.append(dot);
      });
    }
    const nodeTitle = svgElement('title');
    nodeTitle.textContent = nodeLabel;
    group.prepend(nodeTitle);
    setActivatable(group, nodeLabel, options.onNode === undefined ? undefined : () => options.onNode?.(node.key));
    const sameKey = nodesByKey.get(node.key) ?? [];
    sameKey.push(node);
    nodesByKey.set(node.key, sameKey);
    svg.append(group);
  }

  if (highlight.marker !== undefined) {
    const target = nodesByKey.get(highlight.marker.key)?.[0];
    if (target !== undefined) {
      const marker = svgElement('g');
      marker.setAttribute('class', 'bst-visualiser__marker');
      const offset = highlight.marker.position === 'pre' ? -NODE_RADIUS - 9
        : highlight.marker.position === 'in' ? 0
          : NODE_RADIUS + 9;
      const markerText = addSvgText(
        marker,
        'v',
        target.x + offset,
        highlight.marker.position === 'in' ? target.y + NODE_RADIUS + 15 : target.y - NODE_RADIUS - 5,
        'bst-visualiser__marker-label',
      );
      markerText.setAttribute('aria-label', `${highlight.marker.position}-order traversal marker`);
      svg.append(marker);
    }
  }

  if (highlight.output !== undefined) {
    const output = document.createElement('p');
    output.className = 'bst-visualiser__output';
    output.textContent = `Traversal so far: ${highlight.output.join(', ') || 'none'}`;
    container.replaceChildren(svg, output);
  } else {
    container.replaceChildren(svg);
  }
  return svg;
}

function button(label: string, className = ''): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  return element;
}

function createSetting(
  fieldset: HTMLFieldSetElement,
  name: ToggleSetting,
  labelText: string,
  settings: VisualiserSettings,
  onChange: (name: keyof VisualiserSettings, value: boolean | VisualiserSettings['textSize']) => void,
): void {
  const label = document.createElement('label');
  label.className = 'bst-visualiser__setting';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = settings[name];
  input.addEventListener('change', () => onChange(name, input.checked));
  label.append(input, document.createTextNode(labelText));
  fieldset.append(label);
}

export function createPlayer(
  container: Element,
  steps: readonly Step[],
  options: PlayerOptions = {},
): PlayerController {
  if (steps.length === 0) {
    throw new RangeError('The visualiser player needs at least one step');
  }

  let index = 0;
  let speed = options.speed ?? 1;
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new RangeError(`Playback speed must be greater than zero, but got ${speed}`);
  }
  const prefersReducedMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let settings: VisualiserSettings = {
    ...DEFAULT_SETTINGS,
    reducedMotion: prefersReducedMotion,
    ...options.settings,
  };
  let timer: ReturnType<typeof globalThis.setInterval> | undefined;

  const root = document.createElement('section');
  root.className = 'bst-visualiser';
  root.setAttribute('aria-label', 'Tree animation player');
  root.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight Home');
  root.tabIndex = 0;
  const keyboardHelp = document.createElement('p');
  keyboardHelp.className = 'bst-visualiser__keyboard-help';
  keyboardHelp.textContent = 'Keyboard shortcuts: Left arrow for Back, Right arrow for Step, Home to return to the first step.';

  const treeMount = document.createElement('div');
  treeMount.className = 'bst-visualiser__canvas';
  const caption = document.createElement('p');
  caption.className = 'bst-visualiser__caption';
  const liveRegion = document.createElement('div');
  liveRegion.className = 'bst-visualiser__sr-only';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  const counter = document.createElement('p');
  counter.className = 'bst-visualiser__counter';
  const controls = document.createElement('div');
  controls.className = 'bst-visualiser__controls';
  const backButton = button('Back');
  const stepButton = button('Step');
  const replayButton = button('Replay');
  const pauseButton = button('Play');
  const speedLabel = document.createElement('label');
  speedLabel.textContent = 'Speed ';
  const speedSelect = document.createElement('select');
  speedSelect.setAttribute('aria-label', 'Playback speed');
  const speedOptions: { value: number; label: string }[] = [
    { value: 0.6, label: 'Slow' },
    { value: 1, label: 'Normal' },
    { value: 1.8, label: 'Fast' },
  ];
  if (!speedOptions.some(({ value }) => value === speed)) {
    speedOptions.push({ value: speed, label: `${speed}x` });
  }
  for (const { value, label } of speedOptions) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = label;
    option.selected = value === speed;
    speedSelect.append(option);
  }
  speedLabel.append(speedSelect);
  controls.append(backButton, stepButton, replayButton, pauseButton, speedLabel);

  const settingsFieldset = document.createElement('fieldset');
  settingsFieldset.className = 'bst-visualiser__settings';
  const settingsLegend = document.createElement('legend');
  settingsLegend.textContent = 'Display and narration settings';
  settingsFieldset.append(settingsLegend);
  const settingsLabels: readonly [ToggleSetting, string][] = [
    ['highContrast', 'High contrast'],
    ['readableFont', 'Readable font'],
    ['reducedMotion', 'Reduced motion'],
    ['narration', 'Read captions aloud'],
  ];
  const textSizeLabel = document.createElement('label');
  textSizeLabel.className = 'bst-visualiser__setting';
  textSizeLabel.append(document.createTextNode('Text size '));
  const textSizeSelect = document.createElement('select');
  textSizeSelect.setAttribute('aria-label', 'Text size');
  for (const size of ['small', 'medium', 'large'] as const) {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size.charAt(0).toUpperCase() + size.slice(1);
    option.selected = size === settings.textSize;
    textSizeSelect.append(option);
  }
  textSizeSelect.addEventListener('change', () => {
    const size = textSizeSelect.value;
    if (size === 'small' || size === 'medium' || size === 'large') {
      changeSetting('textSize', size);
    }
  });
  textSizeLabel.append(textSizeSelect);
  settingsFieldset.append(textSizeLabel);

  const textDetails = document.createElement('details');
  textDetails.className = 'bst-visualiser__tree-text';
  const textSummary = document.createElement('summary');
  textSummary.textContent = 'Show the tree as text';
  const textContent = document.createElement('div');
  textDetails.append(textSummary, textContent);

  let pseudocodePanel: HTMLOListElement | undefined;
  if (options.pseudocode !== undefined) {
    const details = document.createElement('details');
    details.className = 'bst-visualiser__pseudocode';
    const summary = document.createElement('summary');
    summary.textContent = 'Show pseudocode';
    pseudocodePanel = document.createElement('ol');
    pseudocodePanel.className = 'bst-visualiser__pseudocode-lines';
    for (const line of options.pseudocode) {
      const item = document.createElement('li');
      item.textContent = line;
      pseudocodePanel.append(item);
    }
    details.append(summary, pseudocodePanel);
    root.append(details);
  }

  root.append(keyboardHelp, treeMount, caption, liveRegion, counter, controls, settingsFieldset, textDetails);
  container.replaceChildren(root);

  function applySettings(): void {
    root.classList.toggle('bst-visualiser--high-contrast', settings.highContrast);
    root.classList.toggle('bst-visualiser--readable-font', settings.readableFont);
    root.classList.toggle('bst-visualiser--text-small', settings.textSize === 'small');
    root.classList.toggle('bst-visualiser--text-large', settings.textSize === 'large');
    root.classList.toggle('bst-visualiser--reduced-motion', settings.reducedMotion);
  }

  function changeSetting(
    name: keyof VisualiserSettings,
    value: boolean | VisualiserSettings['textSize'],
  ): void {
    settings = { ...settings, [name]: value };
    applySettings();
    options.onSettingsChange?.(settings);
    if (name === 'narration' && value === false && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  settingsLabels.forEach(([name, label]) => createSetting(settingsFieldset, name, label, settings, changeSetting));

  function stopPlayback(): void {
    if (timer !== undefined) {
      globalThis.clearInterval(timer);
      timer = undefined;
    }
  }

  function render(): void {
    const current = steps[index];
    if (current === undefined) {
      throw new Error(`Animation step ${index} is missing`);
    }
    drawTree(treeMount, current.tree, current.highlight, { animate: !settings.reducedMotion });
    caption.textContent = current.text;
    liveRegion.textContent = current.text;
    counter.textContent = `Step ${index + 1} of ${steps.length}`;
    backButton.disabled = index === 0;
    stepButton.disabled = index === steps.length - 1;
    if (pseudocodePanel !== undefined) {
      Array.from(pseudocodePanel.children).forEach((line, lineIndex) => {
        if (lineIndex === current.line) line.setAttribute('aria-current', 'step');
        else line.removeAttribute('aria-current');
      });
    }
    textContent.replaceChildren(...describe(current.tree).map((sentence) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = sentence;
      return paragraph;
    }));
    if (settings.narration && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(current.text));
    }
  }

  function back(): void {
    stopPlayback();
    pauseButton.textContent = 'Play';
    if (index > 0) {
      index -= 1;
      render();
    }
  }

  function step(): void {
    stopPlayback();
    pauseButton.textContent = 'Play';
    if (index < steps.length - 1) {
      index += 1;
      render();
    }
  }

  function pause(): void {
    stopPlayback();
    pauseButton.textContent = 'Resume';
  }

  function startPlayback(): void {
    if (index >= steps.length - 1) {
      index = 0;
      render();
    }
    if (steps.length === 1) {
      pauseButton.textContent = 'Replay';
      return;
    }
    pauseButton.textContent = 'Pause';
    timer = globalThis.setInterval(() => {
      if (index >= steps.length - 1) {
        stopPlayback();
        pauseButton.textContent = 'Replay';
        return;
      }
      index += 1;
      render();
    }, 1100 / speed);
  }

  function replay(): void {
    stopPlayback();
    index = 0;
    render();
    startPlayback();
  }

  backButton.addEventListener('click', back);
  stepButton.addEventListener('click', step);
  replayButton.addEventListener('click', replay);
  pauseButton.addEventListener('click', () => {
    if (timer === undefined) startPlayback();
    else pause();
  });
  speedSelect.addEventListener('change', () => {
    speed = Number(speedSelect.value);
    if (timer !== undefined) {
      stopPlayback();
      startPlayback();
    }
  });

  root.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button, input, select, summary, [contenteditable="true"]')) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      back();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step();
    } else if (event.key === 'Home') {
      event.preventDefault();
      stopPlayback();
      index = 0;
      render();
    }
  });

  applySettings();
  render();

  return {
    back,
    step,
    replay,
    pause,
    getIndex: () => index,
    destroy: () => {
      stopPlayback();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      root.remove();
    },
  };
}
