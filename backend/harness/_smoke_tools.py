from backend.harness._tools import TOOLS
import json

if __name__ == "__main__":
    assert isinstance(TOOLS, list), "TOOLS must be a list"
    assert len(TOOLS) == 4, f"expected 4 tools, got {len(TOOLS)}"

    names = [t["function"]["name"] for t in TOOLS]
    assert names == ["bash", "read_file", "write_file", "finish"], names

    for t in TOOLS:
        fn = t["function"]
        assert t["type"] == "function"
        assert isinstance(fn["description"], str) and len(fn["description"]) > 80, \
            f"{fn['name']}: description too short — LLM will misbehave"
        assert "parameters" in fn
        assert "required" in fn["parameters"]
        for req in fn["parameters"]["required"]:
            assert req in fn["parameters"]["properties"], \
                f"{fn['name']}: required field '{req}' has no schema"

    print(f"✅ {len(TOOLS)} tools validated")
    for t in TOOLS:
        fn = t["function"]
        print(f"   • {fn['name']:<12}  req={fn['parameters']['required']}")

    # Full JSON dump — inspect this yourself to see what the LLM sees
    print("\n── full schema sent to LLM ──")
    print(json.dumps(TOOLS, indent=2))