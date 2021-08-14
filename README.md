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

## How to setup (GitHub)

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

Run `yarn publish:npm`. You can also run `yarn publish:npm --dry-run` to see
commands which would be executed.

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
