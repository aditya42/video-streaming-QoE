import unittest

from backend.app.qoe import analyze_qoe


class QoeAnalyzerTests(unittest.TestCase):
    def test_passes_healthy_run(self):
        result = analyze_qoe({
            "startupTimeMs": 900,
            "timeToFirstFrameMs": 1000,
            "rebufferingRatio": 0.01,
            "droppedFrameRatio": 0.001,
            "playbackFailures": 0,
            "networkErrorCount": 0,
        })
        self.assertEqual(result["verdict"], "PASS")
        self.assertEqual(result["score"], 100)

    def test_flags_threshold_violations(self):
        result = analyze_qoe({
            "startupTimeMs": 8000,
            "playbackFailures": 1,
        })
        self.assertEqual(result["verdict"], "FAIL")
        self.assertLess(result["score"], 100)
        self.assertEqual(len(result["violations"]), 2)

    def test_allows_threshold_override(self):
        result = analyze_qoe(
            {"startupTimeMs": 6000},
            {"startupTimeMs": 7000},
        )
        self.assertEqual(result["verdict"], "PASS")


if __name__ == "__main__":
    unittest.main()
