#!/usr/bin/env python3
import ast
import base64
import builtins
import contextlib
import io
import json
import sys
import traceback
from typing import Any, Dict, List, Tuple

SENTINEL = object()

# Global state to track the active output collector
_ACTIVE_OUTPUTS: List[Dict[str, Any]] = []


def normalize_source(source: Any) -> str:
    if source is None:
        return ""

    if isinstance(source, list):
        normalized: List[str] = []
        for entry in source:
            text = str(entry)
            if text.endswith("\r\n"):
                text = text[:-2]
            elif text.endswith("\n"):
                text = text[:-1]
            normalized.append(text)
        return "\n".join(normalized)

    return str(source).replace("\r\n", "\n")


def collect_matplotlib_outputs(outputs: List[Dict[str, Any]]) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        figure_numbers = list(plt.get_fignums())
        for number in figure_numbers:
            figure = plt.figure(number)
            buffer = io.BytesIO()
            figure.savefig(buffer, format="png", bbox_inches="tight")
            outputs.append(
                {
                    "output_type": "display_data",
                    "data": {
                        "image/png": base64.b64encode(buffer.getvalue()).decode("ascii"),
                    },
                    "metadata": {},
                }
            )
        plt.close("all")
    except Exception:
        return


def get_rich_data(obj: Any) -> Dict[str, Any]:
    if obj is None:
        return {}

    # Check for matplotlib Figure first to avoid generic repr()
    try:
        obj_type = type(obj)
        if obj_type.__name__ == "Figure" and "matplotlib" in obj_type.__module__:
            buffer = io.BytesIO()
            obj.savefig(buffer, format="png", bbox_inches="tight")
            data = {"text/plain": repr(obj), "image/png": base64.b64encode(buffer.getvalue()).decode("ascii")}

            # Close it so collect_matplotlib_outputs doesn't see it
            try:
                import matplotlib.pyplot as plt
                plt.close(obj)
            except Exception:
                pass
            return data
    except Exception:
        pass

    data = {"text/plain": repr(obj)}

    # Try _repr_mimebundle_
    if hasattr(obj, "_repr_mimebundle_"):
        try:
            bundle = obj._repr_mimebundle_(include=[], exclude=[])
            if isinstance(bundle, tuple):
                bundle = bundle[0]
            if isinstance(bundle, dict):
                for mime, val in bundle.items():
                    if (mime == "image/png" or mime == "image/jpeg") and isinstance(val, bytes):
                        data[mime] = base64.b64encode(val).decode("ascii")
                    else:
                        data[mime] = val
                return data
        except Exception:
            pass

    # Standard IPython-style rich display methods
    for mime, attr in [
        ("text/markdown", "_repr_markdown_"),
        ("text/html", "_repr_html_"),
        ("text/latex", "_repr_latex_"),
        ("application/json", "_repr_json_"),
        ("image/png", "_repr_png_"),
        ("image/jpeg", "_repr_jpeg_"),
        ("image/svg+xml", "_repr_svg_"),
    ]:
        try:
            method = getattr(obj, attr, None)
            if method and callable(method):
                res = method()
                if res is not None:
                    if isinstance(res, tuple):
                        res = res[0]
                    if (mime == "image/png" or mime == "image/jpeg") and isinstance(res, bytes):
                        data[mime] = base64.b64encode(res).decode("ascii")
                    else:
                        data[mime] = res
        except Exception:
            continue

    return data


def execute_source(source: str, env: Dict[str, Any], outputs: List[Dict[str, Any]]) -> Dict[str, Any]:
    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()

    expr_result: Any = SENTINEL
    status = "ok"
    error_output: Dict[str, Any] | None = None
    error_message: str | None = None

    try:
        with contextlib.redirect_stdout(stdout_buffer), contextlib.redirect_stderr(stderr_buffer):
            parsed = ast.parse(source, mode="exec")

            if parsed.body and isinstance(parsed.body[-1], ast.Expr):
                body = parsed.body[:-1]
                if body:
                    exec(compile(ast.Module(body=body, type_ignores=[]), "<cell>", "exec"), env, env)

                expression = ast.Expression(parsed.body[-1].value)
                expr_result = eval(compile(expression, "<cell>", "eval"), env, env)
            else:
                exec(compile(parsed, "<cell>", "exec"), env, env)
    except Exception as error:  # noqa: BLE001
        status = "error"
        tb_lines = traceback.format_exception(type(error), error, error.__traceback__)
        error_output = {
            "output_type": "error",
            "ename": type(error).__name__,
            "evalue": str(error),
            "traceback": [line.rstrip("\n") for line in tb_lines],
        }
        error_message = f"{type(error).__name__}: {error}"

    stdout_text = stdout_buffer.getvalue()
    stderr_text = stderr_buffer.getvalue()

    if stdout_text:
        outputs.append({"output_type": "stream", "name": "stdout", "text": stdout_text})

    if stderr_text:
        outputs.append({"output_type": "stream", "name": "stderr", "text": stderr_text})

    if status == "ok" and expr_result is not SENTINEL and expr_result is not None:
        rich_data = get_rich_data(expr_result)
        # If it's just plain text and it matches the repr of a Figure, we might have already captured it.
        # But get_rich_data already handles closing and capturing figures.
        outputs.append(
            {
                "output_type": "execute_result",
                "execution_count": None,
                "data": rich_data,
                "metadata": {},
            }
        )

    collect_matplotlib_outputs(outputs)

    if error_output is not None:
        outputs.append(error_output)

    return {
        "status": status,
        "outputs": outputs,
        "errorMessage": error_message,
    }


