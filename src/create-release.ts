import fetch from 'node-fetch'
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
      const arg = {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          "User-Agent": "npm:@isbl/publisher",
        },
        body: JSON.stringify({
          tag_name: args.tag,
          name: args.title,
          body: args.body,
          draft: args.draft ?? true,
          prerelease: args.prerelease,
          target_commitish: args.ref,
        }),
      }
      if (runner.dryRun) {
        console.log('fetch', info.apiBase + '/releases', arg)
      } else {
        await fetch(info.apiBase + '/releases', arg)
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
      if (runner.cmdCheck('which', ['open'])) {
        runner.cmd('open', [url])
      } else {
        runner.cmd('xdg-open', [url])
      }
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
