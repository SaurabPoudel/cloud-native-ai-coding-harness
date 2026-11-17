from backend.harness._LLM_client import LLMClient, BudgetExceeded, Budget

if __name__ == "__main__":
    c = LLMClient()
    r = c.chat([{"role": "user", "content": "Say 'ok' and nothing else."}])
    print("content:", r["choices"][0]["message"]["content"])
    print("tokens: ", r["usage"]["total_tokens"])
    print("budget: ", c.budget)

    tiny = LLMClient(budget=Budget(max_tokens=5, max_calls=1))
    try:
        tiny.chat([{"role": "user", "content": "hi"}])
    except BudgetExceeded as e:
        print("✅ BudgetExceeded caught:", e)