class Markdown:
    def __init__(self, data: str):
        self.data = str(data)
    def _repr_markdown_(self) -> str:
        return self.data
    def __repr__(self) -> str:
        return f"<IPython.core.display.Markdown object>"


def display_func(*args: Any, **kwargs: Any) -> None:
    # Always use the current active output list
    for arg in args:
        rich_data = get_rich_data(arg)
        if rich_data:
            _ACTIVE_OUTPUTS.append(
                {
                    "output_type": "display_data",
                    "data": rich_data,
                    "metadata": {},
                }
            )


def setup_execution_env() -> Dict[str, Any]:
    # Inject into builtins so it's globally available and preferred
    builtins.display = display_func
    builtins.Markdown = Markdown

    env: Dict[str, Any] = {
        "display": display_func,
        "Markdown": Markdown,
    }

    try:
        import IPython.display
        IPython.display.display = display_func
        IPython.display.Markdown = Markdown
    except Exception:
        pass

    return env


def execute_cell(cells: List[Dict[str, Any]], cell_index: int) -> Dict[str, Any]:
    global _ACTIVE_OUTPUTS

    if cell_index < 0 or cell_index >= len(cells):
        return {"status": "error", "executionCount": None, "outputs": [], "errorMessage": "Cell index is out of range."}

    target_cell = cells[cell_index]
    if str(target_cell.get("cell_type", "")) != "code":
        return {"status": "error", "executionCount": None, "outputs": [], "errorMessage": "Selected cell is not a code cell."}

    env: Dict[str, Any] = {"__name__": "__main__"}
    setup_env = setup_execution_env()
    env.update(setup_env)

    execution_count = 0

    for index, cell in enumerate(cells):
        if str(cell.get("cell_type", "")) != "code":
            continue

        source = normalize_source(cell.get("source"))
        if source.strip() == "":
            if index == cell_index:
                return {"status": "ok", "executionCount": None, "outputs": [], "errorMessage": None}
            continue

        execution_count += 1

        # Isolation: Use a fresh list for every cell and set it as active
        cell_outputs: List[Dict[str, Any]] = []
        _ACTIVE_OUTPUTS = cell_outputs

        result = execute_source(source, env, cell_outputs)

        if index < cell_index and result["status"] == "error":
            return {
                "status": "error",
                "executionCount": execution_count,
                "outputs": list(result["outputs"]), # Clone the list
                "errorMessage": (
                    f"Preceding code cell {index + 1} failed while rebuilding state.\n"
                    f"{result.get('errorMessage') or 'Unknown execution error.'}"
                ),
            }

        if index == cell_index:
            return {
                "status": result["status"],
                "executionCount": execution_count,
                "outputs": list(result["outputs"]), # Clone the list
                "errorMessage": result.get("errorMessage"),
            }

    return {"status": "error", "executionCount": None, "outputs": [], "errorMessage": "Unable to execute the selected code cell."}


def execute_run_all(cells: List[Dict[str, Any]]) -> Dict[str, Any]:
    global _ACTIVE_OUTPUTS

    env: Dict[str, Any] = {"__name__": "__main__"}
    setup_env = setup_execution_env()
    env.update(setup_env)

    execution_count = 0
    cell_results: List[Dict[str, Any]] = []

    error_cell_index: int | None = None
    error_message: str | None = None

    for index, cell in enumerate(cells):
        if str(cell.get("cell_type", "")) != "code":
            continue

        source = normalize_source(cell.get("source"))
        if source.strip() == "":
            cell_results.append({"cellIndex": index, "status": "ok", "executionCount": None, "outputs": [], "errorMessage": None})
            continue

        execution_count += 1

        # Isolation: Use a fresh list for every cell and set it as active
        cell_outputs: List[Dict[str, Any]] = []
        _ACTIVE_OUTPUTS = cell_outputs

        result = execute_source(source, env, cell_outputs)

        cell_results.append(
            {
                "cellIndex": index,
                "status": result["status"],
                "executionCount": execution_count,
                "outputs": list(result["outputs"]), # Store a clone
                "errorMessage": result.get("errorMessage"),
            }
        )

        if result["status"] == "error":
            error_cell_index = index
            error_message = result.get("errorMessage") or "Unknown execution error."
            break

    return {
        "status": "error" if error_cell_index is not None else "ok",
        "cells": cell_results,
        "errorCellIndex": error_cell_index,
        "errorMessage": error_message,
    }


def respond(payload: Dict[str, Any]) -> None:
    sys.stdout.buffer.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
    sys.stdout.buffer.flush()


def main() -> None:
    try:
        raw = sys.stdin.buffer.read().decode("utf-8")
        request = json.loads(raw)
    except Exception as error:  # noqa: BLE001
        respond({"ok": False, "error": f"Invalid JSON request: {error}"})
        return

    mode = request.get("mode")
    cells = request.get("cells")

    if not isinstance(cells, list):
        respond({"ok": False, "error": "The request must include a cells array."})
        return

    try:
        if mode == "cell":
            cell_index = request.get("cellIndex")
            if not isinstance(cell_index, int):
                respond({"ok": False, "error": "mode=cell requires an integer cellIndex."})
                return
            result = execute_cell(cells, cell_index)
            respond({"ok": True, "mode": "cell", "result": result})
            return
        if mode == "run_all":
            result = execute_run_all(cells)
            respond({"ok": True, "mode": "run_all", "result": result})
            return
        respond({"ok": False, "error": f"Unsupported mode: {mode}"})
    except Exception as error:  # noqa: BLE001
        respond({"ok": False, "error": f"Execution failed: {error}", "traceback": traceback.format_exception(type(error), error, error.__traceback__)})


if __name__ == "__main__":
    main()
