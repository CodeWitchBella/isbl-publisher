import fetch from 'node-fetch'
import open from 'open'
import { URLSearchParams } from 'url'
import type { getRepoInfo } from './get-repo-info'
import type { createRunner } from './run-command'

type Await<T> = T extends Promise<infer V> ? V : T

export async function createRelease({
  runner,
  info,
  args,
}: {
  runner: ReturnType<typeof createRunner>
  info: Await<ReturnType<typeof getRepoInfo>>
  args: {
    tag: string
    title: string
    body: string
    prerelease: boolean
    ref?: string
    draft?: boolean
  }
}) {
  if (info.github) {
    if (info.ci) {
      const arg = (bearerToken: string) => ({
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          "User-Agent": "npm:@isbl/publisher",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({
          tag_name: args.tag,
          name: args.title,
          body: args.body,
          draft: args.draft ?? true,
          prerelease: args.prerelease,
          target_commitish: args.ref,
        }),
      })
      if (runner.dryRun || runner.verbose) {
        console.log('fetch', info.apiBase + '/releases', arg('$GITHUB_TOKEN'))
      }
      if (!info.bearerToken) {
        throw 'Missing GITHUB_TOKEN'
      }
      if (!runner.dryRun) {
        await fetch(info.apiBase + '/releases', arg(info.bearerToken))
      }
    } else {
      const searchParams = new URLSearchParams({
        tag: args.tag,
        title: args.title,
        body: args.body,
        prerelease: args.prerelease + '',
      })
      if (args.ref) searchParams.set('target', args.ref)
      const url = info.repo + '/releases/new?' + searchParams.toString()
      await open(url)
    }
  } else {
    const body = {
      tag_name: args.tag,
      name: args.title,
      description: args.body,
      ref: args.ref,
    }
    if (runner.dryRun || runner.verbose) {
      console.log('POSTing release ', info.apiBase + '/releases', body)
    }
    if (!runner.dryRun) {
      const res = await fetch(info.apiBase + '/releases', {
        headers: info.headers,
        method: 'POST',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json['tag_name']) {
        if (runner.verbose) {
          console.log(json)
        }
        throw 'Failed to create release'
      }
    }
  }
}
