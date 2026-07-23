/**
 * Minimal `document` stub so UI scripts that do top-level
 * `document.getElementById(...)` (e.g. settings.js) can be imported in
 * plain Node without crashing. It intentionally does nothing beyond that -
 * it exists to make pure helper functions in those files importable, not to
 * support DOM rendering/interaction tests.
 */
export function installDomStub() {
  const stubElement = {
    addEventListener() {},
    classList: { add() {}, remove() {}, contains: () => false },
    style: {},
    querySelectorAll: () => [],
    appendChild() {},
    reset() {}
  };

  globalThis.document = {
    getElementById: () => stubElement,
    querySelectorAll: () => [],
    createElement: () => ({ ...stubElement }),
    addEventListener() {},
    body: { appendChild() {} }
  };
}
