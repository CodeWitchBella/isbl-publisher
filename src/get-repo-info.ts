import fetch from 'node-fetch'
import { URL } from 'url'
import { expectedError } from './expected-error'

export async function getRepoInfo({
  tokenFile,
  env,
}: {
  tokenFile: string | undefined
  env: typeof process.env
}) {
  const repoUrl = getRepoUrl(env)
  if (!repoUrl) throw new Error('No repoUrl')

  const github = new URL(repoUrl).hostname === 'github.com'

  if (!github) {
    if (!tokenFile) {
      throw 'You must specify token file as first argument for gitlab repos.'
    }

    let token: string
    try {
      token = fs.readFileSync(tokenFile, 'utf-8').trim()
    } catch (e) {
      throw 'Cannot read Release API token (reading from ' + tokenFile + ')'
    }
    if (!token) {
      throw 'Cannot read Release API token (reading from ' + tokenFile + ')'
    }

    const headers = {
      'Content-Type': 'application/json',
      'PRIVATE-TOKEN': token,
    }
    const path = new URL(repoUrl).pathname.replace(/\.git$/, '').slice(1)
    const url = apiUrl('/api/v4/projects/' + encodeURIComponent(path))
    const res = await (await fetch(url, { headers })).json()
    const id = res['id']
    if (!id) {
      throw 'Project not found'
    }
    return {
      github: false,
      token,
      id,
      apiBase: apiUrl('/api/v4/projects/' + id),
      headers,
    }
  } else {
    return {
      github: true,
      repo: repoUrl.replace(/\.git$/, ''),
    }
  }

  function apiUrl(path: string) {
    if (!repoUrl) throw new Error('No repoUrl')
    const url = new URL(repoUrl)
    url.search = ''
    url.pathname = path
    return url.toString()
  }
}

function getRepoUrl(env: typeof process.env) {
  const repoUrl = env['npm_package_repository_url']
  if (!repoUrl) {
    throw expectedError('You must specify repository.url in your package.json')
  }
  return repoUrl
}
