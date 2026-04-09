/**
 * Drag/drop + optional file input for `.glass_pack`. No network I/O.
 */

export function wirePackFileInput(
  input: HTMLInputElement,
  onFile: (file: File) => void,
): void {
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f && f.name.endsWith(".glass_pack")) {
      onFile(f);
    }
    input.value = "";
  });
}

export function attachPackDropHandlers(
  dropZone: HTMLElement,
  onFile: (file: File) => void,
): void {
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (!f) {
      return;
    }
    if (!f.name.endsWith(".glass_pack")) {
      return;
    }
    onFile(f);
  });
}
