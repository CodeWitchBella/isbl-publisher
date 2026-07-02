# @isbl/publisher

[![MIT License](https://img.shields.io/npm/l/@isbl/publisher?style=flat)](https://github.com/CodeWitchBella/isbl-publisher/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@isbl/publisher?style=flat)](https://www.npmjs.com/package/@isbl/publisher)
[![dependencies](https://img.shields.io/librariesio/release/npm/@isbl/publisher?style=flat)](https://github.com/CodeWitchBella/isbl-publisher/blob/main/package.json)
![](https://img.shields.io/github/last-commit/CodeWitchBella/isbl-publisher?style=flat)
[![Releases](https://img.shields.io/github/release-date/CodeWitchBella/isbl-publisher?style=flat)](https://github.com/CodeWitchBella/isbl-publisher/releases)

Automates release process. Creates github releases from commit messages and
attaches correct labels. Works both with self-hosted gitlab instances and github.com.

You can see it in action on [release](https://github.com/CodeWitchBella/isbl-publisher/releases)
of this package. It supports yarn (classic and berry) and pnpm out of the box,
and it shouldn't be difficult to adjust for other package managers too.

## Why?

Automate creating changelogs from commit messages. Also creates git tags and
publishes to NPM. All automated in CI. Works both on GitHub and GitLab
(.com or self-hosted). See below for setup.

## How to setup

Run following two commands. It'll ask you a few questions and perform neccessary
changes. Then commit the result and push it.

```
yarn add -D @isbl/publisher
yarn isbl-publisher setup
```

## Manual setup (GitHub)

(see below for automated version using GitHub actions)

Install from npm

```
yarn add -D @isbl/publisher
```

add to your scripts in `package.json`

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/please-replace/with-correct-repo.git"
  },
  "scripts": {
    "prepare": "yarn build",
    "prepublishOnly": "isbl-publisher prepublishOnly"
  }
}
```

### GitHub action

Setup for github (above) and add following to `.github/workflows/release.yml`
file:

```yaml
name: release
on:
  push:
    branches:
      - main
jobs:
  release:
    name: release
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v6
        with:
          node-version: 26
          cache: yarn
          registry-url: 'https://registry.npmjs.org'
      - run: corepack enable yarn
      - run: yarn
      - run: yarn isbl-publisher
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

If you use pnpm instead, use this workflow:

```yaml
name: release
on:
  push:
    branches:
      - main
jobs:
  release:
    name: release
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 26
          cache: pnpm
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install
      - run: pnpm isbl-publisher
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Publishing uses npm's [trusted publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC), so no `NPM_TOKEN` secret is needed. Configure the package as a
trusted publisher for this GitHub Actions workflow under
**Settings > Trusted Publishers** on npmjs.com.

`isbl-publisher publish` picks the package manager based on your project's
[`devEngines`](https://nodejs.org/api/packages.html#devengines) field, e.g.:

```json
{
  "devEngines": {
    "packageManager": {
      "name": "pnpm",
      "version": "^11.9.0",
      "onFail": "download"
    }
  }
}
```

The `packageManager` field (Corepack) is **not** used for detection — if it's
present without a matching `devEngines` entry, publisher prints a warning with
the equivalent `devEngines` JSON to add. If neither is set, it falls back to
detecting a `pnpm-lock.yaml` file, then defaults to yarn.

## Manual setup (GitLab)

Install from npm

```
yarn add -D @isbl/publisher
```

add to your scripts in `package.json`

```json
{
  "repository": {
    "type": "git",
    "url": "https://gitlab.example.com/group/repo.git"
  },
  "scripts": {
    "prepare": "yarn build",
    "prepublishOnly": "isbl-publisher prepublishOnly"
  }
}
```

the `prepublishOnly` script prevents accidental publishes.

## Publishing

Increment version in your `package.json` and push to the main branch.

## Arguments

- `--dry-run` prevents publisher from executing any state-changing commands.
  Useful for debugging and for verification of initial setup.
- `--verbose` prints extra information while running. Does not print secrets, so
  it's safe to use this in CI. But it makes the output harder to read.
- `--ci` simulates running on CI. This is also enabled by CI env variable which
  is set by both gitlab ci and github actions.
- `--no-draft` github CI mode creates release draft by default to allow you to
  manually edit release notes before GitHub sends out emails. This option changes
  that behaviour.

### Environment variables

- `CI` enables CI mode. GitHub actions and GitLab runner set this by default.
- `CORRECT_PUBLISH` publisher sets this and prepublish-only checks for it's
  presence. This is to prevent people from running `yarn publish` directly.
- `npm_package_repository_url` this is set by npm/yarn when running scripts.
- `CI_PROJECT_ID` used in gitlab CI publish. Set by GitLab runner by default.
  Used for finding correct gitlab project when accessing the API.
- `CI_JOB_TOKEN` used in gitlab CI publish. Set by GitLab runner by default.
  Used for accessing the gitlab API.
- `GITHUB_TOKEN` used in github CI publish. Must be set in workflow file.
