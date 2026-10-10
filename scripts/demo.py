"""Build the UI and serve the cached-data demo at one local address."""

import argparse
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-build", action="store_true", help="Reuse frontend/dist for an offline demo")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    if not args.skip_build:
        npm = shutil.which("npm.cmd") or shutil.which("npm")
        if not npm:
            raise SystemExit("Node/npm is required to build. Install dependencies with npm ci in frontend/.")
        subprocess.run([npm, "run", "build"], cwd=ROOT / "frontend", check=True)
    if not (ROOT / "frontend" / "dist" / "index.html").is_file():
        raise SystemExit("Missing frontend/dist. Run npm run build in frontend/ first.")
    sys.path.insert(0, str(ROOT / "backend"))
    import uvicorn

    print(f"Demo: http://127.0.0.1:{args.port} - Ctrl+C to stop", flush=True)
    uvicorn.run("app.main:app", host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
