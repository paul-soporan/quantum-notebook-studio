"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import useScrollTrigger from "@mui/material/useScrollTrigger";
import Fade from "@mui/material/Fade";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import ClearAllRounded from "@mui/icons-material/ClearAllRounded";
import RestoreRounded from "@mui/icons-material/RestoreRounded";
import SmartToyRounded from "@mui/icons-material/SmartToyRounded";
import GitHub from "@mui/icons-material/GitHub";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Toolbar,
  Typography,
  IconButton,
} from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { MonacoCodeView } from "@/components/monaco-code-view";
import { AppFooter } from "@/components/app-footer";
import {
  clearPersistedNotebookState,
  cloneNotebook,
  loadPersistedNotebookState,
  persistNotebookState,
} from "@/lib/notebook-state";
import type {
  NotebookCatalogEntry,
  NotebookCell,
  NotebookDocument,
  NotebookOutput,
} from "@/lib/notebook-types";
import { formatUnknownError, normalizeSource, toText } from "@/lib/notebook-utils";

interface RuntimeNotebook extends Omit<NotebookDocument, "cells"> {
  cells: RuntimeCell[];
}

interface RuntimeCell extends NotebookCell {
  execution_count: number | null;
  outputs: NotebookOutput[];
}

type ExecutorPhase = "stopped" | "busy" | "ready" | "error";

interface ServerCellExecutionResult {
  status: "ok" | "error";
  executionCount: number | null;
  outputs: NotebookOutput[];
  errorMessage?: string | null;
}

interface ServerRunAllCellResult {
  cellIndex: number;
  status: "ok" | "error";
  executionCount: number | null;
  outputs: NotebookOutput[];
  errorMessage?: string | null;
}

interface ServerRunAllResult {
  status: "ok" | "error";
  cells: ServerRunAllCellResult[];
  errorCellIndex?: number | null;
  errorMessage?: string | null;
}

interface ServerResponse<T> {
  ok: boolean;
  mode: string;
  result?: T;
  error?: string;
}

function hydrateNotebook(document: NotebookDocument): RuntimeNotebook {
  return {
    ...document,
    cells: document.cells.map((cell) => ({
      ...cell,
      source: Array.isArray(cell.source) ? cell.source : [String(cell.source ?? "")],
      execution_count: cell.execution_count ?? null,
      outputs: cell.outputs ?? [],
    })),
  };
}

function clearNotebookState<T extends NotebookDocument | RuntimeNotebook>(doc: T): T {
  return {
    ...doc,
    cells: doc.cells.map((cell) => ({
      ...cell,
      execution_count: null,
      outputs: [],
    })),
  };
}

function buildExecutionCells(notebook: RuntimeNotebook): Array<{ cell_type: string; source: string[] }> {
  return notebook.cells.map((cell) => ({
    cell_type: cell.cell_type,
    source: cell.source,
  }));
}

