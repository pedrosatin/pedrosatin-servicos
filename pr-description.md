💡 **What:**
Extracted the `table` constant out of the `identifyProvider` function into a module-scoped constant called `PROVIDER_TABLE`.

🎯 **Why:**
The `table` array contained 17 distinct `RegExp` objects along with their corresponding string names. Inside the function body, it was being fully reinstantiated on every single function call. By pulling this array out to the module scope, the JavaScript engine evaluates it only once. This avoids redundant memory allocations, array instantiation, and regex compilation overhead, leading to faster execution.

📊 **Measured Improvement:**
In a local benchmark of 1,000,000 runs using 3 test cases, the execution time decreased from **~4728.58ms** to **~2705.87ms**. This represents an execution time reduction of roughly **42.7%** (or about a **1.74x** speedup) on the tested inputs.
