PYTHON ?= python3

.PHONY: test package

test:
	uv run --with pyyaml $(PYTHON) tests/test_package.py -v

package:
	$(PYTHON) scripts/build_package.py