function OutputView({ output }: { output: NotebookOutput }) {
  if (output.output_type === "stream") {
    return (
      <Box
        sx={{
          borderRadius: 2,
          px: 2,
          py: 1.4,
          bgcolor: output.name === "stderr" ? "rgba(248,113,113,0.12)" : "rgba(90,215,255,0.09)",
          border: "1px solid",
          borderColor: output.name === "stderr" ? "rgba(248,113,113,0.25)" : "rgba(90,215,255,0.25)",
          fontFamily: "var(--font-fira-code), monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 13,
        }}
      >
        {toText(output.text)}
      </Box>
    );
  }

  if (output.output_type === "error") {
    return (
      <Box
        sx={{
          borderRadius: 2,
          px: 2,
          py: 1.4,
          bgcolor: "rgba(248,113,113,0.12)",
          border: "1px solid rgba(248,113,113,0.25)",
        }}
      >
        <Typography variant="subtitle2" color="error.light" sx={{ mb: 1 }}>
          {output.ename}: {output.evalue}
        </Typography>
        <Typography
          component="pre"
          sx={{
            m: 0,
            fontFamily: "var(--font-fira-code), monospace",
            whiteSpace: "pre-wrap",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {output.traceback.join("\n")}
        </Typography>
      </Box>
    );
  }

  const data = output.data || {};

  const markdown = data["text/markdown"];
  if (typeof markdown === "string" && markdown.trim().length > 0) {
    return (
      <Box
        sx={{
          borderRadius: 2,
          px: 2,
          py: 1.4,
          border: "1px solid rgba(145,163,190,0.22)",
          bgcolor: "rgba(9,14,23,0.6)",
        }}
      >
        <MarkdownCellView source={markdown} />
      </Box>
    );
  }

  const png = data["image/png"];
  if (typeof png === "string") {
    return (
      <Box
        component="img"
        alt="Notebook output"
        src={`data:image/png;base64,${png}`}
        sx={{
          width: "100%",
          maxHeight: 480,
          objectFit: "contain",
          borderRadius: 2,
          border: "1px solid rgba(145,163,190,0.22)",
          bgcolor: "rgba(0,0,0,0.22)",
          p: 1,
        }}
      />
    );
  }

  const html = data["text/html"];
  if (typeof html === "string") {
    return (
      <Box
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid rgba(145,163,190,0.22)",
          bgcolor: "rgba(0,0,0,0.22)",
        }}
      >
        <iframe
          title="HTML output"
          sandbox=""
          srcDoc={`<html><body style='margin:0;padding:12px;background:#0d1623;color:#e5ebf5;font-family:system-ui'>${html}</body></html>`}
          style={{ width: "100%", minHeight: 120, border: "none" }}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        borderRadius: 2,
        px: 2,
        py: 1.4,
        border: "1px solid rgba(145,163,190,0.22)",
        bgcolor: "rgba(9,14,23,0.6)",
      }}
    >
      <Typography
        component="pre"
        sx={{
          m: 0,
          fontFamily: "var(--font-fira-code), monospace",
          whiteSpace: "pre-wrap",
          fontSize: 12.5,
        }}
      >
        {toText(data["text/plain"] ?? data)}
      </Typography>
    </Box>
  );
}

