import unittest
import numpy as np
from train import CONSENT, QUESTIONS, DESIGN, normalize, prepare, evaluate, fit


class PreferenceTests(unittest.TestCase):
    def test_consent_and_nonchoices(self):
        row = {normalize(CONSENT): 'Yes'}
        for q, a in zip(QUESTIONS, ['Route A', 'Route B', '', 'No preference', 'Cannot decide with this information', '']):
            row[normalize(q)] = a
        samples, counts = prepare([row, {**row, normalize(CONSENT): 'No'}])
        self.assertEqual(samples, [(1, 0, 1), (1, 1, 0)])
        self.assertEqual(counts['missing'], 2)
        self.assertEqual(counts['no_preference'], 1)
        self.assertEqual(counts['uncertain'], 1)
        self.assertEqual(counts['excluded_without_consent'], 1)

    def test_unknown_choice_rejected(self):
        with self.assertRaises(ValueError):
            prepare([{normalize(CONSENT): 'Yes', normalize(QUESTIONS[0]): 'Maybe A'}])

    def test_symmetry(self):
        model = fit(DESIGN, np.array([0,1,0,1,1,1]))
        np.testing.assert_allclose(model.predict_proba(DESIGN)[:,1],
                                   1-model.predict_proba(-DESIGN)[:,1])

    def test_evaluation_keeps_groups_and_baseline_out_of_sample(self):
        # Each submission answers the same scenario twice. Held-out labels must
        # not enter the scenario frequency; otherwise the baseline is too good.
        samples = [(1,0,1),(1,0,1),(2,0,0),(2,0,0),(3,0,1),(3,0,0)]
        report, _ = evaluate(samples)
        self.assertEqual([f['choices'] for f in report['folds']], [2,2,2])
        self.assertAlmostEqual(report['scenario_baseline']['accuracy'], 1/6)


if __name__ == '__main__':
    unittest.main()
