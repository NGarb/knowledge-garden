# Knowledge Garden

## Supabase Setup

Run these SQL commands in your Supabase SQL editor before using the app.

### 1. Enable pgvector

```sql
create extension if not exists vector;
```

### 2. Create entries table

```sql
create table entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('fact', 'thought')),
  content text not null,
  category text not null,
  tags text[] default '{}',
  embedding vector(1536),
  created_at timestamptz default now()
);
```

### 3. Create questions table

```sql
create table questions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references entries(id) on delete cascade,
  text text not null,
  embedding vector(1536),
  closed_at timestamptz,
  closed_by_entry_id uuid references entries(id),
  created_at timestamptz default now()
);
```

### 4. Create match_entries function

```sql
create or replace function match_entries(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  type text,
  content text,
  category text,
  tags text[],
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select id, type, content, category, tags, created_at,
    1 - (embedding <=> query_embedding) as similarity
  from entries
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

### 5. Create match_questions function

```sql
create or replace function match_questions(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  entry_id uuid,
  text text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select id, entry_id, text, created_at,
    1 - (embedding <=> query_embedding) as similarity
  from questions
  where closed_at is null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

### 6. Enable Row Level Security

```sql
alter table entries enable row level security;
alter table questions enable row level security;

create policy "allow all" on entries for all using (true);
create policy "allow all" on questions for all using (true);
```

---

## Environment Variables

Create a `.env.local` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-...
```

For Vercel: add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `OPENAI_API_KEY` under Settings → Environment Variables.

---

## Running locally

```bash
npm install
npm run dev
```
