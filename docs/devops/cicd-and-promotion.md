# CI/CD and Promotion Policy

This repository uses GitHub Actions for CI and Cloudflare Workers for deployment.

## Pipelines

- `CI` (`.github/workflows/ci.yml`): runs on pull requests and `main` pushes.
- `Deploy` (`.github/workflows/deploy.yml`): handles deployments and environment promotion.

## Environment Flow

Promotion path:

1. `development`
2. `staging`
3. `production`

Rules:

- Pushes to `main` automatically deploy to `development`.
- `staging` and `production` deployments are manual via `workflow_dispatch`.
- Configure required reviewers on GitHub Environments (`staging`, `production`) to enforce approval gates.

## Deploy Workflow Inputs

Manual deploy requires:

- `target_environment`: one of `development`, `staging`, `production`
- `source_ref`: branch, tag, or commit SHA to deploy (default: `main`)

The workflow:

1. Verifies quality gates (lint + typecheck + build dependency).
2. Deploys `user-application` and `data-service`.
3. Suffixes worker names with the target environment:
   - `tanstack-start-app-<environment>`
   - `saas-kit-data-service-<environment>`

## Required GitHub Secrets

Set these in repository/environment secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

You can scope secrets per environment so production credentials are only available in the `production` environment.

## Operational Notes

- Use branch protection on `main` so all PRs pass `CI` before merge.
- Treat deployment from `source_ref` as immutable artifact promotion. Prefer promoting the same commit from `development` to `staging` to `production`.
