from __future__ import annotations

import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


def load_module(relative_path: str, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, ROOT / relative_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


class PriceExtractorTests(unittest.TestCase):
    def test_bmw_extract_prices(self):
        bmw = load_module("skills/BMW/fetch_price.py", "bmw_skill")
        text = "建议零售价 ¥299,900 起，另有 RMB 35.5万 版本。"
        self.assertEqual(bmw.extract_prices(text), ["¥299,900", "RMB 35.5万"])

    def test_benz_extract_prices(self):
        benz = load_module("skills/Benz/fetch_price_dynamic.py", "benz_skill")
        text = "官方指导价 ￥459,900 元，入门版 RMB 38万。"
        self.assertEqual(benz.extract_prices(text), ["￥459,900 元", "RMB 38万"])


if __name__ == "__main__":
    unittest.main()
