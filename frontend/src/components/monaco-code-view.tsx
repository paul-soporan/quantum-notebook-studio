"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { editor } from "monaco-editor";
import { Box } from "@mui/material";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

function countLines(code: string): number {
  if (code.length === 0) {
    return 1;
  }
  return code.split("\n").length;
}

interface ExplainerLine {
  lineNumber: number;
  indentLen: number;
  prefixLen: number;
}

interface ExplainerBlock {
  startLine: number;
  endLine: number;
  lines: ExplainerLine[];
}

function findExplainerBlocks(code: string): ExplainerBlock[] {
  const lines = code.split("\n");
  const blocks: ExplainerBlock[] = [];

  let activeStart: number | null = null;
  let lastCommentLine: number | null = null;
  let currentBlockLines: ExplainerLine[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const lineContent = lines[index];
    const trimmed = lineContent.trim();
    const isComment = trimmed.startsWith("#");

    if (isComment) {
      if (activeStart === null) {
        activeStart = lineNumber;
      }
      lastCommentLine = lineNumber;

      const indentLen = lineContent.indexOf("#");
      const contentAfterHash = lineContent.substring(indentLen + 1);
      const trimmedContentAfterHash = contentAfterHash.trimStart();
      const prefixLen = lineContent.length - trimmedContentAfterHash.length;

      currentBlockLines.push({ lineNumber, indentLen, prefixLen });
      continue;
    }

    if (activeStart !== null && lastCommentLine !== null) {
      blocks.push({
        startLine: activeStart,
        endLine: lastCommentLine,
        lines: currentBlockLines,
      });
    }

    activeStart = null;
    lastCommentLine = null;
    currentBlockLines = [];
  }

  if (activeStart !== null && lastCommentLine !== null) {
    blocks.push({
      startLine: activeStart,
      endLine: lastCommentLine,
      lines: currentBlockLines,
    });
  }

  return blocks;
}

export function MonacoCodeView({
  code,
  language,
}: {
  code: string;
  language?: string;
}) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  const lineCount = useMemo(() => countLines(code), [code]);
  const explainerBlocks = useMemo(() => findExplainerBlocks(code), [code]);
  const height = useMemo(() => {
    const compactLineHeight = 16;
    return Math.min(420, Math.max(46, lineCount * compactLineHeight + 12));
  }, [lineCount]);

  const options: editor.IStandaloneEditorConstructionOptions = {
    readOnly: true,
    minimap: { enabled: false },
    lineNumbers: "on",
    lineDecorationsWidth: 4,
    glyphMargin: false,
    folding: false,
    scrollBeyondLastLine: false,
    renderLineHighlight: "none",
    renderWhitespace: "none",
    wordWrap: "on",
    automaticLayout: true,
    fontFamily: "var(--font-fira-code)",
    fontSize: 12,
    lineHeight: 16,
    padding: {
      top: 6,
      bottom: 6,
    },
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
  };

  const applyExplainerDecorations = useCallback(
    (monacoEditor: editor.IStandaloneCodeEditor) => {
      const nextDecorations = explainerBlocks.flatMap((block) => {
        const decorations: editor.IModelDeltaDecoration[] = [];

        block.lines.forEach((lineInfo) => {
          const line = lineInfo.lineNumber;
          const isStart = line === block.startLine;
          const isEnd = line === block.endLine;

          let className = "qt-explainer-line";
          if (isStart && isEnd) {
            className += " qt-explainer-single";
          } else if (isStart) {
            className += " qt-explainer-start";
          } else if (isEnd) {
            className += " qt-explainer-end";
          } else {
            className += " qt-explainer-middle";
          }

          // Whole line background and gutter
          decorations.push({
            range: {
              startLineNumber: line,
              startColumn: 1,
              endLineNumber: line,
              endColumn: 1,
            },
            options: {
              isWholeLine: true,
              className,
              linesDecorationsClassName: "qt-explainer-gutter",
            },
          });

          // Prefix hiding (only hide the hash and trailing spaces, preserve indent)
          if (lineInfo.prefixLen > lineInfo.indentLen) {
            decorations.push({
              range: {
                startLineNumber: line,
                startColumn: 1 + lineInfo.indentLen,
                endLineNumber: line,
                endColumn: 1 + lineInfo.prefixLen,
              },
              options: {
                inlineClassName: "qt-explainer-prefix-hide",
              },
            });
          }

          // Spacer to push text away from the highlight (only for non-nested comments)
          if (lineInfo.indentLen === 0) {
            decorations.push({
              range: {
                startLineNumber: line,
                startColumn: 1 + lineInfo.prefixLen,
                endLineNumber: line,
                endColumn: 1 + lineInfo.prefixLen,
              },
              options: {
                beforeContentClassName: "qt-explainer-spacer",
              },
            });
          }
        });

        return decorations;
      });

      decorationIdsRef.current = monacoEditor.deltaDecorations(
        decorationIdsRef.current,
        nextDecorations,
      );
    },
    [explainerBlocks],
  );

  useEffect(() => {
    const monacoEditor = editorRef.current;
    if (!monacoEditor) {
      return;
    }
    applyExplainerDecorations(monacoEditor);
  }, [applyExplainerDecorations]);

  return (
    <Box sx={{ border: "1px solid rgba(145,163,190,0.2)", borderRadius: 2, overflow: "hidden" }}>
      <MonacoEditor
        beforeMount={(monaco) => {
          monaco.editor.defineTheme("qtMonacoDark", {
            base: "vs-dark",
            inherit: true,
            rules: [
              { token: "comment", foreground: "78d68f", fontStyle: "italic" },
              { token: "keyword", foreground: "62d8ff" },
              { token: "string", foreground: "f8cf72" },
            ],
            colors: {
              "editor.background": "#060b13",
              "editorLineNumber.foreground": "#4f607b",
              "editorLineNumber.activeForeground": "#88b2ff",
              "editorGutter.background": "#060b13",
              "editor.selectionBackground": "#193053",
            },
          });
        }}
        language={language || "python"}
        value={code}
        theme="qtMonacoDark"
        options={options}
        height={height}
        onMount={(mountedEditor) => {
          editorRef.current = mountedEditor;
          applyExplainerDecorations(mountedEditor);
        }}
      />
    </Box>
  );
}
