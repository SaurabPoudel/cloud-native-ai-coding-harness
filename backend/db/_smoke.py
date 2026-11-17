from backend.db import init_schema, create, get_pending, set_status

if __name__ == "__main__":
    init_schema()
    pid = create("smoke", "print hello world")
    print("created:", pid)
    print("pending:", get_pending())
    set_status(pid, "done")
    print("after:", get_pending())