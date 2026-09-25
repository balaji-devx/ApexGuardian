#!/usr/bin/env python3
"""Walk a project tree and combine code/text files into one Markdown document."""

import argparse
import os
import re
import sys

DEFAULT_IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", "venv", ".venv", "env",
    "dist", "build", ".next", ".idea", ".vscode", "target", "bin",
    "obj", ".pytest_cache", ".mypy_cache", "coverage", ".gradle",
    ".cache", "vendor",
}

CODE_EXTS = {
    ".py": "python", ".js": "javascript", ".jsx": "jsx", ".ts": "typescript",
    ".tsx": "tsx", ".java": "java", ".kt": "kotlin", ".swift": "swift",
    ".c": "c", ".h": "c", ".cpp": "cpp", ".hpp": "cpp", ".cs": "csharp",
    ".go": "go", ".rs": "rust", ".rb": "ruby", ".php": "php",
    ".html": "html", ".htm": "html", ".css": "css", ".scss": "scss",
    ".json": "json", ".xml": "xml", ".yaml": "yaml", ".yml": "yaml",
    ".sql": "sql", ".sh": "bash", ".bash": "bash", ".md": "markdown",
    ".dart": "dart", ".m": "objectivec", ".mm": "objectivec",
    ".gradle": "groovy", ".toml": "toml", ".ini": "ini", ".vue": "vue",
    ".r": "r", ".scala": "scala", ".pl": "perl", ".lua": "lua",
    ".dockerfile": "dockerfile", ".txt": "",
}


def collect_files(root, ignore_dirs, extensions, max_size):
    matches = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ignore_dirs and not d.startswith(".git")]
        for fname in sorted(filenames):
            ext = os.path.splitext(fname)[1].lower()
            if fname.lower() == "dockerfile":
                ext = ".dockerfile"
            if extensions is not None and ext not in extensions:
                continue
            if extensions is None and ext not in CODE_EXTS:
                continue
            full = os.path.join(dirpath, fname)
            try:
                if os.path.getsize(full) > max_size:
                    continue
            except OSError:
                continue
            matches.append(full)
    return sorted(matches)


def read_text(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError:
        try:
            with open(path, "r", encoding="latin-1") as f:
                return f.read()
        except Exception:
            return None
    except Exception:
        return None


def build_markdown(root, files):
    lines = [f"# Code dump: `{os.path.abspath(root)}`\n"]
    lines.append(f"Total files: {len(files)}\n")
    lines.append("## Table of contents\n")
    for path in files:
        lines.append(f"- `{os.path.relpath(path, root)}`")
    lines.append("\n---\n")

    for path in files:
        rel = os.path.relpath(path, root)
        ext = os.path.splitext(path)[1].lower()
        if os.path.basename(path).lower() == "dockerfile":
            ext = ".dockerfile"
        lang = CODE_EXTS.get(ext, "")
        content = read_text(path)
        lines.append(f"\n## `{rel}`\n")
        if content is None:
            lines.append("_Could not read file (binary or encoding issue)._\n")
            continue
        longest_fence = max((len(match.group(0)) for match in re.finditer(r"`+", content)), default=0)
        fence = "`" * max(3, longest_fence + 1)
        lines.append(f"{fence}{lang}")
        lines.append(content.rstrip("\n"))
        lines.append(f"{fence}\n")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Dump all code files in a folder into one Markdown file.")
    parser.add_argument("folder", help="Path to the project folder to scan")
    parser.add_argument("-o", "--output", default=None, help="Output .md file path (default: <folder>_dump.md)")
    parser.add_argument("--ext", nargs="*", default=None,
                        help="Only include these extensions (e.g. --ext .py .js). Default: broad built-in code list.")
    parser.add_argument("--ignore-dirs", nargs="*", default=None,
                        help="Extra directory names to skip, in addition to the defaults.")
    parser.add_argument("--max-size", type=int, default=1_000_000,
                        help="Skip files larger than this many bytes (default 1,000,000).")
    args = parser.parse_args()

    root = args.folder
    if not os.path.isdir(root):
        print(f"Error: '{root}' is not a valid directory.", file=sys.stderr)
        sys.exit(1)

    ignore_dirs = set(DEFAULT_IGNORE_DIRS)
    if args.ignore_dirs:
        ignore_dirs.update(args.ignore_dirs)

    extensions = None
    if args.ext:
        extensions = {e if e.startswith(".") else f".{e}" for e in args.ext}

    files = collect_files(root, ignore_dirs, extensions, args.max_size)
    if not files:
        print("No matching files found.", file=sys.stderr)
        sys.exit(0)

    markdown = build_markdown(root, files)
    output_path = args.output or f"{os.path.basename(os.path.abspath(root.rstrip(os.sep)))}_dump.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(markdown)

    print(f"Wrote {len(files)} files -> {output_path}")


if __name__ == "__main__":
    main()
