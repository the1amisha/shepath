"""Verify selected evidence exports before starting a hosted worker."""
from app.route_evidence import load_engine


if __name__ == '__main__':
    dataset = load_engine().PilotDataset.load()
    print(f'Verified evidence dataset: {len(dataset._projected)} features', flush=True)
