# 02 — GitHub API Layer

**What to build:** A server-side module that wraps the GitHub Contents API. Provides three operations used by all other tickets: list a folder's files, read a single file's content, and write (create or update) a file. All calls are authenticated with the `GITHUB_PAT` env var. This is the only data layer in the app — no database.

**Blocked by:** 01 — scaffold must exist.

- [ ] Implement `listFolder(path)` — returns array of `{ name, path, sha }` for all `.md` files in a folder
- [ ] Implement `readFile(path)` — returns raw file content + sha
- [ ] Implement `writeFile(path, content, sha?)` — creates or updates a file, commits to repo
- [ ] Parse frontmatter from raw content (YAML between `---`) into structured object
- [ ] Return file body (content minus frontmatter) separately from parsed frontmatter
- [ ] Handle GitHub API errors gracefully (404, rate limit, auth failure)
