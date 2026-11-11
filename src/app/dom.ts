// Small helper for building screens without innerHTML (no injection risk).
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (name === 'class') node.className = value;
    else node.setAttribute(name, value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}
