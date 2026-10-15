// The providers StayUp knows about, and how each one is rendered. The five
// collectors (stayup-cmd-*) write rows in the shape these templates read.
import { buildTemplateMap } from "@/lib/providerTemplate"

export const PROVIDER_LIST = [
  {
    name: "rss",
    displayName: "RSS",
    template: {
      version: 1,
      display: {
        name: "RSS",
        icon: {
          paths: [
            "M4 11a9 9 0 0 1 9 9",
            "M4 4a16 16 0 0 1 16 16",
            "M6 19a1 1 0 0 1-2 0 1 1 0 0 1 2 0z",
          ],
          viewBox: "0 0 24 24",
          stroke: true,
        },
        accent: "#a8d4b5",
        sortOrder: 30,
        feedLabel: [
          {
            path: "$source.config.title",
          },
          {
            path: "$source.url",
            format: "domain",
          },
        ],
      },
      item: {
        parseContentAsJson: true,
        fields: {
          title: "title",
          subtitle: {
            path: "link",
            format: "hostname",
          },
          summary: "summary",
          url: "link",
          timestamp: "$row.datetime",
        },
      },
      list: {
        layout: "row",
        primary: "title",
        secondary: "subtitle",
        meta: "timestamp",
      },
      detail: {
        mode: "html",
        title: "title",
        subtitle: {
          path: "link",
          format: "hostname",
        },
        body: "summary",
        openUrl: "link",
        openLabel: "Read article",
      },
      form: {
        label: "RSS/Atom feed URL",
        placeholder: "https://blog.example.com/feed.xml",
        pattern: "^https?://.+",
        transform: {
          trim: true,
        },
      },
    },
  },
  {
    name: "youtube",
    displayName: "YouTube",
    template: {
      version: 1,
      display: {
        name: "YouTube",
        icon: {
          paths: [
            "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
            "m10 9 5 3-5 3z",
          ],
          viewBox: "0 0 24 24",
          stroke: true,
        },
        accent: "#e8a8b5",
        sortOrder: 20,
        feedLabel: {
          path: "$source.url",
          format: "urlSlug",
        },
      },
      item: {
        parseContentAsJson: true,
        fields: {
          title: "title",
          subtitle: {
            path: "url",
            format: "urlSlug",
          },
          image: "thumbnail",
          url: ["link", "url"],
          timestamp: "$row.datetime",
        },
      },
      list: {
        layout: "media",
        primary: "title",
        secondary: "subtitle",
        meta: "timestamp",
        thumbnail: "image",
      },
      detail: {
        mode: "media",
        title: "title",
        subtitle: {
          path: "url",
          format: "urlSlug",
        },
        image: "thumbnail",
        embedUrl: "https://www.youtube-nocookie.com/embed/{$row.version}",
        openUrl: ["link", "url"],
        openLabel: "Watch on YouTube",
      },
      form: {
        label: "YouTube channel (@handle or URL)",
        placeholder: "@fireship",
        urlTemplate: "https://www.youtube.com/@{value}",
        transform: {
          trim: true,
          extract: "youtube\\.com/(?:@|channel/|user/)([^/?\\s]+)",
          stripPrefix: ["@"],
        },
      },
    },
  },
  {
    name: "changelog",
    displayName: "Changelog",
    template: {
      version: 1,
      display: {
        name: "Changelog",
        icon: {
          paths: [
            "M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z",
            "M7 7h.01",
          ],
          viewBox: "0 0 24 24",
          stroke: true,
        },
        accent: "#f4b585",
        sortOrder: 10,
        feedLabel: {
          path: "$source.url",
          format: "urlSlug",
        },
      },
      item: {
        parseContentAsJson: false,
        vars: {
          repo: {
            path: "$source.url",
            format: "urlSlug",
          },
        },
        fields: {
          title: "{repo}",
          subtitle: "$row.version",
          summary: {
            path: "content",
            format: "stripMarkdown",
          },
          url: "https://github.com/{repo}/releases/tag/{$row.version}",
          timestamp: "$row.datetime",
        },
      },
      list: {
        layout: "row",
        primary: "title",
        secondary: "subtitle",
        meta: "timestamp",
        snippet: "summary",
      },
      detail: {
        mode: "text",
        title: "{repo}",
        badge: "$row.version",
        body: {
          path: "content",
          format: "stripMarkdown",
        },
        openUrl: "https://github.com/{repo}/releases/tag/{$row.version}",
        openLabel: "Open on GitHub",
      },
      form: {
        label: "GitHub repo (owner/repo or URL)",
        placeholder: "vercel/next.js",
        urlTemplate: "https://github.com/{value}/",
        transform: {
          trim: true,
          extract: "github\\.com/([^/]+/[^/]+)",
          stripSuffix: [".git", "/"],
        },
      },
    },
  },
  {
    name: "github_trending",
    displayName: "GitHub Trending",
    template: {
      version: 1,
      display: {
        name: "GitHub Trending",
        icon: {
          paths: ["M22 7 13.5 15.5 8.5 10.5 2 17", "M16 7h6v6"],
          viewBox: "0 0 24 24",
          stroke: true,
        },
        accent: "#f4b585",
        sortOrder: 50,
        feedLabel: {
          path: "$source.url",
          cases: {
            "https://github.com/trending?since=daily": "daily",
            "https://github.com/trending?since=weekly": "weekly",
            "https://github.com/trending?since=monthly": "monthly",
          },
        },
      },
      item: {
        parseContentAsJson: true,
        vars: {
          window: {
            path: "since",
            cases: {
              daily: "today",
              weekly: "this week",
              monthly: "this month",
            },
          },
        },
        fields: {
          title: "GitHub Trending — {window}",
          subtitle: "{count} repositories",
          summary: "The {count} repositories trending {window} on GitHub.",
          url: "url",
          timestamp: "fetched_at",
        },
      },
      list: {
        layout: "row",
        primary: "title",
        secondary: "subtitle",
        meta: "timestamp",
      },
      detail: {
        mode: "table",
        title: "Trending {window}",
        collection: "repos",
        rowLink: "url",
        columns: [
          {
            label: "#",
            field: "rank",
            align: "right",
            width: "2.5rem",
          },
          {
            label: "Repository",
            field: "{owner}/{name}",
            link: "url",
            emphasis: true,
          },
          {
            label: "Description",
            field: "description",
            muted: true,
            truncate: true,
          },
          {
            label: "Language",
            field: "language",
          },
          {
            label: "Stars",
            field: "stars",
            align: "right",
            format: "compactNumber",
          },
          {
            label: "Forks",
            field: "forks",
            align: "right",
            format: "compactNumber",
          },
          {
            label: "This period",
            field: "stars_period",
            align: "right",
            format: "compactNumber",
            prefix: "+",
            accent: true,
          },
        ],
        openUrl: "url",
        openLabel: "Open on github.com/trending",
      },
      form: {
        label: "Trending window (daily, weekly or monthly)",
        placeholder: "daily",
        urlTemplate: "https://github.com/trending?since={value}",
        pattern: "^(daily|weekly|monthly)$",
        transform: {
          trim: true,
          extract: "[?&]since=([a-z]+)",
        },
      },
    },
  },
  {
    name: "scrap",
    displayName: "Scrap",
    template: {
      version: 1,
      display: {
        name: "Scrap",
        icon: {
          paths: [
            "M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z",
            "M12 2a15 15 0 0 0 0 20 15 15 0 0 0 0-20",
            "M2 12h20",
          ],
          viewBox: "0 0 24 24",
          stroke: true,
        },
        accent: "#9dc7e0",
        sortOrder: 40,
        feedLabel: {
          path: "$source.url",
          format: "domain",
        },
      },
      item: {
        parseContentAsJson: false,
        fields: {
          title: [
            "content",
            {
              path: "$row.params.url",
              format: "hostname",
            },
          ],
          subtitle: {
            path: "$row.params.url",
            format: "hostname",
          },
          summary: "content",
          url: "$row.params.url",
          timestamp: "$row.executed_at",
        },
      },
      list: {
        layout: "row",
        primary: "title",
        secondary: "subtitle",
        meta: "timestamp",
      },
      detail: {
        mode: "text",
        title: {
          path: "$row.params.url",
          format: "hostname",
        },
        body: "content",
        openUrl: "$row.params.url",
        openLabel: "Visit website",
      },
      form: {
        label: "Page URL to scrape",
        placeholder: "https://blog.example.com/",
        pattern: "^https?://.+",
        transform: {
          trim: true,
        },
      },
    },
  },
  {
    name: "reddit",
    displayName: "Reddit",
    template: {
      version: 1,
      display: {
        name: "Reddit",
        icon: {
          paths: ["M7.9 20A9 9 0 1 0 4 16.1L2 22z"],
          viewBox: "0 0 24 24",
          stroke: true,
        },
        accent: "#f0937a",
        sortOrder: 60,
        feedLabel: {
          path: "$source.url",
          format: "urlSlug",
        },
      },
      item: {
        parseContentAsJson: true,
        fields: {
          title: "title",
          subtitle: "r/{subreddit} · ▲ {score}",
          summary: "summary",
          url: "link",
          timestamp: "$row.datetime",
        },
      },
      list: {
        layout: "row",
        primary: "title",
        secondary: "subtitle",
        meta: "timestamp",
        snippet: "summary",
      },
      detail: {
        mode: "text",
        title: "title",
        subtitle: "r/{subreddit} · u/{author}",
        badge: "▲ {score}",
        body: "summary",
        openUrl: "link",
        openLabel: "Open on Reddit",
      },
      form: {
        label: "Subreddit (r/name or URL)",
        placeholder: "r/programming",
        urlTemplate: "https://www.reddit.com/r/{value}/",
        transform: {
          trim: true,
          extract: "reddit\\.com/r/([^/?\\s]+)",
          stripPrefix: ["/r/", "r/"],
        },
      },
    },
  },
  {
    name: "podcast",
    displayName: "Podcast",
    template: {
      version: 1,
      display: {
        name: "Podcast",
        icon: {
          paths: [
            "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z",
            "M19 10v2a7 7 0 0 1-14 0v-2",
            "M12 19v3",
          ],
          viewBox: "0 0 24 24",
          stroke: true,
        },
        accent: "#c5b1e8",
        sortOrder: 70,
        feedLabel: [
          {
            path: "$source.config.title",
          },
          {
            path: "$source.url",
            format: "domain",
          },
        ],
      },
      item: {
        parseContentAsJson: true,
        fields: {
          title: "title",
          subtitle: "duration",
          image: "image",
          summary: "summary",
          url: "link",
          timestamp: "$row.datetime",
        },
      },
      list: {
        layout: "media",
        primary: "title",
        secondary: "subtitle",
        meta: "timestamp",
        thumbnail: "image",
      },
      detail: {
        mode: "audio",
        title: "title",
        subtitle: "duration",
        image: "image",
        audioUrl: "audio",
        body: "summary",
        openUrl: ["link", "audio"],
        openLabel: "Open episode",
      },
      form: {
        label: "Podcast RSS feed URL",
        placeholder: "https://feeds.example.com/show.xml",
        pattern: "^https?://.+",
        transform: {
          trim: true,
        },
      },
    },
  },
  {
    name: "social",
    displayName: "Social",
    template: {
      version: 1,
      display: {
        name: "Social",
        icon: {
          paths: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"],
          viewBox: "0 0 24 24",
          stroke: true,
        },
        accent: "#8fb8e8",
        sortOrder: 80,
        feedLabel: [
          {
            path: "$source.config.title",
          },
          {
            path: "$source.url",
            format: "urlSlug",
          },
        ],
      },
      item: {
        parseContentAsJson: true,
        fields: {
          title: "text",
          subtitle: "{author} · {handle}",
          summary: "text",
          url: "link",
          timestamp: "$row.datetime",
        },
      },
      list: {
        layout: "row",
        primary: "title",
        secondary: "subtitle",
        meta: "timestamp",
      },
      detail: {
        mode: "text",
        title: "author",
        subtitle: "handle",
        badge: "♥ {likes} · ↻ {reposts}",
        body: "text",
        openUrl: "link",
        openLabel: "Open post",
      },
      form: {
        label: "Mastodon or Bluesky URL",
        placeholder: "https://mastodon.social/@user",
        pattern: "^https?://.+",
        transform: {
          trim: true,
        },
      },
    },
  },
]

export const PROVIDERS = buildTemplateMap(PROVIDER_LIST)
