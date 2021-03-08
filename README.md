# @isbl/published

[npm](https://www.npmjs.com/package/@isbl/publisher)

Automates release process

## How to

Install from npm

```
yarn add -D @isbl/publisher
```

add to your scripts in `package.json`

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/CodeWitchBella/npm-publisher.git"
  },
  "scripts": {
    "prepublishOnly": "isbl-publisher prepublishOnly",
    "publish:npm": "yarn build && isbl-publisher publish path-to-gitlab-token"
  }
}
```

Path to gitlab token is not required if `repository.url` points to github.
