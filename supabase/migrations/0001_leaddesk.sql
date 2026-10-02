create table public.leads (
  id         text primary key,
  full_name  text not null,
  company    text not null,
  email      text not null,
  source     text not null,
  status     text not null default 'new'
             check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  budget     integer,
  message    text not null,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;
