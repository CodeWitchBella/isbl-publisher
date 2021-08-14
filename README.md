# @isbl/publisher

[![MIT License](https://img.shields.io/npm/l/@isbl/publisher?style=for-the-badge)](https://github.com/CodeWitchBella/isbl-publisher/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@isbl/publisher?style=for-the-badge)](https://www.npmjs.com/package/@isbl/publisher)
[![dependencies](https://img.shields.io/david/CodeWitchBella/isbl-publisher?style=for-the-badge)](https://github.com/CodeWitchBella/isbl-publisher/blob/main/package.json)
![GitHub last commit](https://img.shields.io/github/last-commit/CodeWitchBella/isbl-publisher?style=for-the-badge)
[![GitHub Release Date](https://img.shields.io/github/release-date/CodeWitchBella/isbl-publisher?style=for-the-badge)](https://github.com/CodeWitchBella/isbl-publisher/releases)

Automates release process. Creates github releases from commit messages and
attaches correct labels. Works both with self-hosted gitlab instances and github.com.

You can see it in action on [release](https://github.com/CodeWitchBella/isbl-publisher/releases)
of this package. It currently assumes that you use yarn classic, but it shouldn't
be difficult to adjust for other package managers too.

## Why?

Automate creating changelogs from commit messages. Also creates git tags and
publishes to NPM. All either from command line or CI. Works both on GitHub and
GitLab (.com or self-hosted). See below for setup.

## How to setup (GitHub)

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
    "prepublishOnly": "isbl-publisher prepublishOnly",
    "publish:npm": "yarn build && isbl-publisher publish"
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
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v2
        with:
          node-version: 14
          cache: yarn
          registry-url: 'https://registry.npmjs.org'
      - run: yarn
      - run: yarn publish:npm --verbose
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Run `npm token create` to create your npm token. Create repository secret in
**Settings > Secrets** named `NPM_TOKEN` with contents of your secret.

## How to setup (GitLab)

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
    "prepublishOnly": "isbl-publisher prepublishOnly",
    "publish:npm": "yarn build && isbl-publisher publish $HOME/.gitlab-token"
  }
}
```

You need to generate gitlab token which has API access to create the release via
API.

## Publishing

If you have CI setup, just increment version in your `package.json` and push to
the main branch.

Otherwise run `yarn publish:npm`. You can also run `yarn publish:npm --dry-run`
to see commands which would be executed.

Example output

```
Current version: 0.1.7
New version: 0.2.0
Creating release
  name: Version 0.2.0
  tag: v0.2.0
  lastTag: v0.1.7
  npmtag: latest
  prerelease: false
Dry run: false
Changelog (you can edit this via github later):
- 9e4a230 automatic npm tags, refactor publish command
Is this okay? [y/N] _
```

## Arguments

- `--dry-run` prevents publisher from executing any state-changing commands.
  Useful for debugging and for verification of initial setup.
- `--verbose` prints extra information while running. Does not print secrets, so
  it's safe to use this in CI. But it makes the output harder to read.
- `--allow-dirty` overrides dirty repository check. Useful when your publish
  workflow changes commited files. Dirty check is disabled by default in CI mode.
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