function MarkdownCellView({ source }: { source: string }) {
  return (
    <Box
      sx={{
        "& h1, & h2, & h3": {
          mt: 1.3,
          mb: 0.8,
          lineHeight: 1.2,
        },
        "& p": {
          color: "text.secondary",
          lineHeight: 1.72,
          mb: 1.2,
        },
        "& code": {
          px: 0.5,
          py: 0.15,
          borderRadius: 0.7,
          bgcolor: "rgba(90,215,255,0.12)",
          fontFamily: "var(--font-fira-code), monospace",
        },
        "& pre": {
          p: 1.2,
          borderRadius: 1.3,
          overflowX: "auto",
          bgcolor: "rgba(7,11,18,0.8)",
          border: "1px solid rgba(145,163,190,0.2)",
        },
        "& ul, & ol": {
          pl: 3,
          color: "text.secondary",
        },
        "& blockquote": {
          borderLeft: "4px solid rgba(90,215,255,0.5)",
          pl: 1.5,
          my: 1.2,
          color: "text.secondary",
          fontStyle: "italic",
        },
        "& a": {
          color: "primary.light",
          textDecoration: "none",
          "&:hover": {
            textDecoration: "underline",
          },
        },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {source}
      </ReactMarkdown>
    </Box>
  );
}

function CellOutputs({ outputs, executionCount }: { outputs: NotebookOutput[]; executionCount?: number | null }) {
  if (outputs.length === 0) {
    if (executionCount) {
      return null;
    }
    return (
      <Box
        sx={{
          border: "1px dashed rgba(145,163,190,0.3)",
          borderRadius: 2,
          px: 1.8,
          py: 1.1,
          color: "text.secondary",
          fontSize: 13,
        }}
      >
        No output yet.
      </Box>
    );
  }

  return (
    <Stack spacing={1.1} sx={{ px: { xs: 0.3, md: 0.6 } }}>
      {outputs.map((output, index) => (
        <OutputView key={index} output={output} />
      ))}
    </Stack>
  );
}

export function NotebookRuntimePage({ notebookMeta }: { notebookMeta: NotebookCatalogEntry }) {
  const [notebook, setNotebook] = useState<RuntimeNotebook | null>(null);
  const [isLoadingNotebook, setIsLoadingNotebook] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [executorPhase, setExecutorPhase] = useState<ExecutorPhase>("stopped");
  const [executorError, setExecutorError] = useState<string | null>(null);
  const [runningCellIndex, setRunningCellIndex] = useState<number | null>(null);
  const [runAllInProgress, setRunAllInProgress] = useState(false);

  const codeCellCount = useMemo(() => {
    if (!notebook) {
      return 0;
    }
    return notebook.cells.filter((cell) => cell.cell_type === "code").length;
  }, [notebook]);

  useEffect(() => {
    let isMounted = true;

    const loadNotebook = async () => {
      setIsLoadingNotebook(true);
      setLoadingError(null);

      try {
        const response = await fetch(`/notebooks/${notebookMeta.filename}`);
        if (!response.ok) {
          throw new Error(`Unable to load ${notebookMeta.filename}`);
        }

        const parsed = (await response.json()) as NotebookDocument;
        const baseline = clearNotebookState(hydrateNotebook(parsed));
        const withPersistedState = hydrateNotebook(
          loadPersistedNotebookState(notebookMeta.id, baseline),
        );

        if (!isMounted) {
          return;
        }

        setNotebook(withPersistedState);
        setExecutorPhase("ready");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setNotebook(null);
        setExecutorPhase("error");
        setLoadingError(formatUnknownError(error));
      } finally {
        if (isMounted) {
          setIsLoadingNotebook(false);
        }
      }
    };

    void loadNotebook();

    return () => {
      isMounted = false;
    };
  }, [notebookMeta.filename, notebookMeta.id]);

  useEffect(() => {
    if (!notebook) {
      return;
    }

    persistNotebookState(notebookMeta.id, notebook);
  }, [notebookMeta.id, notebook]);

  const executeCell = useCallback(
    async (cellIndex: number) => {
      if (!notebook || runningCellIndex !== null || runAllInProgress) {
        return;
      }

      const cell = notebook.cells[cellIndex];
      if (!cell || cell.cell_type !== "code") {
        return;
      }

      setRunningCellIndex(cellIndex);
      setExecutorPhase("busy");
      setExecutorError(null);

      try {
        setNotebook((previous) => {
          if (!previous) {
            return previous;
          }

          const cells = [...previous.cells];
          const target = cells[cellIndex];
          if (!target || target.cell_type !== "code") {
            return previous;
          }

          cells[cellIndex] = {
            ...target,
            outputs: [],
          };

          return { ...previous, cells };
        });

        const response = await fetch("/api/notebook/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "cell",
            cellIndex,
            cells: buildExecutionCells(notebook),
          }),
        });

        const payload = (await response.json()) as ServerResponse<ServerCellExecutionResult>;
        if (!response.ok || !payload.ok || !payload.result) {
          throw new Error(payload.error || "Server execution failed.");
        }

        const result = payload.result;

        setNotebook((previous) => {
          if (!previous) {
            return previous;
          }

          const cells = [...previous.cells];
          const target = cells[cellIndex];
          if (!target || target.cell_type !== "code") {
            return previous;
          }

          cells[cellIndex] = {
            ...target,
            outputs: result.outputs,
            execution_count: result.executionCount,
          };

          return { ...previous, cells };
        });

        if (result.status === "error") {
          setExecutorPhase("error");
          setExecutorError(
            `Execution failed in cell ${cellIndex + 1}:\n${result.errorMessage || "Unknown execution failure"}`,
          );
          return;
        }

        setExecutorPhase("ready");
      } catch (error) {
        setExecutorPhase("error");
        setExecutorError(`Execution failed in cell ${cellIndex + 1}:\n${formatUnknownError(error)}`);
      } finally {
        setRunningCellIndex(null);
      }
    },
    [notebook, runAllInProgress, runningCellIndex],
  );

  const runAllCodeCells = useCallback(async () => {
    if (!notebook || runAllInProgress || runningCellIndex !== null) {
      return;
    }

    setRunAllInProgress(true);
    setExecutorPhase("busy");
    setExecutorError(null);

    try {
      setNotebook((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          cells: previous.cells.map((cell) =>
            cell.cell_type === "code"
              ? {
                  ...cell,
                  outputs: [],
                  execution_count: null,
                }
              : cell,
          ),
        };
      });

      const response = await fetch("/api/notebook/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "run_all",
          cells: buildExecutionCells(notebook),
        }),
      });

      const payload = (await response.json()) as ServerResponse<ServerRunAllResult>;
      if (!response.ok || !payload.ok || !payload.result) {
        throw new Error(payload.error || "Run all failed on server.");
      }

      const result = payload.result;
      const resultByCell = new Map(result.cells.map((item) => [item.cellIndex, item]));

      setNotebook((previous) => {
        if (!previous) {
          return previous;
        }

        const cells = previous.cells.map((cell, index) => {
          if (cell.cell_type !== "code") {
            return cell;
          }

          const update = resultByCell.get(index);
          if (!update) {
            return {
              ...cell,
              outputs: [],
              execution_count: null,
            };
          }

          return {
            ...cell,
            outputs: update.outputs,
            execution_count: update.executionCount,
          };
        });

        return { ...previous, cells };
      });

      if (result.status === "error") {
        setExecutorPhase("error");
        const cellNumber =
          typeof result.errorCellIndex === "number" ? result.errorCellIndex + 1 : "unknown";
        setExecutorError(
          `Run all stopped at cell ${cellNumber}:\n${result.errorMessage || "Unknown execution failure"}`,
        );
        return;
      }

      setExecutorPhase("ready");
    } catch (error) {
      setExecutorPhase("error");
      setExecutorError(`Run all failed:\n${formatUnknownError(error)}`);
    } finally {
      setRunAllInProgress(false);
    }
  }, [notebook, runAllInProgress, runningCellIndex]);

  const clearAllOutputs = useCallback(() => {
    setNotebook((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        cells: previous.cells.map((cell) =>
          cell.cell_type === "code"
            ? {
                ...cell,
                outputs: [],
                execution_count: null,
              }
            : cell,
        ),
      };
    });
  }, []);

  const isScrolled = useScrollTrigger({
    disableHysteresis: true,
    threshold: 180,
  });

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#090f19" }}>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{
          borderBottom: "1px solid rgba(145,163,190,0.2)",
          backdropFilter: "blur(12px)",
          background: "rgba(9, 15, 25, 0.88)",
          zIndex: 1100,
        }}
      >
        <Toolbar
          variant="dense"
          sx={{
            minHeight: "56px !important",
            px: { xs: 1.2, md: 2.2 },
            display: "flex",
            gap: 1.5,
          }}
        >
          <Button
            component={Link}
            href="/"
            size="small"
            startIcon={<ArrowBackRounded />}
            sx={{ flexShrink: 0 }}
          >
            Notebooks
          </Button>

          <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {notebookMeta.title}
            </Typography>

            <Fade in={isScrolled}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ClearAllRounded />}
                  disabled={!notebook || isLoadingNotebook}
                  onClick={clearAllOutputs}
                  sx={{ py: 0.4 }}
                >
                  Clear
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={
                    runAllInProgress ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <PlayArrowRounded />
                    )
                  }
                  disabled={
                    !notebook || runAllInProgress || runningCellIndex !== null || isLoadingNotebook
                  }
                  onClick={() => {
                    void runAllCodeCells();
                  }}
                  sx={{ py: 0.4 }}
                >
                  Run All
                </Button>
              </Box>
            </Fade>
          </Box>

          <Fade in={isScrolled}>
            <Chip
              size="small"
              icon={<SmartToyRounded />}
              label={`Executor: ${executorPhase}`}
              color={
                executorPhase === "ready"
                  ? "success"
                  : executorPhase === "busy"
                    ? "warning"
                    : executorPhase === "error"
                      ? "error"
                      : "default"
              }
              sx={{ display: { xs: "none", sm: "flex" } }}
            />
          </Fade>

          <IconButton
            href="https://github.com/paul-soporan/quantum-notebook-studio"
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            color="inherit"
            sx={{ opacity: 0.8, "&:hover": { opacity: 1 } }}
          >
            <GitHub fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Toolbar variant="dense" sx={{ minHeight: "56px !important" }} />

      <Container maxWidth="lg" sx={{ py: 2.2, mb: 3, flexGrow: 1 }}>
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ px: 2.8, py: 2.4, borderColor: "rgba(145,163,190,0.2)" }}>
            <Stack spacing={0.8}>
              <Typography variant="h5" sx={{ fontSize: { xs: "1.2rem", md: "1.5rem" } }}>
                {notebookMeta.title}
              </Typography>
              <Typography color="text.secondary">{notebookMeta.description}</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                <Chip label={`${codeCellCount} executable code cells`} size="small" />
                <Chip label={`${notebook?.cells.length ?? 0} total cells`} size="small" />
                {notebookMeta.tags.map((tag) => (
                  <Chip key={`${notebookMeta.id}-${tag}`} label={tag} size="small" variant="outlined" />
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: "center" }}>
            <Button
              variant="outlined"
              startIcon={<ClearAllRounded />}
              disabled={!notebook || isLoadingNotebook}
              onClick={clearAllOutputs}
              size="small"
            >
              Clear Outputs
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={
                runAllInProgress ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <PlayArrowRounded />
                )
              }
              disabled={!notebook || runAllInProgress || runningCellIndex !== null || isLoadingNotebook}
              onClick={() => {
                void runAllCodeCells();
              }}
            >
              Run All
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Chip
              size="small"
              icon={<SmartToyRounded />}
              label={`Executor: ${executorPhase}`}
              color={
                executorPhase === "ready"
                  ? "success"
                  : executorPhase === "busy"
                    ? "warning"
                    : executorPhase === "error"
                      ? "error"
                      : "default"
              }
            />
          </Stack>

          {loadingError ? (
            <Alert severity="error">
              <Typography component="pre" sx={{ m: 0, whiteSpace: "pre-wrap" }}>
                {loadingError}
              </Typography>
            </Alert>
          ) : null}

          {executorError ? (
            <Alert severity="error">
              <Typography component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", fontSize: 12.5 }}>
                {executorError}
              </Typography>
            </Alert>
          ) : null}

          {isLoadingNotebook ? (
            <Paper variant="outlined" sx={{ p: 3.5, borderColor: "rgba(145,163,190,0.2)" }}>
              <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
                <CircularProgress size={20} />
                <Typography>Loading notebook...</Typography>
              </Stack>
            </Paper>
          ) : null}

          {notebook ? (
            <Stack spacing={1.4}>
              {notebook.cells.map((cell, index) => {
                const source = normalizeSource(cell.source);

                if (cell.cell_type === "markdown") {
                  return (
                    <Paper
                      key={`${cell.metadata?.id ?? "md"}-${index}`}
                      variant="outlined"
                      sx={{
                        px: 2.2,
                        py: 1.6,
                        borderColor: "rgba(145,163,190,0.2)",
                      }}
                    >
                      <Stack spacing={1.1}>
                        <Typography variant="subtitle2" sx={{ fontSize: 15 }}>
                          Markdown Cell {index + 1}
                        </Typography>
                        <MarkdownCellView source={source} />
                      </Stack>
                    </Paper>
                  );
                }

                return (
                  <Paper
                    key={`${cell.metadata?.id ?? "code"}-${index}`}
                    variant="outlined"
                    sx={{
                      px: 2.2,
                      py: 1.6,
                      borderColor:
                        runningCellIndex === index ? "primary.main" : "rgba(145,163,190,0.2)",
                    }}
                  >
                    <Stack spacing={1.1}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{
                          alignItems: { xs: "flex-start", sm: "center" },
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontSize: 15 }}>
                          Code Cell {index + 1}
                          {cell.execution_count ? ` | In [${cell.execution_count}]` : ""}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={
                            runningCellIndex === index ? (
                              <CircularProgress size={14} />
                            ) : (
                              <PlayArrowRounded fontSize="small" />
                            )
                          }
                          disabled={runningCellIndex !== null || runAllInProgress || isLoadingNotebook}
                          onClick={() => {
                            void executeCell(index);
                          }}
                        >
                          Run Cell
                        </Button>
                      </Stack>

                      <MonacoCodeView
                        code={source || "# This cell is empty."}
                        language={cell.metadata?.language ? String(cell.metadata.language) : "python"}
                      />

                      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.6, px: 0.4 }}>
                        OUTPUT
                      </Typography>
                      <CellOutputs outputs={cell.outputs} executionCount={cell.execution_count} />
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          ) : null}
        </Stack>
      </Container>

      <AppFooter />
    </Box>
  );
}
