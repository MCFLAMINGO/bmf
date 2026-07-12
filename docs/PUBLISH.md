# Publish BMF 0.2.0 to npm (Erik)

The GitHub release is already live. npm is blocked only because `secrets.NPM_TOKEN` is empty.
You own the packages as **erikosol** (`@mcflamingo/bmf-sdk` etc.).

## 1. Create an npm granular token (~1 min)

1. Open https://www.npmjs.com/settings/~/tokens / create (or https://www.npmjs.com/settings/erikosol/tokens)
2. **Generate New Token** → **Granular Access Token**
3. Settings that matter:
   - **Token name:** `bmf-github-actions`
   - **Expiration:** 90 days (or custom)
   - **Permissions:** **Read and write**
   - **Scopes / packages:** allow **`@mcflamingo`** (entire scope) — needed so the **new** `@mcflamingo/bmf-node` can publish
   - **Bypass 2FA / automation:** **ON** (required for CI publish)
4. Copy the token once (`npm_…`). Do not commit it.

## 2. Put it in GitHub Actions secrets (~30 sec)

**UI:**  
https://github.com/MCFLAMINGO/bmf/settings/secrets/actions  
→ **New repository secret**  
→ Name: `NPM_TOKEN`  
→ Value: paste token → Save

**or CLI (on your laptop, logged into `gh` as yourself):**

```bash
gh secret set NPM_TOKEN -R MCFLAMINGO/bmf
# paste token, Enter, Ctrl-D
```

## 3. Kick publish

After the secret exists, either:

**A — GitHub UI:**  
Actions → **Publish to npm** → **Run workflow** → branch `main`

**B — Tell the agent “NPM_TOKEN is set”** — we re-push tag `v0.2.0` to re-trigger the workflow.

**C — Your laptop:**

```bash
gh workflow run "Publish to npm" -R MCFLAMINGO/bmf --ref main
gh run watch -R MCFLAMINGO/bmf
```

## 4. Verify

```bash
npm view @mcflamingo/bmf-node version    # expect 0.2.0
npm view @mcflamingo/bmf-sdk version     # expect 0.2.0
npm view @mcflamingo/bmf-cli version
npm view @mcflamingo/bmf-gateway version
```

Install smoke:

```bash
npm install @mcflamingo/bmf-sdk@0.2.0
```

## After 0.2.0 lands (optional hardening)

Configure **Trusted Publishing** on each package (npm → package → Settings → Trusted Publisher) for `MCFLAMINGO/bmf` + workflow `publish.yml`, then you can drop the long-lived token. First publish of a **new** package (`bmf-node`) still needs a token once — that’s this run.
