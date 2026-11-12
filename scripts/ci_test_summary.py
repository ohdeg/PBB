"""Write the Gradle test totals and failed test names to a GitHub job summary."""

from html import escape
from pathlib import Path
import sys
import xml.etree.ElementTree as ET


def summarize(directory):
    reports = sorted(directory.glob("TEST-*.xml"))
    print("### Backend tests\n")
    if not reports:
        print("No JUnit XML reports were produced. See the Gradle step log.")
        return

    failures = []
    total = skipped = 0
    for report in reports:
        for case in ET.parse(report).iter("testcase"):
            total += 1
            if case.find("skipped") is not None:
                skipped += 1
            for error in [*case.findall("failure"), *case.findall("error")]:
                name = f"{case.get('classname')} > {case.get('name')}"
                failures.append(f"{name} ({error.get('type', 'unknown')})")
                break

    print(f"{total} tests, {len(failures)} failed, {skipped} skipped.")
    if failures:
        print("<pre>" + escape("\n".join(failures)) + "</pre>")


if __name__ == "__main__":
    summarize(Path(sys.argv[1]))
