from backend.db import init_schema, create, get_pending

if __name__ == "__main__":
    init_schema()
    for i in range(3):
        pid = create(f"smoke-{i}", f"Create a file `out_{i}.txt` with content 'task {i}'. Then finish.")
        print(f"created project {pid}")

    print("\npending now:", [p.id for p in get_pending(limit=10)])
    print("\nNow run (in another terminal): uv run python -m backend.controller._route")
    print("Then inspect:")
    print("  uv run python -c \"from backend.db import get_pending; print('pending:', [p.id for p in get_pending()])\"")