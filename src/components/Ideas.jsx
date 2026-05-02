const IDEAS = [
  {
    phase: 'near-term',
    items: [
      {
        title: 'recommendations on capture',
        description: 'After classifying an entry, surface 2 books and 2 podcasts that go deeper on the same themes — tuned to the specific content, not just the category.'
      },
      {
        title: 'thread view',
        description: 'Surface the question lineage (closed_by_entry_id) as a readable narrative arc — showing how one question spawned an answer that opened the next. The shape of a thought over time.'
      }
    ]
  },
  {
    phase: 'mid-term',
    items: [
      {
        title: 'cluster detection',
        description: 'Periodic clustering over all entry embeddings to find emergent topic areas. Not user-defined — mathematically emergent. GPT names each cluster and describes what\'s alive in it.'
      },
      {
        title: 'central node surfacing',
        description: 'Identify bridging concepts that sit between clusters — the ideas that connect your thinking across different areas. Surface them when a new entry significantly raises one\'s centrality.'
      },
      {
        title: 'contradiction detection',
        description: 'Flag entries that are semantically adjacent but conceptually in tension — things you believed that a new entry quietly undermines. Surfaces the places where your thinking is shifting.'
      },
      {
        title: 'essay readiness',
        description: 'When a cluster reaches a readiness threshold — sufficient mass, spread across entry types, at least one closed question, entries spanning multiple days — surface a prompt: "this might be ready to write." GPT suggests a title and 3-point thesis drawn from the specific entries. Not a nudge to write more; a signal that you already have.'
      }
    ]
  },
  {
    phase: 'graph rag',
    items: [
      {
        title: 'how did i get here?',
        description: 'Trace the full lineage of a current thought — which entry spawned which question, which answer shifted your thinking, what the chain looks like going all the way back.'
      },
      {
        title: 'what changed my mind?',
        description: 'Find pairs of entries that are semantically similar but conceptually divergent, then trace what happened between them. Follow the path that moved you.'
      },
      {
        title: 'shortest path between two ideas',
        description: 'Pick any two entries that feel unrelated. Walk the network and find the 2–3 bridging concepts that actually connect them. Often the most generative insight the tool can offer.'
      },
      {
        title: 'what\'s unresolved in this thread?',
        description: 'Walk a cluster and surface the specific questions that were never closed — not a global list, but the gaps unique to a particular area of your thinking.'
      }
    ]
  },
  {
    phase: 'external sources',
    items: [
      {
        title: 'hacker news feed',
        description: 'Pull top stories via the public HN API and filter them through your graph — only surface articles that are semantically close to your existing clusters. Not reading HN; reading the parts of HN that matter to your thinking specifically.'
      },
      {
        title: 'rss / substack feeds',
        description: 'Add RSS feeds from writers you follow (most Substacks expose one). Articles get embedded and matched against your garden — surfaced when they connect to something you\'re already thinking about.'
      },
      {
        title: 'capture from article',
        description: 'One-tap to pull an external article into the garden as a capture seed — skips the blank page and starts from something you\'ve already read.'
      }
    ]
  },
  {
    phase: 'longer horizon',
    items: [
      {
        title: 'spatial garden view',
        description: 'A density-based visual of your garden — clusters as areas, high-centrality nodes labeled, navigated by curiosity rather than chronology. The map of your own thinking.'
      },
      {
        title: 'field emergence',
        description: 'When a cluster reaches sufficient density, GPT synthesises it into a named field — what it\'s about, what\'s still open, who\'s thought hardest about it. Discovery, not suggestion.'
      },
      {
        title: 'multi-garden networking',
        description: 'Find structural similarity between your clusters and someone else\'s — not by shared tags, but by geometric proximity in embedding space. A meaningful introduction across fields.'
      }
    ]
  }
]

const SOURCES = [
  { name: 'Business Basics Podcast', description: 'Breaks down core business concepts and how companies actually work.' },
  { name: 'Morning Brew', description: 'Daily newsletter on business, finance, and tech — fast and readable.' },
  { name: 'No Nonsense Spirituality', description: 'Practical takes on inner life, meaning, and personal philosophy without the fluff.' },
  { name: 'Not Just Bikes', description: 'Urban planning and city design through the lens of what makes places actually liveable.' },
  { name: 'War Fronts', description: 'Ground-level analysis of active conflicts and the geopolitics driving them.' },
  { name: 'Caspian Report', description: 'Deep-dive geopolitical analysis of regions, power dynamics, and global strategy.' },
  { name: 'Economics Explained', description: 'Complex economic systems and events made genuinely accessible.' },
  { name: 'Torin Russell', description: 'Former CIA analyst covering espionage, intelligence tradecraft, history, and country-level economics on TikTok.' }
]

const PHASE_LABELS = {
  'near-term': 'near-term',
  'mid-term': 'mid-term',
  'graph rag': 'graph rag',
  'external sources': 'external sources',
  'longer horizon': 'longer horizon'
}

export default function Ideas() {
  return (
    <div className="ideas-view">
      <h2 className="ideas-heading">what this could become</h2>
      <p className="ideas-intro">ideas in rough order — from close to the current codebase to bigger swings.</p>
      {IDEAS.map(group => (
        <div key={group.phase} className="ideas-group">
          <span className="ideas-phase">{PHASE_LABELS[group.phase]}</span>
          <div className="ideas-list">
            {group.items.map(item => (
              <div key={item.title} className="idea-item">
                <p className="idea-title">{item.title}</p>
                <p className="idea-description">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="ideas-group">
        <span className="ideas-phase">sources</span>
        <div className="sources-list">
          {SOURCES.map(s => (
            <div key={s.name} className="source-item">
              <p className="source-name">{s.name}</p>
              <p className="source-description">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
