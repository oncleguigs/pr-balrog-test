# Test correct answer display

This PR tests the new feature: displaying the correct answer when a quiz question is answered correctly.

## What changed

When evaluating a quiz answer:
- ✅ Correct answers now show the answer text below the question
- ❌ Wrong answers still show your submitted answer + explanation

## Expected behavior

```
✅ **1.** What is the purpose of X?
> ↳ Correct answer: **B)** The correct option text here

❌ **2.** What does Y do?
> ↳ You answered <kbd>A</kbd>
> 💡 Explanation of why B was correct
```
