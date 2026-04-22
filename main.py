import sys

from dashboard import serve_dashboard_forever
from tracker import UsageTracker


def main(argv: list[str] | None = None) -> None:
    args = argv if argv is not None else sys.argv[1:]
    if "--serve-dashboard" in args:
        serve_dashboard_forever()
        return

    UsageTracker().run()


if __name__ == "__main__":
    main()
