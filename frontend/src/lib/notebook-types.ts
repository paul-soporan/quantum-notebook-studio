export type NotebookCellType = "code" | "markdown";

export interface NotebookCell {
  cell_type: NotebookCellType;
  metadata?: {
    id?: string;
    language?: string;
    [key: string]: unknown;
  };
  source: string[];
  execution_count?: number | null;
  outputs?: NotebookOutput[];
}

export interface NotebookDocument {
  cells: NotebookCell[];
  metadata?: Record<string, unknown>;
  nbformat?: number;
  nbformat_minor?: number;
}

export interface NotebookCatalogEntry {
  id: string;
  title: string;
  filename: string;
  subtitle: string;
  description: string;
  tags: string[];
}

export type NotebookOutput =
  | {
      output_type: "stream";
      name?: "stdout" | "stderr" | string;
      text: string | string[];
    }
  | {
      output_type: "display_data" | "execute_result";
      data: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      execution_count?: number | null;
    }
  | {
      output_type: "error";
      ename: string;
      evalue: string;
      traceback: string[];
    };
