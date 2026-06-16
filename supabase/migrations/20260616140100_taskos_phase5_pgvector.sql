-- LuminaTaskOS P5: semantic memory via pgvector (gte-small = 384 dims)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE public.taskos_tasks    ADD COLUMN IF NOT EXISTS embedding extensions.vector(384);
ALTER TABLE public.taskos_entities ADD COLUMN IF NOT EXISTS embedding extensions.vector(384);

CREATE INDEX IF NOT EXISTS taskos_tasks_embedding_idx
  ON public.taskos_tasks USING hnsw (embedding extensions.vector_cosine_ops);
CREATE INDEX IF NOT EXISTS taskos_entities_embedding_idx
  ON public.taskos_entities USING hnsw (embedding extensions.vector_cosine_ops);

NOTIFY pgrst, 'reload schema';
