"""Validate the checked-in PCA JSON Schema against a synthetic Browser PCA export.

Requires jsonschema in an isolated validation environment; never reads research files.
"""

import copy
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker, ValidationError


def main(schema_path: str, result_path: str) -> None:
    schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))
    result = json.loads(Path(result_path).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    validator.validate(result)

    for field, value in [("engine", "unknown-engine"), ("schema_version", "flavor-pca-result/99")]:
        bad = copy.deepcopy(result)
        bad[field] = value
        try:
            validator.validate(bad)
        except ValidationError:
            continue
        raise AssertionError(f"JSON Schema accepted invalid {field}")
    print("PASS: Draft 2020-12 schema; synthetic Browser PCA result; invalid engine/version rejected")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
