import type { NotebookDocument, NotebookOutput } from "@/lib/notebook-types";

interface PersistedCellState {
  execution_count: number | null;
  outputs: NotebookOutput[];
}

interface PersistedNotebookState {
  version: 1;
  notebookId: string;
  updatedAt: string;
  cells: PersistedCellState[];
}

const STORAGE_PREFIX = "qt.notebook-runtime";

function getStorageKey(notebookId: string): string {
  return `${STORAGE_PREFIX}:${notebookId}`;
}

export function cloneNotebook<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadPersistedNotebookState(
  notebookId: string,
  baselineNotebook: NotebookDocument,
): NotebookDocument {
  if (typeof window === "undefined") {
    return baselineNotebook;
  }

  const storageKey = getStorageKey(notebookId);
  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) {
    return baselineNotebook;
  }

  try {
    const parsed = JSON.parse(rawValue) as PersistedNotebookState;
    if (parsed.version !== 1 || parsed.notebookId !== notebookId || !Array.isArray(parsed.cells)) {
      return baselineNotebook;
    }

    if (parsed.cells.length !== baselineNotebook.cells.length) {
      return baselineNotebook;
    }

    const merged = cloneNotebook(baselineNotebook);
    merged.cells = merged.cells.map((cell, index) => {
      const persistedCell = parsed.cells[index];
      if (!persistedCell || cell.cell_type !== "code") {
        return cell;
      }

      return {
        ...cell,
        execution_count: persistedCell.execution_count,
        outputs: Array.isArray(persistedCell.outputs) ? persistedCell.outputs : [],
      };
    });

    return merged;
  } catch {
    return baselineNotebook;
  }
}

export function persistNotebookState(notebookId: string, notebook: NotebookDocument): void {
  if (typeof window === "undefined") {
    return;
  }

  const data: PersistedNotebookState = {
    version: 1,
    notebookId,
    updatedAt: new Date().toISOString(),
    cells: notebook.cells.map((cell) => ({
      execution_count: cell.cell_type === "code" ? cell.execution_count ?? null : null,
      outputs: cell.cell_type === "code" ? cell.outputs ?? [] : [],
    })),
  };

  window.localStorage.setItem(getStorageKey(notebookId), JSON.stringify(data));
}

export function clearPersistedNotebookState(notebookId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(getStorageKey(notebookId));
}
