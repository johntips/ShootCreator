import type { Session, SessionRepository, Tag, TagRepository } from "@shoot-creater/core";
import { useCallback, useEffect, useState } from "react";
import { getSessionRepository } from "./sessionRepository";
import { getTagRepository } from "./tagRepository";

/**
 * Hook to interact with session storage.
 */
export function useSessionStore() {
  const repo: SessionRepository = getSessionRepository();

  const save = useCallback(
    async (session: Session) => {
      await repo.save(session);
    },
    [repo],
  );

  const loadAll = useCallback(async () => {
    return repo.getAll();
  }, [repo]);

  const loadToday = useCallback(async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
    return repo.getByDateRange(startOfDay, endOfDay);
  }, [repo]);

  const remove = useCallback(
    async (id: string) => {
      await repo.delete(id);
    },
    [repo],
  );

  return { save, loadAll, loadToday, remove };
}

/**
 * Hook to load session history with auto-refresh.
 */
export function useSessionHistory() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const repo: SessionRepository = getSessionRepository();

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await repo.getAll();
    setSessions(all);
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sessions, loading, refresh };
}

/**
 * Hook to manage tags.
 */
export function useTagStore() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const repo: TagRepository = getTagRepository();

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await repo.getActive();
    setTags(all);
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTag = useCallback(
    async (name: string): Promise<Tag> => {
      const tag: Tag = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        archived: false,
        createdAt: Date.now(),
      };
      await repo.save(tag);
      await refresh();
      return tag;
    },
    [repo, refresh],
  );

  const archiveTag = useCallback(
    async (id: string) => {
      await repo.archive(id);
      await refresh();
    },
    [repo, refresh],
  );

  const renameTag = useCallback(
    async (id: string, name: string) => {
      await repo.rename(id, name);
      await refresh();
    },
    [repo, refresh],
  );

  const getAllIncludingArchived = useCallback(async () => {
    return repo.getAll();
  }, [repo]);

  return { tags, loading, refresh, createTag, archiveTag, renameTag, getAllIncludingArchived };
}
