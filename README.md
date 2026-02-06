# Site Rafael

A personal portfolio website built with [Bun](https://bun.com) and [Vite](https://vitejs.dev/).

## Getting Started

To install dependencies:

```bash
bun install
```

To run the development server:

```bash
bun run dev
```

To build for production:

```bash
bun run build
```

To preview the production build:

```bash
bun run preview
```

## Linting and Formatting

To check for code quality issues:

```bash
bun run lint
```

To automatically fix linting issues:

```bash
bun run lint:fix
```

To format code with Prettier:

```bash
bun run format
```

## Cloudflare Worker (Backend)

The backend code lives in `worker-mail/`.

### Deployment Workflow (Critical) ⚠️

To deploy changes to the Worker:

1.  **Commit & Push**: Push your changes to the `worker-prod` branch.
    ```bash
    git checkout worker-prod
    git merge main  # or your feature branch
    git push origin worker-prod
    ```
2.  **Validation**: Both `worker-prod` and `main` branches require the **"TypeCheck Worker"** CI check to pass before merging.
3.  **Automatic Deployment**: Pushing to `worker-prod` triggers the automatic deployment to Cloudflare.

**Note:** If you are blocked by "TypeCheck Worker" on a PR, it means the check hasn't reported a status yet. We have configured it to run on all PRs to avoid this.

