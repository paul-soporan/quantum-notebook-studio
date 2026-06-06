import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExecuteRequestBody {
  mode: "cell" | "run_all";
  cellIndex?: number;
  cells: Array<{
    cell_type: string;
    source: string[] | string;
  }>;
}

function resolvePythonExecutable(): string {
  const candidates = [
    process.env.QT_NOTEBOOK_PYTHON,
    path.resolve(process.cwd(), "../.venv/bin/python"),
    path.resolve(process.cwd(), "../../.venv/bin/python"),
    "python3",
    "python",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (!candidate.includes(path.sep)) {
      return candidate;
    }

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python3";
}

async function runExecutor(body: ExecuteRequestBody): Promise<unknown> {
  const python = resolvePythonExecutable();
  const scriptPath = path.resolve(process.cwd(), "scripts/notebook_server_executor.py");

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Notebook executor script is missing at ${scriptPath}`);
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(python, [scriptPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Server notebook execution timed out after 10 minutes."));
    }, 10 * 60 * 1000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(
          new Error(
            `Notebook executor exited with code ${code}. ${stderr.trim() || "No stderr output."}`,
          ),
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `Notebook executor returned invalid JSON. ${(error as Error).message}\nOutput:\n${stdout}\nStderr:\n${stderr}`,
          ),
        );
      }
    });

    child.stdin.write(JSON.stringify(body));
    child.stdin.end();
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ExecuteRequestBody;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    if (!Array.isArray(body.cells)) {
      return NextResponse.json({ ok: false, error: "The request must include cells." }, { status: 400 });
    }

    if (!["cell", "run_all"].includes(body.mode)) {
      return NextResponse.json({ ok: false, error: `Unsupported mode: ${String(body.mode)}` }, { status: 400 });
    }

    if (body.mode === "cell" && typeof body.cellIndex !== "number") {
      return NextResponse.json(
        { ok: false, error: "mode=cell requires an integer cellIndex." },
        { status: 400 },
      );
    }

    const result = await runExecutor(body);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
