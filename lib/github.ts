const token = process.env.GITHUB_TOKEN || ""
const org = process.env.GITHUB_ORG || "rimoapp"
const username = process.env.GITHUB_USERNAME || ""

async function ghFetch(path: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })
  if (!res.ok) return null
  return res.json()
}

export interface PRSummary {
  title: string
  number: number
  repo: string
  state: string
  created: string
  url: string
}

export function isConfigured(): boolean {
  return !!(token && username)
}

export async function getRecentActivity(): Promise<PRSummary[] | null> {
  if (!isConfigured()) return null
  try {
    const q = `is:pr author:${username} org:${org}`
    const data = await ghFetch(
      `/search/issues?q=${encodeURIComponent(q)}&sort=updated&per_page=10`
    )
    if (!data?.items) return null

    return data.items.map((item: any) => ({
      title: item.title,
      number: item.number,
      repo: item.repository_url.split("/").pop(),
      state: item.state,
      created: item.created_at,
      url: item.html_url,
    }))
  } catch {
    return null
  }
}

export async function searchPRs(query?: string): Promise<PRSummary[]> {
  if (!isConfigured()) return []
  try {
    const q = `is:pr author:${username} org:${org}${query ? ` ${query} in:title,body` : ""}`
    const data = await ghFetch(
      `/search/issues?q=${encodeURIComponent(q)}&sort=updated&per_page=8`
    )
    return (
  
      data?.items?.map((item: any) => ({
        title: item.title,
        number: item.number,
        repo: item.repository_url.split("/").pop(),
        state: item.state,
        created: item.created_at,
        url: item.html_url,
      })) || []
    )
  } catch {
    return []
  }
}

export async function getPRDetails(
  repo: string,
  number: number
): Promise<Record<string, unknown> | null> {
  if (!token) return null
  try {
    const [pr, reviews] = await Promise.all([
      ghFetch(`/repos/${org}/${repo}/pulls/${number}`),
      ghFetch(`/repos/${org}/${repo}/pulls/${number}/reviews`),
    ])
    if (!pr) return null
    return {
      title: pr.title,
      body: (pr.body || "").slice(0, 500),
      state: pr.state,
      merged: pr.merged,
      additions: pr.additions,
      deletions: pr.deletions,
      changed_files: pr.changed_files,
  
      reviews: (reviews || []).map((r: any) => ({
        state: r.state,
        body: (r.body || "").slice(0, 200),
      })),
    }
  } catch {
    return null
  }
}
