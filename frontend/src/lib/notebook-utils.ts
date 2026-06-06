export interface CodeExplainerResult {
  explainers: string[];
  code: string;
}

export function normalizeSource(source: string[] | string | undefined): string {
  if (!source) {
    return "";
  }

  if (Array.isArray(source)) {
    return source
      .map((line) => line.replace(/\r?\n$/, ""))
      .join("\n");
  }

  return source.replace(/\r\n/g, "\n");
}

export function splitCodeExplainers(rawCode: string): CodeExplainerResult {
  const lines = rawCode.split("\n");
  const explainers: string[] = [];
  let activeExplainerLines: string[] = [];
  const codeLines: string[] = [];

  const flushExplainer = (): void => {
    if (activeExplainerLines.length === 0) {
      return;
    }

    while (activeExplainerLines.length > 0 && activeExplainerLines[0].trim() === "") {
      activeExplainerLines.shift();
    }

    while (
      activeExplainerLines.length > 0 &&
      activeExplainerLines[activeExplainerLines.length - 1].trim() === ""
    ) {
      activeExplainerLines.pop();
    }

    if (activeExplainerLines.length > 0) {
      explainers.push(activeExplainerLines.join("\n"));
    }

    activeExplainerLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("#")) {
      const cleaned = trimmed.replace(/^#+\s?/, "").trim();
      activeExplainerLines.push(cleaned);
      continue;
    }

    if (trimmed.length === 0 && activeExplainerLines.length > 0) {
      activeExplainerLines.push("");
      continue;
    }

    flushExplainer();

    codeLines.push(line);
  }

  flushExplainer();

  return {
    explainers,
    code: codeLines.join("\n").trimEnd(),
  };
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    if (error.stack && error.stack.length > 0) {
      return `${error.name}: ${error.message}\n${error.stack}`;
    }
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

export function toText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join("\n");
  }

  if (typeof value === "string") {
    return value;
  }

  if (value == null) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
