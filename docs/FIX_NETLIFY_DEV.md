# Fixing Netlify Dev Base Directory Issue

If you see errors like:
```
base: /Users/frank/Documents/Coding
publish: /Users/frank/Documents/Coding
functionsDirectory: /Users/frank/Documents/Coding/netlify/functions
```

This means Netlify Dev is detecting the wrong base directory.

## Solution 1: Run from Correct Directory

Make sure you're in the project root:
```bash
cd /Users/frank/Documents/Coding/github/castaway
npm run dev
```

## Solution 2: Use npm start Instead (Recommended)

Just use React directly:
```bash
npm start
```

This avoids all Netlify Dev issues and works perfectly.

## Solution 3: Explicit Base in netlify.toml

The `base = "."` should work, but if not, try removing it and see if Netlify detects correctly.

## Solution 4: Check for Parent netlify.toml

If there's a `netlify.toml` in a parent directory, it might be interfering. Check:
```bash
find .. -name "netlify.toml" -type f
```

