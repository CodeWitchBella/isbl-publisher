import fetch from 'node-fetch'
import { URL } from 'url'
import * as fs from 'fs'
import { promisify } from 'util'
import { expectedError } from './expected-error'

async function readGitlabToken({
  tokenFile,
  env,
}: {
  tokenFile: string | undefined
  env: typeof process.env
}): Promise<{ token: string; header: string }> {
  let token: string | null = null
  if (env['CI_JOB_TOKEN']) {
    token = env['CI_JOB_TOKEN'].trim()
    // https://forum.gitlab.com/t/ci-job-token-for-releases/39271/3
    return { token, header: 'JOB-TOKEN' }
  } else if (!tokenFile) {
    throw 'You must specify token file as first argument for gitlab repos.'
  } else {
    try {
      token = await promisify(fs.readFile)(tokenFile, 'utf-8')
      token = token.trim()
    } catch (e) {
      throw 'Cannot read Release API token (reading from ' + tokenFile + ')'
    }

    if (!token) {
      throw 'Cannot read Release API token (reading from ' + tokenFile + ')'
    }
  }
  return { token, header: 'PRIVATE-TOKEN' }
}

export async function getRepoInfo({
  tokenFile,
  env,
  ci,
}: {
  tokenFile: string | undefined
  env: typeof process.env
  ci: boolean
}) {
  const repoUrl = getRepoUrl(env)
  if (!repoUrl) throw new Error('No repoUrl')

  const github = new URL(repoUrl).hostname === 'github.com'

  if (!github) {
    const token = await readGitlabToken({ tokenFile, env })

    const headers = {
      'Content-Type': 'application/json',
      [token.header]: token.token,
    }
    const projectId = await getGitlabProjectId(env, ci, headers)

    return {
      github: false,
      token,
      id: projectId,
      apiBase: gitlabApiUrl('/api/v4/projects/' + projectId),
      headers,
      ci,
    }
  } else {
    const repo = repoUrl.replace(/\.git$/, '')
    return {
      github: true,
      repo,
      apiBase: 'https://api.github.com/repos' + new URL(repo).pathname,
      ci,
    }
  }

  function gitlabApiUrl(path: string) {
    if (!repoUrl) throw new Error('No repoUrl')
    const url = new URL(repoUrl)
    url.search = ''
    url.pathname = path
    return url.toString()
  }

  async function getGitlabProjectId(
    env: typeof process.env,
    ci: boolean,
    headers: any,
  ) {
    if (ci) {
      return env['CI_PROJECT_ID']
    } else {
      const path = new URL(repoUrl).pathname.replace(/\.git$/, '').slice(1)
      const url = gitlabApiUrl('/api/v4/projects/' + encodeURIComponent(path))
      const res = await (await fetch(url, { headers })).json()
      const id = res['id']
      if (!id) {
        throw 'Project not found'
      }
      return id
    }
  }
}

function getRepoUrl(env: typeof process.env) {
  const repoUrl = env['npm_package_repository_url']
  if (!repoUrl) {
    throw expectedError('You must specify repository.url in your package.json')
  }
  return repoUrl
}
